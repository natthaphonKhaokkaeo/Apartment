import {and,desc,eq,gt,lt} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {
 auditLogs,invoices,memberships,properties,roomRateVersions,rooms
} from "../db/schema.js";
import type {Actor} from "../security.js";
import {AppError} from "../security.js";
import {
 bangkokToday,effectiveMasterRate,isRateBoundary
} from "./property-rates.js";

const money=z.number().int().min(0).max(2147483647);
export const roomRateInput=z.object({
 effectiveFrom:z.iso.date(),
 rentOverrideSatang:money.nullable(),
 waterOverrideSatang:money.nullable(),
 electricOverrideSatang:money.nullable(),
 reason:z.string().trim().min(12).max(500)
}).strict();
type QueryClient=Pick<typeof db,"select">;

/** Any revision inside one billing interval is unsafe without explicitly
 * splitting line items, so a full invoice must not cross one.
 */
export function selectRoomRateForPeriod<T extends {id:string;effectiveFrom:string}>(
 versions:T[],start:string,endExclusive:string
):T{
 const applicable=versions.filter(v=>v.effectiveFrom<=start)
  .sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom));
 if(!applicable.length)throw new AppError(409,"ROOM_RATE_HISTORY_MISSING");
 if(versions.some(v=>v.effectiveFrom>start&&v.effectiveFrom<endExclusive))
  throw new AppError(422,"ROOM_RATE_CHANGE_WITHIN_BILLING_PERIOD");
 return applicable[0];
}
export async function effectiveRoomRate(
 room:typeof rooms.$inferSelect,start:string,endExclusive:string,
 client:QueryClient=db
){
 const versions=await client.select().from(roomRateVersions).where(and(
  eq(roomRateVersions.roomId,room.id),
  eq(roomRateVersions.organizationId,room.organizationId),
  eq(roomRateVersions.propertyId,room.propertyId),
  lt(roomRateVersions.effectiveFrom,endExclusive)
 ));
 return selectRoomRateForPeriod(versions,start,endExclusive);
}
export async function listRoomRates(roomId:string,propertyId:string,organizationId:string){
 return db.select().from(roomRateVersions).where(and(
  eq(roomRateVersions.roomId,roomId),
  eq(roomRateVersions.propertyId,propertyId),
  eq(roomRateVersions.organizationId,organizationId)
 )).orderBy(desc(roomRateVersions.effectiveFrom));
}
export async function scheduleRoomRate(
 actor:Actor,propertyId:string,roomId:string,bodyUnknown:unknown,now=new Date()
){
 const body=roomRateInput.parse(bodyUnknown);
 return db.transaction(async tx=>{
  // Shared property lock with invoice issue and property-master rate schedules.
  const [property]=await tx.select().from(properties)
   .where(eq(properties.id,propertyId)).for("update").limit(1);
  if(!property)throw new AppError(404,"PROPERTY_NOT_FOUND");
  const [member]=await tx.select({id:memberships.id}).from(memberships)
   .where(and(eq(memberships.organizationId,property.organizationId),
    eq(memberships.userId,actor.id),eq(memberships.status,"ACTIVE"),
    eq(memberships.role,"OWNER"))).limit(1);
  if(actor.role!=="SUPER_ADMIN"&&!member)throw new AppError(403,"ROOM_RATE_OWNER_REQUIRED");
  const [room]=await tx.select().from(rooms).where(and(
   eq(rooms.id,roomId),eq(rooms.propertyId,property.id),
   eq(rooms.organizationId,property.organizationId)
  )).for("update").limit(1);
  if(!room)throw new AppError(404,"ROOM_NOT_FOUND");
  if(body.effectiveFrom<bangkokToday(now))
   throw new AppError(422,"ROOM_RATE_BACKDATE_FORBIDDEN");
  if(!isRateBoundary(property,body.effectiveFrom))
   throw new AppError(422,"ROOM_RATE_NOT_PERIOD_START");
  const [previous]=await tx.select().from(roomRateVersions).where(and(
   eq(roomRateVersions.roomId,room.id),
   eq(roomRateVersions.organizationId,property.organizationId)
  )).orderBy(desc(roomRateVersions.effectiveFrom)).limit(1);
  if(!previous)throw new AppError(409,"ROOM_RATE_HISTORY_MISSING");
  if(body.effectiveFrom<=previous.effectiveFrom)
   throw new AppError(409,"ROOM_RATE_ALREADY_SCHEDULED");
  if(previous.rentOverrideSatang===body.rentOverrideSatang&&
   previous.waterOverrideSatang===body.waterOverrideSatang&&
   previous.electricOverrideSatang===body.electricOverrideSatang)
   throw new AppError(409,"ROOM_RATE_UNCHANGED");
  const [alreadyIssued]=await tx.select({id:invoices.id}).from(invoices)
   .where(and(eq(invoices.roomId,room.id),
    eq(invoices.organizationId,property.organizationId),
    eq(invoices.status,"ISSUED"),
    gt(invoices.periodEnd,body.effectiveFrom))).limit(1);
  if(alreadyIssued)throw new AppError(409,"ROOM_RATE_FUTURE_BILL_EXISTS");
  // Even inherited rates must not silently exceed Super Admin reviewed ceiling.
  if(!property.complianceReviewedAt||!property.complianceEvidenceRef||
   property.waterAllowedMax===null||property.electricAllowedMax===null)
   throw new AppError(409,"ROOM_RATE_COMPLIANCE_REQUIRED");
  const nextDay=new Date(Date.parse(body.effectiveFrom)+86400_000)
   .toISOString().slice(0,10);
  const master=await effectiveMasterRate(property,body.effectiveFrom,nextDay,tx);
  const water=body.waterOverrideSatang??master.waterSatangPerUnit;
  const electric=body.electricOverrideSatang??master.electricSatangPerUnit;
  if(water>property.waterAllowedMax||electric>property.electricAllowedMax)
   throw new AppError(422,"ROOM_RATE_ABOVE_REVIEWED_LIMIT");
  const [rate]=await tx.insert(roomRateVersions).values({
   ...body,roomId:room.id,organizationId:property.organizationId,
   propertyId:property.id,createdBy:actor.id
  }).returning();
  await tx.insert(auditLogs).values({
   actorId:actor.id,organizationId:property.organizationId,
   action:"ROOM_RATE_SCHEDULED",targetId:rate.id,
   metadata:{roomId:room.id,propertyId:property.id,
    effectiveFrom:body.effectiveFrom,reason:body.reason,
    previousRateVersionId:previous.id}
  });
  return rate;
 });
}
