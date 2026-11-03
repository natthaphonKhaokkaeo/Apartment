import {and,eq} from "drizzle-orm";
import {parseDay,periodsForMonth,rollingPeriods,effectiveRate,rentForPeriod,readingToMilli,utilitySatang} from "@apartment/domain";
import {db} from "../db/client.js";
import {leases,meterReadings,properties,rooms} from "../db/schema.js";
import {AppError} from "../security.js";

type QueryDB = Pick<typeof db, "select">;
export type BillInput = {roomId:string; start:string; endExclusive:string};
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
export async function prepareInvoice(data:BillInput, property:typeof properties.$inferSelect, client:QueryDB=db) {
 if(!validBillingPeriod(property,data.start,data.endExclusive)) throw new AppError(422,"INVALID_BILLING_PERIOD");
 const [room] = await client.select().from(rooms).where(and(eq(rooms.id,data.roomId),eq(rooms.propertyId,property.id),eq(rooms.organizationId,property.organizationId))).limit(1);
 if(!room) throw new AppError(404,"ROOM_NOT_FOUND");
 const [lease] = await client.select().from(leases).where(and(eq(leases.roomId,room.id),eq(leases.propertyId,property.id),eq(leases.organizationId,property.organizationId),eq(leases.status,"ACTIVE"))).limit(1);
 if(!lease || lease.startDate > data.start || (lease.endDate && lease.endDate < data.endExclusive)) throw new AppError(422,"FULL_PERIOD_ACTIVE_LEASE_REQUIRED");
 const rateRent = effectiveRate(property.rentSatang,room.rentOverrideSatang);
 const rateWater = effectiveRate(property.waterSatangPerUnit,room.waterOverrideSatang);
 const rateElectric = effectiveRate(property.electricSatangPerUnit,room.electricOverrideSatang);
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
     snapshot:{start:prev.value,end:next.value,rateSatang:rate,startReadingId:prev.id,endReadingId:next.id}});
 }
 const rentSatang=rentForPeriod(rateRent,data.start,data.endExclusive);
 const lines=[{type:"RENT",description:"ค่าเช่าห้อง",unitsMilli:null,tariffSatang:null,amountSatang:rentSatang,
   snapshot:{monthlyRentSatang:rateRent,periodStart:data.start,periodEnd:data.endExclusive,rateSource:room.rentOverrideSatang===null?"MASTER":"OVERRIDE"}},...meterLines];
 const total=lines.reduce((sum,l)=>sum+l.amountSatang,0);
 if(!Number.isSafeInteger(total) || total > 2147483647) throw new AppError(422,"AMOUNT_OUT_OF_RANGE");
 return {room,lease,property,periodStart:data.start,periodEnd:data.endExclusive,lines,totalSatang:total};
}
