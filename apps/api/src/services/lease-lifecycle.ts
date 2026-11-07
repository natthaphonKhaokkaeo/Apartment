import {and,eq,inArray,isNull} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {
 auditLogs,financeAdjustmentRequests,invoices,leaseInvitations,leases,
 lineNotificationConsents,lineOutbox,memberships,meterReadings,paymentClaims,
 properties,rooms
} from "../db/schema.js";
import type {Actor} from "../security.js";
import {AppError} from "../security.js";
import {getFinancialPosition} from "./financial-position.js";

export function validateMoveOutBoundary(startDate:string,endExclusive:string,now=new Date()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(endExclusive)||
  Number.isNaN(Date.parse(endExclusive))||
  new Date(endExclusive).toISOString().slice(0,10)!==endExclusive)
  throw new AppError(422,"MOVE_OUT_INVALID_DATE");
 const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Bangkok",year:"numeric",
  month:"2-digit",day:"2-digit"}).format(now);
 if(endExclusive<=startDate||endExclusive>today)
  throw new AppError(422,"MOVE_OUT_BOUNDARY_OUT_OF_RANGE");
 return endExclusive;
}
const params=z.object({propertyId:z.uuid(),leaseId:z.uuid()});
const input=z.object({
 endExclusive:z.iso.date(),
 roomDisposition:z.enum(["AVAILABLE","MAINTENANCE"]),
 confirmedHandover:z.literal(true)
});
/** P1-01: strict move-out with no implicit financial write-off.
 * All invoices must be settled and cover the final boundary, pending payment/
 * finance reviews must be cleared, and final utility readings must be captured.
 */
export async function moveOutLease(actor:Actor,rawParams:unknown,rawBody:unknown){
 const {propertyId,leaseId}=params.parse(rawParams),body=input.parse(rawBody);
 return db.transaction(async tx=>{
  // Same property-level row lock as invoice issue. Prevents concurrent issue
  // against an ACTIVE lease during move-out.
  const [property]=await tx.select().from(properties).where(eq(properties.id,propertyId))
   .for("update").limit(1);
  if(!property)throw new AppError(404,"PROPERTY_NOT_FOUND");
  const [owner]=await tx.select({id:memberships.id}).from(memberships)
   .where(and(eq(memberships.organizationId,property.organizationId),
    eq(memberships.userId,actor.id),eq(memberships.role,"OWNER"),
    eq(memberships.status,"ACTIVE"))).limit(1);
  if(actor.role!=="SUPER_ADMIN"&&!owner)throw new AppError(403,"LEASE_MOVE_OUT_OWNER_REQUIRED");
  const [lease]=await tx.select().from(leases).where(and(
   eq(leases.id,leaseId),eq(leases.propertyId,propertyId),
   eq(leases.organizationId,property.organizationId))).for("update").limit(1);
  if(!lease)throw new AppError(404,"LEASE_NOT_FOUND");
  if(lease.status!=="ACTIVE")throw new AppError(409,"LEASE_ALREADY_ENDED");
  validateMoveOutBoundary(lease.startDate,body.endExclusive);
  const [room]=await tx.select().from(rooms).where(and(
   eq(rooms.id,lease.roomId),eq(rooms.propertyId,property.id),
   eq(rooms.organizationId,property.organizationId))).for("update").limit(1);
  if(!room||room.status!=="OCCUPIED")throw new AppError(409,"ROOM_NOT_OCCUPIED");
  // Do not release room before final utility boundary, even for a zero rent.
  const readings=await tx.select({kind:meterReadings.kind}).from(meterReadings)
   .where(and(eq(meterReadings.roomId,room.id),eq(meterReadings.propertyId,property.id),
    eq(meterReadings.organizationId,property.organizationId),
    eq(meterReadings.readAt,body.endExclusive)));
  if(!readings.some(r=>r.kind==="WATER")||!readings.some(r=>r.kind==="ELECTRIC"))
   throw new AppError(409,"MOVE_OUT_FINAL_METERS_REQUIRED");
  const bills=await tx.select().from(invoices).where(and(
   eq(invoices.leaseId,lease.id),eq(invoices.propertyId,property.id),
   eq(invoices.organizationId,property.organizationId),
   eq(invoices.status,"ISSUED")));
  if(!bills.some(b=>b.periodEnd===body.endExclusive))
   throw new AppError(409,"MOVE_OUT_FINAL_INVOICE_REQUIRED");
  if(bills.some(b=>b.periodEnd>body.endExclusive))
   throw new AppError(409,"MOVE_OUT_FUTURE_INVOICE_EXISTS");
  const billIds=bills.map(b=>b.id);
  const [pendingClaim]=await tx.select({id:paymentClaims.id})
   .from(paymentClaims).where(and(inArray(paymentClaims.invoiceId,billIds),
    eq(paymentClaims.organizationId,property.organizationId),
    eq(paymentClaims.status,"PENDING"))).limit(1);
  if(pendingClaim)throw new AppError(409,"MOVE_OUT_PENDING_PAYMENT");
  const [pendingFinance]=await tx.select({id:financeAdjustmentRequests.id})
   .from(financeAdjustmentRequests).where(and(
    inArray(financeAdjustmentRequests.invoiceId,billIds),
    eq(financeAdjustmentRequests.organizationId,property.organizationId),
    eq(financeAdjustmentRequests.status,"PENDING"))).limit(1);
  if(pendingFinance)throw new AppError(409,"MOVE_OUT_PENDING_FINANCE");
  for(const bill of bills){
   const balance=await getFinancialPosition(bill.id,tx);
   if(balance.outstandingSatang>0)throw new AppError(409,"MOVE_OUT_UNSETTLED_INVOICES");
  }
  const now=new Date();
  const [updated]=await tx.update(leases).set({status:"ENDED",endDate:body.endExclusive})
   .where(and(eq(leases.id,lease.id),eq(leases.status,"ACTIVE"))).returning();
  if(!updated)throw new AppError(409,"LEASE_ALREADY_ENDED");
  const [released]=await tx.update(rooms).set({status:body.roomDisposition})
   .where(and(eq(rooms.id,lease.roomId),eq(rooms.status,"OCCUPIED"))).returning();
  if(!released)throw new AppError(409,"ROOM_NOT_OCCUPIED");
  await tx.update(leaseInvitations).set({revokedAt:now}).where(and(
   eq(leaseInvitations.leaseId,lease.id),isNull(leaseInvitations.revokedAt)));
  const activeConsents=await tx.select({id:lineNotificationConsents.id})
   .from(lineNotificationConsents).where(and(eq(lineNotificationConsents.leaseId,lease.id),
    isNull(lineNotificationConsents.revokedAt)));
  if(activeConsents.length){
   await tx.update(lineNotificationConsents).set({revokedAt:now}).where(
    inArray(lineNotificationConsents.id,activeConsents.map(c=>c.id)));
  }
  await tx.update(lineOutbox).set({status:"DEAD",leaseUntil:null,
   lastErrorCode:"LEASE_ENDED",processedAt:now}).where(and(
   eq(lineOutbox.leaseId,lease.id),
   inArray(lineOutbox.status,["QUEUED","RETRY","SENDING"])));
  await tx.insert(auditLogs).values({actorId:actor.id,organizationId:property.organizationId,
   action:"LEASE_MOVED_OUT",targetId:lease.id,metadata:{
    roomId:room.id,endExclusive:body.endExclusive,
    roomDisposition:body.roomDisposition,settledInvoices:bills.length
   }});
  return {leaseId:updated.id,roomId:room.id,organizationId:property.organizationId,
   status:updated.status,endDate:updated.endDate,roomStatus:released.status};
 });
}
