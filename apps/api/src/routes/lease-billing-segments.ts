import type {FastifyInstance} from "fastify";
import {and,eq} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {leases} from "../db/schema.js";
import {AppError,requireActor} from "../security.js";
import {requirePropertyAdministrator} from "../services/property-administrator.js";
import {planLeaseBillingSegments} from "../services/lease-billing-segments.js";

const params=z.object({propertyId:z.uuid(),leaseId:z.uuid()});
const query=z.object({endExclusive:z.iso.date()});

/** Scoped read-only billing boundary preview for an owner's lease.
 * A suggested schedule is not a charge, lease edit or invoice creation.
 */
export async function registerLeaseBillingSegmentsRoutes(app:FastifyInstance):Promise<void>{
 app.get("/v1/properties/:propertyId/leases/:leaseId/billing-segments",async(req,reply)=>{
  reply.header("cache-control","no-store");
  const {propertyId,leaseId}=params.parse(req.params);
  const {endExclusive}=query.parse(req.query);
  const actor=await requireActor(req);
  const property=await requirePropertyAdministrator(actor,propertyId);
  const [lease]=await db.select({
   id:leases.id,startDate:leases.startDate,endDate:leases.endDate,status:leases.status,
  }).from(leases).where(and(
   eq(leases.id,leaseId),eq(leases.propertyId,property.id),
   eq(leases.organizationId,property.organizationId),
  )).limit(1);
  if(!lease)throw new AppError(404,"LEASE_NOT_FOUND");
  if(lease.endDate&&endExclusive>lease.endDate)
   throw new AppError(422,"LEASE_TRANSITION_PAST_END");
  let segments;
  try{
   segments=planLeaseBillingSegments({
    cadence:property.cadence,rollingAnchor:property.rollingAnchor,
    leaseStart:lease.startDate,endExclusive,
   });
  }catch{
   throw new AppError(422,"INVALID_LEASE_TRANSITION");
  }
  return {leaseId:lease.id,status:lease.status,previewOnly:true,
   start:lease.startDate,endExclusive,segments};
 });
}
