import {and,desc,eq,gt,lt} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {auditLogs,invoices,memberships,properties,propertyRateVersions} from "../db/schema.js";
import type {Actor} from "../security.js";
import {AppError} from "../security.js";

type Cadence={cadence:"MONTHLY"|"SEMI_MONTHLY"|"EVERY_15_DAYS";rollingAnchor:string|null};
const dayPattern=/^\d{4}-\d{2}-\d{2}$/;
function isCalendarDay(value:string){
 return dayPattern.test(value)&&!Number.isNaN(Date.parse(value))&&
  new Date(value).toISOString().slice(0,10)===value;
}
export function bangkokToday(now=new Date()):string{
 const parts=new Intl.DateTimeFormat("en-GB",{
  timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"
 }).formatToParts(now);
 const part=(key:string)=>parts.find(p=>p.type===key)?.value??"";
 return [part("year"),part("month"),part("day")].join("-");
}
export function isRateBoundary(property:Cadence,day:string):boolean{
 if(!isCalendarDay(day))return false;
 if(property.cadence==="MONTHLY")return day.slice(8)==="01";
 if(property.cadence==="SEMI_MONTHLY")return ["01","16"].includes(day.slice(8));
 if(!property.rollingAnchor||!isCalendarDay(property.rollingAnchor)||
  day<property.rollingAnchor)return false;
 const diff=(Date.parse(day)-Date.parse(property.rollingAnchor))/86400_000;
 return Number.isInteger(diff)&&diff%15===0;
}
export function selectRateForPeriod<T extends {id:string;effectiveFrom:string}>(
 versions:T[],start:string,endExclusive:string):T{
 const eligible=versions.filter(v=>v.effectiveFrom<=start).sort(
  (a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom));
 if(!eligible.length)throw new AppError(409,"RATE_HISTORY_MISSING");
 if(versions.some(v=>v.effectiveFrom>start&&v.effectiveFrom<endExclusive))
  throw new AppError(422,"RATE_CHANGE_WITHIN_BILLING_PERIOD");
 return eligible[0];
}
export const rateChangeInput=z.object({
 effectiveFrom:z.iso.date(),
 rentSatang:z.number().int().min(0).max(2147483647),
 waterSatangPerUnit:z.number().int().min(0).max(2147483647),
 electricSatangPerUnit:z.number().int().min(0).max(2147483647),
 reason:z.string().trim().min(12).max(500)
}).strict();
type RateClient=Pick<typeof db,"select">;
export async function effectiveMasterRate(
 property:typeof properties.$inferSelect,start:string,endExclusive:string,
 client:RateClient=db
){
 const versions=await client.select().from(propertyRateVersions).where(and(
  eq(propertyRateVersions.propertyId,property.id),
  eq(propertyRateVersions.organizationId,property.organizationId),
  lt(propertyRateVersions.effectiveFrom,endExclusive)
 ));
 return selectRateForPeriod(versions,start,endExclusive);
}
export async function listPropertyRates(propertyId:string,organizationId:string){
 return db.select().from(propertyRateVersions).where(and(
  eq(propertyRateVersions.propertyId,propertyId),
  eq(propertyRateVersions.organizationId,organizationId)
 )).orderBy(desc(propertyRateVersions.effectiveFrom));
}
export async function schedulePropertyRate(
 actor:Actor,propertyId:string,raw:unknown,now=new Date()
){
 const body=rateChangeInput.parse(raw);
 return db.transaction(async tx=>{
  const [property]=await tx.select().from(properties)
   .where(eq(properties.id,propertyId)).for("update").limit(1);
  if(!property)throw new AppError(404,"PROPERTY_NOT_FOUND");
  const [member]=await tx.select({id:memberships.id}).from(memberships)
   .where(and(eq(memberships.organizationId,property.organizationId),
    eq(memberships.userId,actor.id),eq(memberships.status,"ACTIVE"),
    eq(memberships.role,"OWNER"))).limit(1);
  if(!member)throw new AppError(403,"PROPERTY_RATE_OWNER_REQUIRED");
  if(body.effectiveFrom<bangkokToday(now))
   throw new AppError(422,"RATE_BACKDATE_FORBIDDEN");
  if(!isRateBoundary(property,body.effectiveFrom))
   throw new AppError(422,"RATE_EFFECTIVE_DATE_NOT_PERIOD_START");
  if(!property.complianceReviewedAt||!property.complianceEvidenceRef||
   property.waterAllowedMax===null||property.electricAllowedMax===null)
   throw new AppError(409,"RATE_COMPLIANCE_REVIEW_REQUIRED");
  if(body.waterSatangPerUnit>property.waterAllowedMax||
   body.electricSatangPerUnit>property.electricAllowedMax)
   throw new AppError(422,"RATE_ABOVE_REVIEWED_LIMIT");
  const [latest]=await tx.select().from(propertyRateVersions).where(and(
   eq(propertyRateVersions.propertyId,property.id),
   eq(propertyRateVersions.organizationId,property.organizationId)
  )).orderBy(desc(propertyRateVersions.effectiveFrom)).limit(1);
  if(!latest)throw new AppError(409,"RATE_HISTORY_MISSING");
  if(body.effectiveFrom<=latest.effectiveFrom)
   throw new AppError(409,"RATE_EFFECTIVE_DATE_ALREADY_SCHEDULED");
  if(latest.rentSatang===body.rentSatang&&
   latest.waterSatangPerUnit===body.waterSatangPerUnit&&
   latest.electricSatangPerUnit===body.electricSatangPerUnit)
   throw new AppError(409,"RATE_UNCHANGED");
  const [alreadyIssued]=await tx.select({id:invoices.id}).from(invoices)
   .where(and(eq(invoices.propertyId,property.id),
    eq(invoices.organizationId,property.organizationId),
    eq(invoices.status,"ISSUED"),
    gt(invoices.periodEnd,body.effectiveFrom))).limit(1);
  if(alreadyIssued)throw new AppError(409,"RATE_ALREADY_ISSUED_FUTURE_BILLS");
  const [rate]=await tx.insert(propertyRateVersions).values({
   ...body,organizationId:property.organizationId,propertyId:property.id,
   createdBy:actor.id
  }).returning();
  await tx.insert(auditLogs).values({
   actorId:actor.id,organizationId:property.organizationId,
   action:"PROPERTY_RATE_SCHEDULED",targetId:rate.id,
   metadata:{propertyId:property.id,effectiveFrom:body.effectiveFrom,
    reason:body.reason,priorRateVersionId:latest.id}
  });
  return rate;
 });
}
