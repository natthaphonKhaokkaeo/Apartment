import type {FastifyInstance} from "fastify";
import {and,desc,eq,gt,lte} from "drizzle-orm";
import {z} from "zod";
import {readingToMilli} from "@apartment/domain";
import {db} from "../db/client.js";
import {meterReadings,meterReplacements,rooms} from "../db/schema.js";
import {AppError,requireActor,requireProperty} from "../security.js";
import {assessMeterReadingAnomaly} from "../services/meter-anomaly.js";

const params=z.object({
 propertyId:z.uuid(),roomId:z.uuid(),kind:z.enum(["WATER","ELECTRIC"]),
});
const querySchema=z.object({
 maxDailyMilli:z.coerce.number().int().min(1).max(99999999999999),
});

/** Non-mutating meter anomaly preview, not an invoice engine.
 * The threshold is owner/operator supplied and must be reviewed separately.
 */
export async function registerMeterAnomalyPreviewRoutes(app:FastifyInstance):Promise<void>{
 app.get("/v1/properties/:propertyId/rooms/:roomId/meter-anomalies/:kind",
  async(req,reply)=>{
   reply.header("cache-control","no-store");
   const {propertyId,roomId,kind}=params.parse(req.params);
   const {maxDailyMilli}=querySchema.parse(req.query);
   const actor=await requireActor(req);
   const property=await requireProperty(actor,propertyId,"STAFF_READ");
   const [room]=await db.select({id:rooms.id}).from(rooms).where(and(
    eq(rooms.id,roomId),
    eq(rooms.propertyId,property.id),
    eq(rooms.organizationId,property.organizationId),
   )).limit(1);
   if(!room)throw new AppError(404,"ROOM_NOT_FOUND");
   const readings=await db.select({readAt:meterReadings.readAt,value:meterReadings.value})
    .from(meterReadings).where(and(
     eq(meterReadings.roomId,room.id),
     eq(meterReadings.propertyId,property.id),
     eq(meterReadings.organizationId,property.organizationId),
     eq(meterReadings.kind,kind),
    )).orderBy(desc(meterReadings.readAt)).limit(2);
   if(readings.length<2)return {kind:"INSUFFICIENT_READINGS",usageMilli:null,
    requiresOwnerReview:true,readingsCount:readings.length};
   const [newer,older]=readings;
   const days=(Date.parse(newer.readAt)-Date.parse(older.readAt))/86400000;
   const [replacement]=await db.select({id:meterReplacements.id})
    .from(meterReplacements).where(and(
     eq(meterReplacements.roomId,room.id),
     eq(meterReplacements.propertyId,property.id),
     eq(meterReplacements.organizationId,property.organizationId),
     eq(meterReplacements.kind,kind),
     gt(meterReplacements.replacedAt,older.readAt),
     lte(meterReplacements.replacedAt,newer.readAt),
    )).limit(1);
   const assessment=assessMeterReadingAnomaly({
    previousMilli:readingToMilli(older.value),
    currentMilli:readingToMilli(newer.value),
    days,
    maxDailyMilli,
    physicalMeterChanged:!!replacement,
   });
   return {...assessment,readingsCount:2,fromDate:older.readAt,toDate:newer.readAt};
  },
 );
}
