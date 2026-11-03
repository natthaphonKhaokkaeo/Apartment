import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {requireActor,requireProperty} from "../security.js";
import {moveOutLease} from "../services/lease-lifecycle.js";

export async function registerLeaseLifecycleRoutes(app:FastifyInstance){
 app.post("/v1/properties/:propertyId/leases/:leaseId/move-out",{
  config:{rateLimit:{max:10,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req);
  const {propertyId}=z.object({propertyId:z.uuid()}).parse(req.params);
  await requireProperty(actor,propertyId,true);
  const outcome=await moveOutLease(actor,req.params,req.body);
  reply.header("cache-control","no-store");
  return outcome;
 });
}
