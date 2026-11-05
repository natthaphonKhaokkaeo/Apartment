import {and,desc,eq,gt} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {
 auditLogs,invoices,memberships,meterReadings,meterReplacements,properties,rooms
} from "../db/schema.js";
import {readingToMilli} from "@apartment/domain";
import {AppError,type Actor} from "../security.js";
import {bangkokToday} from "./property-rates.js";

type MeterSwitch={
 replacedAt:string;oldClosingMilli:number;newOpeningMilli:number
};
export function readingSegmentIndex(day:string,switches:Pick<MeterSwitch,"replacedAt">[]):number{
 return switches.filter(s=>s.replacedAt<=day).length;
}
/** Units in milli-units across arbitrary physical meter replacements.
 * ReplacedAt is the first day of the new meter. The end boundary
 * includes swaps at end date, and the new reading there is its opening.
 */
export function sumReplacedMeterUsage(
 startMilli:number,endMilli:number,switches:MeterSwitch[]
):number{
 if(!Number.isSafeInteger(startMilli)||startMilli<0||
  !Number.isSafeInteger(endMilli)||endMilli<0)
  throw new AppError(422,"METER_INVALID_READING");
 let current=startMilli,total=0,prior="";
 for(const s of switches){
  if(!s.replacedAt||s.replacedAt<=prior||
   ![s.oldClosingMilli,s.newOpeningMilli].every(v=>Number.isSafeInteger(v)&&v>=0)||
   s.oldClosingMilli<current)
   throw new AppError(422,"METER_REPLACEMENT_INCONSISTENT");
  total+=s.oldClosingMilli-current;
  current=s.newOpeningMilli;prior=s.replacedAt;
 }
 if(endMilli<current)throw new AppError(422,"METER_REPLACEMENT_INCONSISTENT");
 total+=endMilli-current;
 if(!Number.isSafeInteger(total))throw new AppError(422,"METER_UNIT_OVERFLOW");
 return total;
}

const serial=z.string().trim().min(3).max(100);
export const meterReplacementInput=z.object({
 roomId:z.uuid(),kind:z.enum(["WATER","ELECTRIC"]),replacedAt:z.iso.date(),
 oldSerial:serial,newSerial:serial,
 oldClosingValue:z.string().regex(/^\d{1,11}(\.\d{1,3})?$/),
 newOpeningValue:z.string().regex(/^\d{1,11}(\.\d{1,3})?$/),
 evidenceRef:z.string().trim().min(8).max(512),
 reason:z.string().trim().min(12).max(500)
}).strict();

export async function listMeterReplacements(
 propertyId:string,organizationId:string,roomId:string
){
 return db.select().from(meterReplacements).where(and(
  eq(meterReplacements.organizationId,organizationId),
  eq(meterReplacements.propertyId,propertyId),
  eq(meterReplacements.roomId,roomId)
 )).orderBy(desc(meterReplacements.replacedAt));
}

/** Append-only physical meter swap; does not touch historical readings/bills.
 * A synthetic new-meter opening reading is recorded on the replacement date.
 */
export async function replacePhysicalMeter(
 actor:Actor,propertyId:string,raw:unknown,now=new Date()
){
 const value=meterReplacementInput.parse(raw);
 if(value.oldSerial===value.newSerial)
  throw new AppError(422,"METER_SERIAL_UNCHANGED");
 if(value.replacedAt>bangkokToday(now))
  throw new AppError(422,"METER_REPLACEMENT_FUTURE_DATE");
 const oldClose=readingToMilli(value.oldClosingValue);
 const _newOpen=readingToMilli(value.newOpeningValue);
 return db.transaction(async tx=>{
  const [property]=await tx.select().from(properties)
   .where(eq(properties.id,propertyId)).for("update").limit(1);
  if(!property)throw new AppError(404,"PROPERTY_NOT_FOUND");
  const [owner]=await tx.select({id:memberships.id}).from(memberships)
   .where(and(eq(memberships.organizationId,property.organizationId),
    eq(memberships.userId,actor.id),eq(memberships.status,"ACTIVE"),
    eq(memberships.role,"OWNER"))).limit(1);
  if(!owner)throw new AppError(403,"METER_REPLACEMENT_OWNER_REQUIRED");
  const [room]=await tx.select({id:rooms.id}).from(rooms).where(and(
   eq(rooms.id,value.roomId),eq(rooms.propertyId,property.id),
   eq(rooms.organizationId,property.organizationId)
  )).for("update").limit(1);
  if(!room)throw new AppError(404,"ROOM_NOT_FOUND");
  const readings=await tx.select().from(meterReadings).where(and(
   eq(meterReadings.roomId,room.id),eq(meterReadings.kind,value.kind),
   eq(meterReadings.propertyId,property.id),
   eq(meterReadings.organizationId,property.organizationId)
  ));
  if(readings.some(r=>r.readAt>=value.replacedAt))
   throw new AppError(409,"METER_REPLACEMENT_CONFLICTS_WITH_READING");
  const lastReading=readings.sort((a,b)=>b.readAt.localeCompare(a.readAt))[0];
  if(!lastReading||readingToMilli(lastReading.value)>oldClose)
   throw new AppError(422,"METER_OLD_CLOSING_BELOW_LAST_READING");
  const [lastSwap]=await tx.select().from(meterReplacements).where(and(
   eq(meterReplacements.roomId,room.id),eq(meterReplacements.kind,value.kind)
  )).orderBy(desc(meterReplacements.replacedAt)).limit(1);
  if(lastSwap&&(lastSwap.replacedAt>=value.replacedAt||
   lastSwap.newSerial!==value.oldSerial))
   throw new AppError(409,"METER_SERIAL_CHAIN_INVALID");
  const [issued]=await tx.select({id:invoices.id}).from(invoices).where(and(
   eq(invoices.roomId,room.id),eq(invoices.organizationId,property.organizationId),
   eq(invoices.status,"ISSUED"),gt(invoices.periodEnd,value.replacedAt)
  )).limit(1);
  if(issued)throw new AppError(409,"METER_REPLACEMENT_AFTER_INVOICE_ISSUED");
  const [created]=await tx.insert(meterReplacements).values({
   ...value,propertyId:property.id,organizationId:property.organizationId,
   createdBy:actor.id
  }).returning();
  // The new meter's initial reading owns the replacement day's unique slot.
  const [opening]=await tx.insert(meterReadings).values({
   roomId:room.id,propertyId:property.id,
   organizationId:property.organizationId,kind:value.kind,
   readAt:value.replacedAt,value:value.newOpeningValue,createdBy:actor.id
  }).returning();
  await tx.insert(auditLogs).values({
   actorId:actor.id,organizationId:property.organizationId,
   action:"METER_REPLACED",targetId:created.id,
   metadata:{roomId:room.id,kind:value.kind,replacedAt:value.replacedAt,
    oldSerial:value.oldSerial,newSerial:value.newSerial,
    evidenceRef:value.evidenceRef,openingReadingId:opening.id}
  });
  return {replacement:created,openingReading:opening};
 });
}
