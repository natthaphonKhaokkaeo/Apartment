import {createHash} from "node:crypto";
import type {FastifyInstance} from "fastify";
import {and,desc,eq,inArray} from "drizzle-orm";
import {z} from "zod";
import {parseDay} from "@apartment/domain";
import {db} from "../db/client.js";
import {auditLogs,evidenceUploads,financeAdjustmentRequests,invoices,invoiceLines,lineOutbox,paymentClaims,paymentLedger,properties,rooms} from "../db/schema.js";
import {AppError,requireActor,requireProperty} from "../security.js";
import {prepareInvoice} from "../services/billing.js";
import {invoiceNoteLine,optionalInvoiceNote} from "../services/invoice-note.js";
import {queueInvoiceIssuedTx} from "../services/line-notifications.js";
import {notifyOrganizationMembersTx} from "../services/org-notifications.js";
import {assertOwner} from "./billing-batches.js";
import {assertReissueAllowed,correctedInvoiceTotal} from "../services/invoice-reissue-policy.js";

const uid=z.uuid();
const routeParams=z.object({propertyId:uid,invoiceId:uid});
const correction=z.object({
 reason:z.string().trim().min(15).max(500),
 adjustmentSatang:z.number().int().min(-2147483647).max(2147483647).default(0),
 note:optionalInvoiceNote
});
const confirmSchema=correction.extend({confirmed:z.literal(true),previewHash:z.string().regex(/^[a-f0-9]{64}$/)});
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const dueDate=(end:string,days:number)=>{const d=parseDay(end);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};

type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
async function checkedInvoice(tx:Tx,propertyId:string,organizationId:string,invoiceId:string){
 const [original]=await tx.select().from(invoices).where(and(eq(invoices.id,invoiceId),
  eq(invoices.propertyId,propertyId),eq(invoices.organizationId,organizationId))).for("update");
 if(!original)throw new AppError(404,"INVOICE_NOT_FOUND");
 const [claims,ledger,adjustments,evidence,sending]=await Promise.all([
  tx.select({id:paymentClaims.id}).from(paymentClaims).where(eq(paymentClaims.invoiceId,invoiceId)).limit(1),
  tx.select({id:paymentLedger.id}).from(paymentLedger).where(eq(paymentLedger.invoiceId,invoiceId)).limit(1),
  tx.select({id:financeAdjustmentRequests.id}).from(financeAdjustmentRequests).where(eq(financeAdjustmentRequests.invoiceId,invoiceId)).limit(1),
  tx.select({id:evidenceUploads.id}).from(evidenceUploads).where(eq(evidenceUploads.invoiceId,invoiceId)).limit(1),
  tx.select({id:lineOutbox.id}).from(lineOutbox).where(and(eq(lineOutbox.organizationId,organizationId),
   eq(lineOutbox.eventKey,`BILL_ISSUED:${invoiceId}`),eq(lineOutbox.status,"SENDING"))).limit(1)
 ]);
 assertReissueAllowed({status:original.status,claimCount:claims.length,ledgerCount:ledger.length,
  adjustmentCount:adjustments.length,evidenceCount:evidence.length,sendingCount:sending.length});
 return original;
}
async function buildCorrection(tx:Tx,property:typeof properties.$inferSelect,
 original:typeof invoices.$inferSelect,input:z.infer<typeof correction>){
 const prepared=await prepareInvoice({roomId:original.roomId,start:original.periodStart,
  endExclusive:original.periodEnd},property,tx);
 if((prepared.lease?.id??null)!==original.leaseId)throw new AppError(409,"LEASE_CHANGED_SINCE_ISSUE");
 const total=correctedInvoiceTotal(prepared.totalSatang,input.adjustmentSatang);
 const lines:Array<{type:string;description:string;unitsMilli:number|null;tariffSatang:number|null;amountSatang:number;snapshot:unknown}>=[...prepared.lines];
 const [previousNote]=await tx.select({description:invoiceLines.description}).from(invoiceLines)
  .where(and(eq(invoiceLines.invoiceId,original.id),eq(invoiceLines.type,"NOTE"))).limit(1);
 const noteLine=invoiceNoteLine(input.note??previousNote?.description);
 if(noteLine)lines.push(noteLine);

 if(input.adjustmentSatang!==0)lines.push({type:"CORRECTION",description:("ปรับปรุงยอดใบแจ้งหนี้: "+input.reason).slice(0,450),
  unitsMilli:null,tariffSatang:null,amountSatang:input.adjustmentSatang,
  snapshot:{reason:input.reason,originalInvoiceId:original.id}});
 const previewHash=hash({originalId:original.id,originalAmount:original.amountSatang,
  originalStatus:original.status,periodStart:original.periodStart,periodEnd:original.periodEnd,
  reason:input.reason,adjustmentSatang:input.adjustmentSatang,lines,total});
 return {previewHash,originalAmountSatang:original.amountSatang,amountSatang:total,
  lines,periodStart:original.periodStart,periodEnd:original.periodEnd};
}
export async function registerInvoiceReissueRoutes(app:FastifyInstance){
 app.get("/v1/properties/:propertyId/invoice-corrections",async(req,reply)=>{
  const actor=await requireActor(req);
  const {propertyId}=z.object({propertyId:uid}).parse(req.params);
  const property=await requireProperty(actor,propertyId);
  await assertOwner(actor.id,property,db);
  reply.header("cache-control","private, no-store");
  return db.select({id:invoices.id,roomId:invoices.roomId,roomNumber:rooms.number,
   periodStart:invoices.periodStart,periodEnd:invoices.periodEnd,amountSatang:invoices.amountSatang,
   status:invoices.status,replacesInvoiceId:invoices.replacesInvoiceId,voidReason:invoices.voidReason,
   createdAt:invoices.createdAt}).from(invoices).innerJoin(rooms,eq(rooms.id,invoices.roomId))
   .where(and(eq(invoices.propertyId,propertyId),eq(invoices.organizationId,property.organizationId)))
   .orderBy(desc(invoices.createdAt)).limit(100);
 });
 app.post("/v1/properties/:propertyId/invoices/:invoiceId/reissue-preview",async(req,reply)=>{
  const actor=await requireActor(req),{propertyId,invoiceId}=routeParams.parse(req.params);
  const property=await requireProperty(actor,propertyId,true);
  const input=correction.parse(req.body);
  const result=await db.transaction(async tx=>{
   await assertOwner(actor.id,property,tx);
   const original=await checkedInvoice(tx,propertyId,property.organizationId,invoiceId);
   return buildCorrection(tx,property,original,input);
  });
  reply.header("cache-control","no-store");
  return result;
 });
 app.post("/v1/properties/:propertyId/invoices/:invoiceId/reissue",{
  config:{rateLimit:{max:10,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req),{propertyId,invoiceId}=routeParams.parse(req.params);
  const property=await requireProperty(actor,propertyId,true);
  const input=confirmSchema.parse(req.body);
  const key=req.headers["idempotency-key"];
  if(typeof key!=="string"||key.length<8||key.length>128)throw new AppError(400,"IDEMPOTENCY_KEY_REQUIRED");
  const result=await db.transaction(async tx=>{
   await assertOwner(actor.id,property,tx);
   const [lockedProperty]=await tx.select().from(properties).where(eq(properties.id,property.id)).for("update");
   if(!lockedProperty)throw new AppError(404,"PROPERTY_NOT_FOUND");
   const [replayed]=await tx.select().from(invoices).where(and(eq(invoices.propertyId,propertyId),
    eq(invoices.idempotencyKey,key))).for("update");
   if(replayed){
    const [adjustmentLine]=await tx.select({amountSatang:invoiceLines.amountSatang})
     .from(invoiceLines).where(and(eq(invoiceLines.invoiceId,replayed.id),eq(invoiceLines.type,"CORRECTION"))).limit(1);
    if(replayed.replacesInvoiceId!==invoiceId||replayed.voidReason!==null||
     (adjustmentLine?.amountSatang??0)!==input.adjustmentSatang)
     throw new AppError(409,"IDEMPOTENCY_KEY_REUSED");
    const [source]=await tx.select({voidReason:invoices.voidReason}).from(invoices)
     .where(eq(invoices.id,invoiceId));
    if(source?.voidReason!==input.reason)throw new AppError(409,"IDEMPOTENCY_KEY_REUSED");
    if(input.note!==undefined){
     const [savedNote]=await tx.select({description:invoiceLines.description}).from(invoiceLines)
      .where(and(eq(invoiceLines.invoiceId,replayed.id),eq(invoiceLines.type,"NOTE"))).limit(1);
     if((savedNote?.description??"")!==input.note)throw new AppError(409,"IDEMPOTENCY_KEY_REUSED");
    }
    return {invoice:replayed,replayed:true};
   }
   const original=await checkedInvoice(tx,propertyId,property.organizationId,invoiceId);
   // Order and lock the room to serialize meter/occupancy mutations during re-calculation.
   await tx.select({id:rooms.id}).from(rooms).where(eq(rooms.id,original.roomId)).for("update");
   const preview=await buildCorrection(tx,lockedProperty,original,input);
   if(preview.previewHash!==input.previewHash)throw new AppError(409,"INVOICE_CORRECTION_PREVIEW_STALE");
   // Lock old outbound notification before voiding, so an in-flight send is never silently cancelled.
   const cancelledEvents=[`BILL_ISSUED:${invoiceId}`,`PAYMENT_DUE:${invoiceId}`];
   const oldOutbox=await tx.select().from(lineOutbox).where(and(eq(lineOutbox.organizationId,property.organizationId),
    inArray(lineOutbox.eventKey,cancelledEvents))).for("update");
   if(oldOutbox.some(x=>x.status==="SENDING"))throw new AppError(409,"LINE_NOTIFICATION_IN_FLIGHT");
   await tx.update(lineOutbox).set({status:"DEAD",lastErrorCode:"INVOICE_VOIDED"}).where(and(
    eq(lineOutbox.organizationId,property.organizationId),inArray(lineOutbox.eventKey,cancelledEvents),
    inArray(lineOutbox.status,["QUEUED","RETRY"])));
   await tx.update(invoices).set({status:"VOID",voidReason:input.reason,voidedAt:new Date(),voidedBy:actor.id})
    .where(eq(invoices.id,invoiceId));
   const [created]=await tx.insert(invoices).values({
    organizationId:original.organizationId,propertyId,roomId:original.roomId,leaseId:original.leaseId,
    periodStart:original.periodStart,periodEnd:original.periodEnd,
    dueDate:dueDate(original.periodEnd,lockedProperty.dueDays),
    amountSatang:preview.amountSatang,issuedBy:actor.id,idempotencyKey:key,replacesInvoiceId:original.id,
    documentSnapshot:original.documentSnapshot
   }).returning();
   await tx.insert(invoiceLines).values(preview.lines.map((line,ordinal)=>({invoiceId:created.id,ordinal,...line})));
   await tx.insert(auditLogs).values({actorId:actor.id,organizationId:property.organizationId,
    action:"INVOICE_REISSUED",targetId:created.id,metadata:{originalInvoiceId:invoiceId,
     correctionReason:input.reason,previousAmountSatang:original.amountSatang,
     correctedAmountSatang:created.amountSatang,adjustmentSatang:input.adjustmentSatang,
     actorPlatformRole:actor.role,propertyId}});
   await queueInvoiceIssuedTx(tx,created);
   await notifyOrganizationMembersTx(tx,property.organizationId,{eventKey:`INVOICE_REISSUED:${created.id}`,
    kind:"INVOICE_ISSUED",title:"ออกบิลฉบับแก้ไข",body:`ออกบิลฉบับแก้ไขเรียบร้อย ยอด ฿${(created.amountSatang/100).toFixed(2)}`});
   return {invoice:created,replayed:false};
  });
  reply.header("cache-control","no-store");
  return reply.code(result.replayed?200:201).send(result);
 });
}
