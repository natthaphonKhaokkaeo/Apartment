import {and,eq} from "drizzle-orm";
import {parseDay,periodsForMonth,rollingPeriods,effectiveRate,rentForPeriod,readingToMilli,utilitySatang} from "@apartment/domain";
import {db} from "../db/client.js";
import {leases,meterReadings,properties,rooms} from "../db/schema.js";
import {AppError} from "../security.js";
import {effectiveMasterRate} from "./property-rates.js";
import {effectiveRoomRate} from "./room-rates.js";

type QueryDB = Pick<typeof db, "select">;
export type BillInput = {roomId:string; start:string; endExclusive:string;partialMode?:"MOVE_IN"};
export function validBillingPeriod(property:typeof properties.$inferSelect, start:string,endExclusive:string):boolean {
 const startDate = parseDay(start),endDate = parseDay(endExclusive);
 if(startDate >= endDate) return false;
 if(property.cadence === "EVERY_15_DAYS") {
   if(!property.rollingAnchor || start < property.rollingAnchor) return false;
   const diff = Math.round((+startDate - +parseDay(property.rollingAnchor))/86400000);
   return diff % 15 === 0 && (+endDate - +startDate) / 86400000 === 15;
 }
 const candidate = periodsForMonth(startDate.getUTCFullYear(),startDate.getUTCMonth()+1,property.cadence);
 return candidate.some(p=>p.start===start && p.endExclusive===endExclusive);
}
/** Partial first invoice is permitted ONLY from actual lease start to the
 * end of its canonical billing interval. Never permit arbitrary intervals.
 */
export function validMoveInPartialPeriod(
 property:Pick<typeof properties.$inferSelect,"cadence"|"rollingAnchor">,
 leaseStart:string,start:string,endExclusive:string
):boolean{
 if(start!==leaseStart)return false;
 try{
  const from=parseDay(start),to=parseDay(endExclusive);
  if(!(from<to))return false;
  if(property.cadence==="EVERY_15_DAYS"){
   if(!property.rollingAnchor||start<property.rollingAnchor)return false;
   const diff=Math.floor((+from-+parseDay(property.rollingAnchor))/86400_000);
   const i=Math.floor(diff/15),anchorMs=+parseDay(property.rollingAnchor);
   const periodStart=new Date(anchorMs+i*15*86400_000).toISOString().slice(0,10);
   const periodEnd=new Date(anchorMs+(i+1)*15*86400_000).toISOString().slice(0,10);
   return start>periodStart&&endExclusive===periodEnd;
  }
  const candidate=periodsForMonth(from.getUTCFullYear(),from.getUTCMonth()+1,
   property.cadence).find(p=>p.start<start&&start<p.endExclusive);
  return !!candidate&&candidate.endExclusive===endExclusive;
 }catch{return false;}
}
export async function prepareInvoice(data:BillInput, property:typeof properties.$inferSelect, client:QueryDB=db) {
 if(data.partialMode===undefined&&!validBillingPeriod(property,data.start,data.endExclusive))
  throw new AppError(422,"INVALID_BILLING_PERIOD");
 const [room] = await client.select().from(rooms).where(and(eq(rooms.id,data.roomId),eq(rooms.propertyId,property.id),eq(rooms.organizationId,property.organizationId))).limit(1);
 if(!room) throw new AppError(404,"ROOM_NOT_FOUND");
 const [lease] = await client.select().from(leases).where(and(eq(leases.roomId,room.id),eq(leases.propertyId,property.id),eq(leases.organizationId,property.organizationId),eq(leases.status,"ACTIVE"))).limit(1);
 if(!lease||lease.startDate>data.start||
  (lease.endDate&&lease.endDate<data.endExclusive))
  throw new AppError(422,"FULL_PERIOD_ACTIVE_LEASE_REQUIRED");
 if(data.partialMode==="MOVE_IN"&&!validMoveInPartialPeriod(
  property,lease.startDate,data.start,data.endExclusive))
  throw new AppError(422,"INVALID_MOVE_IN_PARTIAL_PERIOD");
 // The rate effective at the billing period START owns this whole interval.
 // A mid-period scheduled revision is rejected until P1-03 supports prorating.
 const master=await effectiveMasterRate(property,data.start,data.endExclusive,client);
 const roomVersion=await effectiveRoomRate(room,data.start,data.endExclusive,client);
 const rateRent = effectiveRate(master.rentSatang,roomVersion.rentOverrideSatang);
 const rateWater = effectiveRate(master.waterSatangPerUnit,roomVersion.waterOverrideSatang);
 const rateElectric = effectiveRate(master.electricSatangPerUnit,roomVersion.electricOverrideSatang);
 if(!property.complianceReviewedAt || !property.complianceEvidenceRef ||
   property.waterAllowedMax === null || property.electricAllowedMax === null) throw new AppError(422,"COMPLIANCE_REVIEW_REQUIRED");
 if(rateWater>property.waterAllowedMax || rateElectric>property.electricAllowedMax) throw new AppError(422,"TARIFF_ABOVE_REVIEWED_LIMIT");
 const meterLines = [];
 for(const [kind,rate] of [["WATER",rateWater],["ELECTRIC",rateElectric]] as const){
   const readings = await client.select().from(meterReadings)
    .where(and(eq(meterReadings.roomId,room.id),eq(meterReadings.propertyId,property.id),eq(meterReadings.kind,kind)));
   const prev=readings.find(r=>r.readAt===data.start),next=readings.find(r=>r.readAt===data.endExclusive);
   if(!prev || !next) throw new AppError(422,"METER_BOUNDARY_READING_REQUIRED");
   const startMilli=readingToMilli(prev.value),endMilli=readingToMilli(next.value);
   const amountSatang=utilitySatang(startMilli,endMilli,rate);
   meterLines.push({type:kind,description:kind==="WATER"?"ค่าน้ำ":"ค่าไฟ",unitsMilli:endMilli-startMilli,tariffSatang:rate,amountSatang,
     snapshot:{start:prev.value,end:next.value,rateSatang:rate,
      masterRateVersionId:master.id,masterEffectiveFrom:master.effectiveFrom,
      roomRateVersionId:roomVersion.id,roomRateEffectiveFrom:roomVersion.effectiveFrom,
      rateSource:(kind==="WATER"?roomVersion.waterOverrideSatang:roomVersion.electricOverrideSatang)===null?"MASTER":"OVERRIDE",
      startReadingId:prev.id,endReadingId:next.id}});
 }
 const rentSatang=rentForPeriod(rateRent,data.start,data.endExclusive);
 const lines=[{type:"RENT",description:"ค่าเช่าห้อง",unitsMilli:null,tariffSatang:null,amountSatang:rentSatang,
   snapshot:{monthlyRentSatang:rateRent,periodStart:data.start,periodEnd:data.endExclusive,
    partialMode:data.partialMode??null,
    masterRateVersionId:master.id,masterEffectiveFrom:master.effectiveFrom,
    roomRateVersionId:roomVersion.id,roomRateEffectiveFrom:roomVersion.effectiveFrom,
    rateSource:roomVersion.rentOverrideSatang===null?"MASTER":"OVERRIDE"}},...meterLines];
 const total=lines.reduce((sum,l)=>sum+l.amountSatang,0);
 if(!Number.isSafeInteger(total) || total > 2147483647) throw new AppError(422,"AMOUNT_OUT_OF_RANGE");
 return {room,lease,property,periodStart:data.start,periodEnd:data.endExclusive,lines,totalSatang:total};
}
