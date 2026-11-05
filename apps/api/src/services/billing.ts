import {and,eq,gt,lte,asc} from "drizzle-orm";
import {parseDay,periodsForMonth,effectiveRate,rentForPeriod,readingToMilli,utilitySatang} from "@apartment/domain";
import {db} from "../db/client.js";
import {leases,meterReadings,meterReplacements,properties,rooms} from "../db/schema.js";
import {AppError} from "../security.js";
import {bangkokToday,effectiveMasterRate} from "./property-rates.js";
import {effectiveRoomRate} from "./room-rates.js";
import {sumReplacedMeterUsage} from "./meter-replacement.js";

type QueryDB = Pick<typeof db, "select">;
export type BillInput = {roomId:string; start:string; endExclusive:string;partialMode?:"MOVE_IN"|"MOVE_OUT"};
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
/** Final bill must cover exactly the occupied part of one canonical cycle
 * and may be issued only on/after the physical handover date.
 * It does not end the lease or write off unpaid amounts.
 */
export function validMoveOutPartialPeriod(
 property:Pick<typeof properties.$inferSelect,"cadence"|"rollingAnchor">,
 leaseStart:string,start:string,endExclusive:string,now=new Date()
):boolean{
 try{
  const from=parseDay(start),to=parseDay(endExclusive);
  if(!(from<to)||start<leaseStart||endExclusive>bangkokToday(now))return false;
  let period:{start:string;endExclusive:string}|undefined;
  if(property.cadence==="EVERY_15_DAYS"){
   if(!property.rollingAnchor||start<property.rollingAnchor)return false;
   const anchor=+parseDay(property.rollingAnchor);
   const offset=Math.floor((+from-anchor)/86400_000/15);
   period={
    start:new Date(anchor+offset*15*86400_000).toISOString().slice(0,10),
    endExclusive:new Date(anchor+(offset+1)*15*86400_000).toISOString().slice(0,10)
   };
  }else{
   period=periodsForMonth(from.getUTCFullYear(),from.getUTCMonth()+1,
    property.cadence).find(p=>p.start<=start&&start<p.endExclusive);
  }
  return !!period&&endExclusive<period.endExclusive&&
   (start===period.start||start===leaseStart);
 }catch{return false;}
}
/** Database stores invoice amounts and units_milli as signed PostgreSQL INTEGER.
 * Validate both the value and every line BEFORE the issuance transaction inserts.
 * Zero-cost utilities can still overflow units_milli without affecting the total.
 */
export function assertInvoiceStorageBounds(
 lines:ReadonlyArray<{amountSatang:number;unitsMilli:number|null}>,
 totalSatang:number
):void{
 const int32=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=2_147_483_647;
 if(lines.some(l=>l.unitsMilli!==null&&!int32(l.unitsMilli)))
  throw new AppError(422,"METER_USAGE_OUT_OF_RANGE");
 if(!int32(totalSatang)||lines.some(l=>!int32(l.amountSatang))||
    lines.reduce((sum,l)=>sum+BigInt(l.amountSatang),0n)!==BigInt(totalSatang))
  throw new AppError(422,"AMOUNT_OUT_OF_RANGE");
}
export function invoiceUtilityAmount(consumedMilli:number,rateSatang:number):number{
 try{return utilitySatang(0,consumedMilli,rateSatang);}
 catch(error){
  // utilitySatang rejects totals beyond JS safe integer before the
  // PostgreSQL INTEGER storage guard can map them to a client error.
  if(error instanceof Error&&error.message==="MONEY_OVERFLOW")
   throw new AppError(422,"AMOUNT_OUT_OF_RANGE");
  throw error;
 }
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
 if(data.partialMode==="MOVE_OUT"&&!validMoveOutPartialPeriod(
  property,lease.startDate,data.start,data.endExclusive))
  throw new AppError(422,"INVALID_MOVE_OUT_PARTIAL_PERIOD");
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
   const swaps=await client.select().from(meterReplacements).where(and(
    eq(meterReplacements.roomId,room.id),
    eq(meterReplacements.organizationId,property.organizationId),
    eq(meterReplacements.propertyId,property.id),
    eq(meterReplacements.kind,kind),
    gt(meterReplacements.replacedAt,data.start),
    lte(meterReplacements.replacedAt,data.endExclusive)
   )).orderBy(asc(meterReplacements.replacedAt));
   const consumedMilli=sumReplacedMeterUsage(startMilli,endMilli,swaps.map(s=>({
    replacedAt:s.replacedAt,oldClosingMilli:readingToMilli(s.oldClosingValue),
    newOpeningMilli:readingToMilli(s.newOpeningValue)
   })));
   const amountSatang=invoiceUtilityAmount(consumedMilli,rate);
   meterLines.push({type:kind,description:kind==="WATER"?"ค่าน้ำ":"ค่าไฟ",unitsMilli:consumedMilli,tariffSatang:rate,amountSatang,
     snapshot:{start:prev.value,end:next.value,rateSatang:rate,
      masterRateVersionId:master.id,masterEffectiveFrom:master.effectiveFrom,
      roomRateVersionId:roomVersion.id,roomRateEffectiveFrom:roomVersion.effectiveFrom,
      rateSource:(kind==="WATER"?roomVersion.waterOverrideSatang:roomVersion.electricOverrideSatang)===null?"MASTER":"OVERRIDE",
      startReadingId:prev.id,endReadingId:next.id,
      meterReplacementIds:swaps.map(s=>s.id),
      meterSegments:swaps.map(s=>({
       replacementId:s.id,replacedAt:s.replacedAt,
       oldSerial:s.oldSerial,newSerial:s.newSerial,
       oldClosingValue:s.oldClosingValue,newOpeningValue:s.newOpeningValue
      }))}});
 }
 const rentSatang=rentForPeriod(rateRent,data.start,data.endExclusive);
 const lines=[{type:"RENT",description:"ค่าเช่าห้อง",unitsMilli:null,tariffSatang:null,amountSatang:rentSatang,
   snapshot:{monthlyRentSatang:rateRent,periodStart:data.start,periodEnd:data.endExclusive,
    partialMode:data.partialMode??null,
    masterRateVersionId:master.id,masterEffectiveFrom:master.effectiveFrom,
    roomRateVersionId:roomVersion.id,roomRateEffectiveFrom:roomVersion.effectiveFrom,
    rateSource:roomVersion.rentOverrideSatang===null?"MASTER":"OVERRIDE"}},...meterLines];
 const total=lines.reduce((sum,l)=>sum+l.amountSatang,0);
 assertInvoiceStorageBounds(lines,total);
 return {room,lease,property,periodStart:data.start,periodEnd:data.endExclusive,lines,totalSatang:total};
}
