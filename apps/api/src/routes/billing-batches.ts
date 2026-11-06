import {createHash} from "node:crypto";
import type {FastifyInstance} from "fastify";
import {and,desc,eq,gt,lt} from "drizzle-orm";
import {z} from "zod";
import {parseDay} from "@apartment/domain";
import {db} from "../db/client.js";
import {auditLogs,billingBatchRuns,invoices,invoiceLines,leases,memberships,organizations,properties,rooms,users,type BillingBatchSnapshot} from "../db/schema.js";
import {AppError,requireActor,requireProperty} from "../security.js";
import {prepareInvoice,validBillingPeriod} from "../services/billing.js";
import {queueInvoiceIssuedTx} from "../services/line-notifications.js";
import {notifyOrganizationMembersTx} from "../services/org-notifications.js";

const id=z.uuid(),day=z.iso.date();
const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
type Reader=Pick<typeof db,"select">;

async function assertOwner(actorId:string,property:typeof properties.$inferSelect,client:Reader){
 const [user]=await client.select({id:users.id}).from(users)
  .where(and(eq(users.id,actorId),eq(users.status,"ACTIVE"))).for("share");
 if(!user)throw new AppError(403,"OWNER_REQUIRED");
 const [org]=await client.select({id:organizations.id,status:organizations.status}).from(organizations)
  .where(eq(organizations.id,property.organizationId)).for("share");
 if(!org||org.status!=="ACTIVE")throw new AppError(403,"ORG_ACCESS_DENIED");
 const [member]=await client.select({role:memberships.role,status:memberships.status})
  .from(memberships).where(and(eq(memberships.organizationId,property.organizationId),
   eq(memberships.userId,actorId))).for("share");
 if(!member||member.status!=="ACTIVE"||member.role!=="OWNER")
  throw new AppError(403,"OWNER_REQUIRED");
}

async function buildSnapshot(property:typeof properties.$inferSelect,start:string,endExclusive:string,
 client:Reader):Promise<BillingBatchSnapshot>{
 const [org]=await client.select({name:organizations.name}).from(organizations)
  .where(eq(organizations.id,property.organizationId));
 if(!org)throw new AppError(404,"ORGANIZATION_NOT_FOUND");
 const occupied=await client.select().from(rooms).where(and(eq(rooms.propertyId,property.id),
  eq(rooms.organizationId,property.organizationId),eq(rooms.status,"OCCUPIED")))
  .orderBy(rooms.number,rooms.id);
 if(occupied.length>200)throw new AppError(422,"BULK_ROOM_LIMIT_EXCEEDED");
 const result:BillingBatchSnapshot={version:1,start,endExclusive,rooms:[]};
 for(const room of occupied){
  const active=await client.select({id:leases.id}).from(leases).where(and(eq(leases.roomId,room.id),
   eq(leases.propertyId,property.id),eq(leases.organizationId,property.organizationId),
   eq(leases.status,"ACTIVE"))).limit(1);
  const leaseId=active[0]?.id??null;
  try{
   if(!leaseId)throw new AppError(422,"FULL_PERIOD_ACTIVE_LEASE_REQUIRED");
   const preview=await prepareInvoice({roomId:room.id,start,endExclusive},property,client);
   const [duplicate]=await client.select({id:invoices.id}).from(invoices).where(and(
    eq(invoices.leaseId,preview.lease.id),eq(invoices.periodStart,start),eq(invoices.periodEnd,endExclusive)));
   if(duplicate)throw new AppError(409,"PERIOD_ALREADY_BILLED");
   const [overlap]=await client.select({id:invoices.id}).from(invoices).where(and(
    eq(invoices.leaseId,preview.lease.id),eq(invoices.organizationId,property.organizationId),
    eq(invoices.status,"ISSUED"),lt(invoices.periodStart,endExclusive),gt(invoices.periodEnd,start))).limit(1);
   if(overlap)throw new AppError(409,"PERIOD_OVERLAP_ALREADY_BILLED");
   const fingerprint=digest({property:{id:property.id,name:property.name,address:property.address,
    dueDays:property.dueDays},organizationName:org.name,room:{id:preview.room.id,
    number:preview.room.number},lease:{id:preview.lease.id,tenantName:preview.lease.tenantName},
    start,endExclusive,totalSatang:preview.totalSatang,lines:preview.lines});
   result.rooms.push({roomId:room.id,roomNumber:room.number,leaseId:preview.lease.id,status:"READY",
    amountSatang:preview.totalSatang,fingerprint,lines:preview.lines.map(line=>({type:line.type,
     description:line.description,amountSatang:line.amountSatang})),reason:null});
  }catch(error){
   if(!(error instanceof AppError))throw error;
   result.rooms.push({roomId:room.id,roomNumber:room.number,leaseId,status:"SKIPPED",
    amountSatang:null,fingerprint:null,lines:[],reason:error.code});
  }
 }
 return result;
}

function dueDate(endExclusive:string,dueDays:number){
 const date=parseDay(endExclusive);date.setUTCDate(date.getUTCDate()+dueDays);
 return date.toISOString().slice(0,10);
}

export async function registerBillingBatchRoutes(app:FastifyInstance){
 app.get("/v1/properties/:propertyId/billing-batch-runs",async(req,reply)=>{
  const actor=await requireActor(req),{propertyId}=z.object({propertyId:id}).parse(req.params);
  const property=await requireProperty(actor,propertyId);
  await assertOwner(actor.id,property,db);
  reply.header("cache-control","private, no-store");
  return db.select().from(billingBatchRuns).where(and(
   eq(billingBatchRuns.propertyId,property.id),eq(billingBatchRuns.organizationId,property.organizationId)))
   .orderBy(desc(billingBatchRuns.createdAt)).limit(20);
 });

 app.post("/v1/properties/:propertyId/billing-batch-runs/preview",async(req,reply)=>{
  const actor=await requireActor(req),{propertyId}=z.object({propertyId:id}).parse(req.params);
  const property=await requireProperty(actor,propertyId,true);
  const body=z.object({start:day,endExclusive:day}).parse(req.body);
  const key=req.headers["idempotency-key"];
  if(typeof key!=="string"||key.length<8||key.length>128)throw new AppError(400,"IDEMPOTENCY_KEY_REQUIRED");
  const requestHash=digest({propertyId,start:body.start,endExclusive:body.endExclusive});
  const result=await db.transaction(async tx=>{
   // Active user/org/OWNER locks precede the property lock, matching deposit scope order.
   await assertOwner(actor.id,property,tx);
   const [locked]=await tx.select().from(properties).where(eq(properties.id,property.id)).for("update");
   if(!locked)throw new AppError(404,"PROPERTY_NOT_FOUND");
   if(!validBillingPeriod(locked,body.start,body.endExclusive))throw new AppError(422,"INVALID_BILLING_PERIOD");
   const [existing]=await tx.select().from(billingBatchRuns).where(and(
    eq(billingBatchRuns.propertyId,locked.id),eq(billingBatchRuns.idempotencyKey,key))).for("update");
   if(existing){
    if(existing.requestHash!==requestHash)throw new AppError(409,"IDEMPOTENCY_KEY_REUSED");
    return {run:existing,replayed:true};
   }
   const snapshot=await buildSnapshot(locked,body.start,body.endExclusive,tx);
   const [run]=await tx.insert(billingBatchRuns).values({organizationId:locked.organizationId,
    propertyId:locked.id,periodStart:body.start,periodEnd:body.endExclusive,idempotencyKey:key,
    requestHash,previewHash:digest(snapshot),previewSnapshot:snapshot,createdBy:actor.id}).returning();
   await tx.insert(auditLogs).values({actorId:actor.id,organizationId:locked.organizationId,
    action:"BILLING_BATCH_PREVIEWED",targetId:run.id,metadata:{readyCount:snapshot.rooms.filter(r=>r.status==="READY").length,
     skippedCount:snapshot.rooms.filter(r=>r.status==="SKIPPED").length,start:body.start,endExclusive:body.endExclusive}});
   return {run,replayed:false};
  });
  reply.header("cache-control","no-store");
  return reply.code(result.replayed||result.run.status==="COMPLETED"?200:201)
   .send({...result.run,replayed:result.replayed});
 });

 app.post("/v1/properties/:propertyId/billing-batch-runs/:runId/approve",async(req,reply)=>{
  const actor=await requireActor(req),{propertyId,runId}=z.object({propertyId:id,runId:id}).parse(req.params);
  const property=await requireProperty(actor,propertyId,true);
  const body=z.object({confirmed:z.literal(true),previewHash:z.string().regex(/^[a-f0-9]{64}$/)}).parse(req.body);
  const result=await db.transaction(async tx=>{
   // Active user/org/OWNER locks precede the property lock, matching deposit scope order.
   await assertOwner(actor.id,property,tx);
   const [locked]=await tx.select().from(properties).where(eq(properties.id,property.id)).for("update");
   if(!locked)throw new AppError(404,"PROPERTY_NOT_FOUND");
   const [run]=await tx.select().from(billingBatchRuns).where(and(
    eq(billingBatchRuns.id,runId),eq(billingBatchRuns.propertyId,locked.id),
    eq(billingBatchRuns.organizationId,locked.organizationId))).for("update");
   if(!run)throw new AppError(404,"BILLING_BATCH_NOT_FOUND");
   if(body.previewHash!==run.previewHash)throw new AppError(409,"BILLING_PREVIEW_CHANGED");
   if(run.status==="COMPLETED")return {run,replayed:true};
   if(run.status!=="PREVIEWED")throw new AppError(409,"BILLING_BATCH_NOT_APPROVABLE");
   if(Date.now()-run.createdAt.getTime()>15*60_000)throw new AppError(409,"BILLING_PREVIEW_EXPIRED");
   const [org]=await tx.select({name:organizations.name,status:organizations.status})
    .from(organizations).where(eq(organizations.id,locked.organizationId));
   if(!org||org.status!=="ACTIVE")throw new AppError(409,"ORGANIZATION_NOT_ACTIVE");
   // Room locks serialize against meter entry, maintenance and occupancy changes while
   // the approved immutable preview is compared and every invoice is issued atomically.
   const roomIds=run.previewSnapshot.rooms.map(r=>r.roomId);
   if(roomIds.length)await tx.select({id:rooms.id}).from(rooms).where(and(
    eq(rooms.propertyId,locked.id),eq(rooms.organizationId,locked.organizationId)))
    .orderBy(rooms.id).for("update");
   const current=await buildSnapshot(locked,run.periodStart,run.periodEnd,tx);
   if(digest(current)!==run.previewHash){
    const [stale]=await tx.update(billingBatchRuns).set({status:"STALE"}).where(eq(billingBatchRuns.id,run.id)).returning();
    await tx.insert(auditLogs).values({actorId:actor.id,organizationId:locked.organizationId,
     action:"BILLING_BATCH_STALE",targetId:run.id,metadata:{reason:"PREVIEW_CHANGED"}});
    return {run:stale,replayed:false,stale:true};
   }
   const ready=current.rooms.filter(r=>r.status==="READY");
   if(ready.length===0)throw new AppError(422,"NO_ELIGIBLE_BILLS");
   for(const item of ready){
    const preview=await prepareInvoice({roomId:item.roomId,start:run.periodStart,
     endExclusive:run.periodEnd},locked,tx);
    const [invoice]=await tx.insert(invoices).values({organizationId:locked.organizationId,
     propertyId:locked.id,roomId:preview.room.id,leaseId:preview.lease.id,
     periodStart:run.periodStart,periodEnd:run.periodEnd,dueDate:dueDate(run.periodEnd,locked.dueDays),
     amountSatang:preview.totalSatang,idempotencyKey:`batch:${run.id}:${item.roomId}`,
     billingBatchRunId:run.id,issuedBy:actor.id,documentSnapshot:{schemaVersion:1,
      issuerName:org.name,propertyName:locked.name,propertyAddress:locked.address,
      roomNumber:preview.room.number,tenantName:preview.lease.tenantName}}).returning();
    await tx.insert(invoiceLines).values(preview.lines.map((line,ordinal)=>({invoiceId:invoice.id,
     ordinal,...line})));
    await tx.insert(auditLogs).values({actorId:actor.id,organizationId:locked.organizationId,
     action:"INVOICE_ISSUED",targetId:invoice.id,metadata:{amountSatang:invoice.amountSatang,billingBatchRunId:run.id}});
    await queueInvoiceIssuedTx(tx,invoice);
    await notifyOrganizationMembersTx(tx,locked.organizationId,{eventKey:`INVOICE_ISSUED:${invoice.id}`,kind:"INVOICE_ISSUED",
     title:"ออกใบแจ้งหนี้แล้ว",body:`ออกใบแจ้งหนี้ห้อง ${preview.room.number} รอบ ${run.periodStart} ถึง ${run.periodEnd} แล้ว`});
   }
   const [completed]=await tx.update(billingBatchRuns).set({status:"COMPLETED",approvedBy:actor.id,
    approvedAt:new Date(),completedAt:new Date(),issuedCount:ready.length})
    .where(eq(billingBatchRuns.id,run.id)).returning();
   await tx.insert(auditLogs).values({actorId:actor.id,organizationId:locked.organizationId,
    action:"BILLING_BATCH_COMPLETED",targetId:run.id,metadata:{issuedCount:ready.length,
     skippedCount:current.rooms.length-ready.length}});
   return {run:completed,replayed:false};
  });
  reply.header("cache-control","no-store");
  if("stale" in result&&result.stale)return reply.code(409).send({error:"BILLING_PREVIEW_CHANGED",run:result.run});
  return reply.code(result.replayed?200:201).send(result);
 });
}
