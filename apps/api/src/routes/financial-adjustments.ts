import type {FastifyInstance} from "fastify";
import {and,desc,eq} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {
 auditLogs,financeAdjustmentEntries,financeAdjustmentRequests,invoices,memberships,paymentLedger
} from "../db/schema.js";
import {AppError,requireActor,requireProperty,type Actor} from "../security.js";
import {getFinancialPosition} from "../services/financial-position.js";
import {validateAdjustmentDecision,type AdjustmentKind} from "../services/financial-rules.js";

const uid=z.uuid();
const context=z.object({propertyId:uid,invoiceId:uid});
const requestContext=z.object({propertyId:uid,requestId:uid});
const proposal=z.object({
 kind:z.enum(["INTERNAL_CREDIT","REVERSE_MANUAL_PAYMENT","REFUND_REVIEW","DISPUTE_REVIEW"]),
 amountSatang:z.number().int().positive().max(2147483647),
 originalLedgerId:uid.optional(),
 reason:z.string().trim().min(15).max(500)
});
const decision=z.discriminatedUnion("action",[
 z.object({action:z.literal("APPROVE"),reviewReason:z.string().trim().min(15).max(500)}),
 z.object({action:z.literal("REJECT"),reviewReason:z.string().trim().min(15).max(500)})
]);
async function requireOwner(actor:Actor,propertyId:string){
 const property=await requireProperty(actor,propertyId);
 const [membership]=await db.select({id:memberships.id}).from(memberships)
 .where(and(eq(memberships.organizationId,property.organizationId),eq(memberships.userId,actor.id),
 eq(memberships.role,"OWNER"),eq(memberships.status,"ACTIVE"))).limit(1);
 // This dual-owner financial control intentionally has no platform SUPER_ADMIN bypass.
 if(!membership)throw new AppError(403,"SECOND_LEVEL_FINANCE_OWNER_REQUIRED");
 return property;
}
function ensureScope<T extends {propertyId:string;organizationId:string}>(record:T|undefined,propertyId:string,organizationId:string){
 if(!record||record.propertyId!==propertyId||record.organizationId!==organizationId)
  throw new AppError(404,"FINANCE_RESOURCE_NOT_FOUND");
 return record;
}
async function invoiceByProperty(propertyId:string,organizationId:string,invoiceId:string){
 const [bill]=await db.select().from(invoices).where(and(eq(invoices.id,invoiceId),
  eq(invoices.propertyId,propertyId),eq(invoices.organizationId,organizationId))).limit(1);
 if(!bill)throw new AppError(404,"INVOICE_NOT_FOUND");
 if(bill.status!=="ISSUED")throw new AppError(409,"INVOICE_NOT_ISSUED");
 return bill;
}
export async function registerFinancialAdjustmentRoutes(app:FastifyInstance){
 app.get("/v1/properties/:propertyId/invoices/:invoiceId/finance-context",async req=>{
  const actor=await requireActor(req);
  const {propertyId,invoiceId}=context.parse(req.params);
  const property=await requireOwner(actor,propertyId);
  await invoiceByProperty(propertyId,property.organizationId,invoiceId);
  const [position,postings,reversals]=await Promise.all([
   getFinancialPosition(invoiceId),
   db.select({id:paymentLedger.id,amountSatang:paymentLedger.amountSatang,
    createdAt:paymentLedger.createdAt}).from(paymentLedger)
    .where(and(eq(paymentLedger.invoiceId,invoiceId),eq(paymentLedger.propertyId,propertyId),
     eq(paymentLedger.organizationId,property.organizationId))),
   db.select({originalLedgerId:financeAdjustmentEntries.originalLedgerId}).from(financeAdjustmentEntries)
    .where(and(eq(financeAdjustmentEntries.invoiceId,invoiceId),
     eq(financeAdjustmentEntries.kind,"REVERSE_MANUAL_PAYMENT")))
  ]);
  const reversed=new Set(reversals.map(r=>r.originalLedgerId));
  return {position,reversiblePayments:postings.filter(p=>!reversed.has(p.id))};
 });
 app.get("/v1/properties/:propertyId/finance-adjustments",async req=>{
  const actor=await requireActor(req);
  const {propertyId}=z.object({propertyId:uid}).parse(req.params);
  const property=await requireOwner(actor,propertyId);
  return db.select().from(financeAdjustmentRequests).where(and(
   eq(financeAdjustmentRequests.organizationId,property.organizationId),
   eq(financeAdjustmentRequests.propertyId,propertyId)
  )).orderBy(desc(financeAdjustmentRequests.createdAt)).limit(100);
 });
 app.post("/v1/properties/:propertyId/invoices/:invoiceId/finance-adjustments",{
  config:{rateLimit:{max:10,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req),{propertyId,invoiceId}=context.parse(req.params);
  const property=await requireOwner(actor,propertyId);
  const payload=proposal.parse(req.body);
  const header=req.headers["idempotency-key"];
  if(typeof header!=="string"||header.length<8||header.length>128)
   throw new AppError(400,"IDEMPOTENCY_KEY_REQUIRED");
  await invoiceByProperty(propertyId,property.organizationId,invoiceId);
  if((payload.kind==="REVERSE_MANUAL_PAYMENT")!==!!payload.originalLedgerId)
   throw new AppError(422,"ORIGINAL_LEDGER_REQUIRED_FOR_REVERSAL_ONLY");
  const [replay]=await db.select().from(financeAdjustmentRequests)
   .where(and(eq(financeAdjustmentRequests.requestedBy,actor.id),
    eq(financeAdjustmentRequests.idempotencyKey,header))).limit(1);
  if(replay){
   if(replay.invoiceId!==invoiceId||replay.kind!==payload.kind||
    replay.amountSatang!==payload.amountSatang||replay.reason!==payload.reason||
    replay.originalLedgerId!==(payload.originalLedgerId??null))
    throw new AppError(409,"IDEMPOTENCY_KEY_REUSED");
   return reply.code(200).send({request:replay,replayed:true});
  }
  if(payload.originalLedgerId){
   const [source]=await db.select().from(paymentLedger).where(eq(paymentLedger.id,payload.originalLedgerId)).limit(1);
   ensureScope(source,propertyId,property.organizationId);
   if(source.invoiceId!==invoiceId||source.amountSatang!==payload.amountSatang)
    throw new AppError(422,"REVERSAL_MUST_MATCH_LEDGER_ENTRY");
  }
  if(payload.kind==="INTERNAL_CREDIT"){
   const balance=await getFinancialPosition(invoiceId);
   if(payload.amountSatang>balance.outstandingSatang)
    throw new AppError(422,"ADJUSTMENT_EXCEEDS_OUTSTANDING");
  }
  const [created]=await db.insert(financeAdjustmentRequests).values({
   organizationId:property.organizationId,propertyId,invoiceId,kind:payload.kind,
   originalLedgerId:payload.originalLedgerId??null,amountSatang:payload.amountSatang,
   reason:payload.reason,requestedBy:actor.id,idempotencyKey:header
  }).returning();
  await db.insert(auditLogs).values({actorId:actor.id,organizationId:property.organizationId,
   action:"FINANCE_ADJUSTMENT_REQUESTED",targetId:created.id,
   metadata:{invoiceId,kind:created.kind,amountSatang:created.amountSatang}});
  return reply.code(201).send({request:created,replayed:false});
 });

 app.post("/v1/properties/:propertyId/finance-adjustments/:requestId/decision",{
  config:{rateLimit:{max:10,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req),{propertyId,requestId}=requestContext.parse(req.params);
  const property=await requireOwner(actor,propertyId);
  const input=decision.parse(req.body);
  const result=await db.transaction(async tx=>{
   // Invoice lock first, then request lock: serializes concurrent review of all balance
   // changes to one invoice, consistent with payment approval's invoice lock order.
   const [candidate]=await tx.select().from(financeAdjustmentRequests).where(and(
    eq(financeAdjustmentRequests.id,requestId),eq(financeAdjustmentRequests.propertyId,propertyId),
    eq(financeAdjustmentRequests.organizationId,property.organizationId))).limit(1);
   if(!candidate)throw new AppError(404,"FINANCE_ADJUSTMENT_NOT_FOUND");
   const [bill]=await tx.select().from(invoices).where(and(eq(invoices.id,candidate.invoiceId),
    eq(invoices.propertyId,propertyId),eq(invoices.organizationId,property.organizationId))).for("update");
   if(!bill||bill.status!=="ISSUED")throw new AppError(409,"INVOICE_NOT_ISSUED");
   const [r]=await tx.select().from(financeAdjustmentRequests).where(eq(financeAdjustmentRequests.id,candidate.id)).for("update");
   if(!r||r.status!=="PENDING")throw new AppError(409,"FINANCE_ADJUSTMENT_ALREADY_DECIDED");
   if(r.requestedBy===actor.id)throw new AppError(403,"SECOND_OWNER_APPROVAL_REQUIRED");
   const financial=await getFinancialPosition(bill.id,tx);
   let sourceAmount=0;
   if(r.kind==="REVERSE_MANUAL_PAYMENT"){
    if(!r.originalLedgerId)throw new AppError(409,"REVERSAL_SOURCE_REQUIRED");
    const [source]=await tx.select().from(paymentLedger).where(and(
     eq(paymentLedger.id,r.originalLedgerId),eq(paymentLedger.invoiceId,bill.id),
     eq(paymentLedger.propertyId,propertyId),eq(paymentLedger.organizationId,property.organizationId))).limit(1);
    if(!source)throw new AppError(404,"FINANCE_SOURCE_NOT_FOUND");
    sourceAmount=source.amountSatang;
    const [prior]=await tx.select({id:financeAdjustmentEntries.id}).from(financeAdjustmentEntries)
     .where(eq(financeAdjustmentEntries.originalLedgerId,r.originalLedgerId)).limit(1);
    if(prior&&input.action==="APPROVE")throw new AppError(409,"PAYMENT_ALREADY_REVERSED");
   }
   if(input.action==="APPROVE"){
    try{validateAdjustmentDecision(r.requestedBy,actor.id,r.kind as AdjustmentKind,
      r.amountSatang,financial.outstandingSatang,sourceAmount);}
    catch(err){throw new AppError(422,err instanceof Error?err.message:"INVALID_FINANCIAL_ADJUSTMENT");}
    if(r.kind==="REFUND_REVIEW"){
     // APPROVED means a second owner has accepted a request for *later reconciliation*.
     // No actual money is transferred, and no payment or receivable entry is posted.
     const history=await tx.select({amount:financeAdjustmentRequests.amountSatang})
      .from(financeAdjustmentRequests).where(and(eq(financeAdjustmentRequests.invoiceId,bill.id),
       eq(financeAdjustmentRequests.kind,"REFUND_REVIEW"),eq(financeAdjustmentRequests.status,"APPROVED")));
     const total=history.reduce((n,v)=>n+v.amount,0);
     if(!Number.isSafeInteger(total+r.amountSatang)||
      total+r.amountSatang>financial.netManualApprovedSatang)
      throw new AppError(422,"REFUND_REVIEW_EXCEEDS_MANUAL_APPROVAL");
    }
    if(r.kind==="DISPUTE_REVIEW"&&r.amountSatang>bill.amountSatang)
     throw new AppError(422,"DISPUTE_EXCEEDS_INVOICE");
    if(r.kind==="INTERNAL_CREDIT"||r.kind==="REVERSE_MANUAL_PAYMENT"){
     await tx.insert(financeAdjustmentEntries).values({
      requestId:r.id,organizationId:r.organizationId,propertyId:r.propertyId,
      invoiceId:r.invoiceId,kind:r.kind,originalLedgerId:r.originalLedgerId,
      amountSatang:r.amountSatang,createdBy:actor.id
     });
    }
   }
   const [updated]=await tx.update(financeAdjustmentRequests).set({
    status:input.action==="APPROVE"?"APPROVED":"REJECTED",
    reviewedAt:new Date(),reviewedBy:actor.id,reviewReason:input.reviewReason
   }).where(and(eq(financeAdjustmentRequests.id,r.id),
    eq(financeAdjustmentRequests.status,"PENDING"))).returning();
   if(!updated)throw new AppError(409,"FINANCE_ADJUSTMENT_ALREADY_DECIDED");
   await tx.insert(auditLogs).values({actorId:actor.id,organizationId:property.organizationId,
    action:input.action==="APPROVE"?"FINANCE_ADJUSTMENT_REVIEW_APPROVED":"FINANCE_ADJUSTMENT_REJECTED",
    targetId:r.id,metadata:{kind:r.kind,invoiceId:r.invoiceId,
     amountSatang:r.amountSatang,cashTransferExecuted:false}});
   return {request:updated,financialPosition:await getFinancialPosition(bill.id,tx),
    transferExecuted:false,documentIssued:false,bankReconciled:false};
  });
  return reply.send(result);
 });
}
