import {and,eq,desc,lt,gt,lte} from "drizzle-orm";
import {readingToMilli} from "@apartment/domain";
import {db} from "../db/client.js";
import {organizations,users,memberships,properties,propertyStaffGrants,rooms,meterReadings,meterReplacements} from "../db/schema.js";
import {AppError,requireProperty,type Actor} from "../security.js";
import {assessMeterReadingAnomaly} from "./meter-anomaly.js";
export type MeterScope={propertyId:string;roomId:string};
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function withMeterScope<T>(actor:Actor,scope:MeterScope,mode:"read"|"write"|"owner",action:(tx:Tx,organizationId:string)=>Promise<T>){
 const property=await requireProperty(actor,scope.propertyId,mode==="read"?"STAFF_READ":mode==="write"?"METER_READING":true);
 return db.transaction(async tx=>{
  const [org]=await tx.select().from(organizations).where(and(eq(organizations.id,property.organizationId),eq(organizations.status,"ACTIVE"))).for("share");
  const [user]=await tx.select().from(users).where(and(eq(users.id,actor.id),eq(users.status,"ACTIVE"))).for("share");
  if(!org||!user)throw new AppError(403,"METER_SCOPE_INACTIVE");
  const [member]=await tx.select().from(memberships).where(and(eq(memberships.organizationId,org.id),eq(memberships.userId,actor.id),eq(memberships.status,"ACTIVE"))).for("share");
  if(mode==="owner"){
   if(user.platformRole!=="SUPER_ADMIN"&&member?.role!=="OWNER")throw new AppError(403,"METER_REVIEW_OWNER_REQUIRED");
  }else if(user.platformRole!=="SUPER_ADMIN"&&member?.role!=="OWNER"&&member?.role!=="MANAGER"){
   if(member?.role!=="STAFF")throw new AppError(403,"PROPERTY_ACCESS_DENIED");
   const [grant]=await tx.select().from(propertyStaffGrants).where(and(eq(propertyStaffGrants.organizationId,org.id),eq(propertyStaffGrants.propertyId,scope.propertyId),eq(propertyStaffGrants.userId,actor.id),eq(propertyStaffGrants.status,"ACTIVE"))).for("share");
   if(!grant||(mode==="write"&&grant.level!=="METER_READER"))throw new AppError(403,"PROPERTY_ACCESS_DENIED");
  }
  const [p]=await tx.select({id:properties.id}).from(properties).where(and(eq(properties.id,scope.propertyId),eq(properties.organizationId,org.id))).for("share");
  const [room]=await tx.select({id:rooms.id}).from(rooms).where(and(eq(rooms.id,scope.roomId),eq(rooms.propertyId,scope.propertyId),eq(rooms.organizationId,org.id))).for("share");
  if(!p||!room)throw new AppError(404,"ROOM_NOT_FOUND");
  return action(tx,org.id);
 });
}
export async function scopedMeterReading(tx:Tx,scope:MeterScope,readingId:string,organizationId:string){
 const [reading]=await tx.select().from(meterReadings).where(and(eq(meterReadings.id,readingId),eq(meterReadings.roomId,scope.roomId),eq(meterReadings.propertyId,scope.propertyId),eq(meterReadings.organizationId,organizationId))).for("update");
 if(!reading)throw new AppError(404,"METER_READING_NOT_FOUND");
 return reading;
}
export async function assessStoredMeterReading(tx:Tx,scope:MeterScope,reading:typeof meterReadings.$inferSelect,maxDailyMilli:number){
 const [previous]=await tx.select().from(meterReadings).where(and(eq(meterReadings.organizationId,reading.organizationId),eq(meterReadings.propertyId,scope.propertyId),eq(meterReadings.roomId,scope.roomId),eq(meterReadings.kind,reading.kind),lt(meterReadings.readAt,reading.readAt))).orderBy(desc(meterReadings.readAt)).limit(1);
 if(!previous)return {kind:"INSUFFICIENT_READINGS",requiresOwnerReview:true,readingId:reading.id,toDate:reading.readAt,maxDailyMilli};
 const [replacement]=await tx.select({id:meterReplacements.id}).from(meterReplacements).where(and(eq(meterReplacements.organizationId,reading.organizationId),eq(meterReplacements.propertyId,scope.propertyId),eq(meterReplacements.roomId,scope.roomId),eq(meterReplacements.kind,reading.kind),gt(meterReplacements.replacedAt,previous.readAt),lte(meterReplacements.replacedAt,reading.readAt))).limit(1);
 try{
  return {...assessMeterReadingAnomaly({previousMilli:readingToMilli(previous.value),currentMilli:readingToMilli(reading.value),days:(Date.parse(reading.readAt)-Date.parse(previous.readAt))/86400000,maxDailyMilli,physicalMeterChanged:!!replacement}),readingId:reading.id,previousReadingId:previous.id,fromDate:previous.readAt,toDate:reading.readAt,maxDailyMilli,replacementId:replacement?.id??null};
 }catch{throw new AppError(422,"INVALID_METER_REVIEW_THRESHOLD");}
}
