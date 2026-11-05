import type {FastifyInstance} from "fastify";
import {and,eq} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {leases,rooms} from "../db/schema.js";
import {AppError,requireActor} from "../security.js";
import {requirePropertyAdministrator} from "../services/property-administrator.js";
import {summarizeOccupancy} from "../services/occupancy-report.js";

const params=z.object({propertyId:z.uuid()});
const MAX_ROOMS=5000,MAX_ACTIVE_LEASES=10000;

/** Read-only property occupancy plus data-integrity reconciliation summary. */
export async function registerOccupancyReportRoutes(app:FastifyInstance):Promise<void>{
 app.get("/v1/properties/:propertyId/occupancy-report",async(req,reply)=>{
  reply.header("cache-control","no-store");
  const {propertyId}=params.parse(req.params);
  const actor=await requireActor(req);
  const property=await requirePropertyAdministrator(actor,propertyId);
  const report=await db.transaction(async(tx)=>{
   const allRooms=await tx.select({id:rooms.id,status:rooms.status})
    .from(rooms).where(and(eq(rooms.propertyId,property.id),
     eq(rooms.organizationId,property.organizationId)))
    .limit(MAX_ROOMS+1);
   if(allRooms.length>MAX_ROOMS)
    throw new AppError(409,"OCCUPANCY_REPORT_TOO_LARGE");
   const allLeases=await tx.select({roomId:leases.roomId}).from(leases)
    .where(and(eq(leases.propertyId,property.id),
     eq(leases.organizationId,property.organizationId),
     eq(leases.status,"ACTIVE"))).limit(MAX_ACTIVE_LEASES+1);
   if(allLeases.length>MAX_ACTIVE_LEASES)
    throw new AppError(409,"OCCUPANCY_REPORT_TOO_LARGE");
   try{return summarizeOccupancy(allRooms,allLeases);}
   catch{throw new AppError(409,"OCCUPANCY_DATA_INCONSISTENT");}
  },{isolationLevel:"repeatable read"});
  return {propertyId:property.id,...report,previewOnly:true};
 });
}
