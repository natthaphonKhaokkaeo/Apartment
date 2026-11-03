import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {requireActor,requireProperty} from "../security.js";
import {listPropertyRates,schedulePropertyRate} from "../services/property-rates.js";

const routeParams=z.object({propertyId:z.uuid()});
export async function registerPropertyRateRoutes(app:FastifyInstance){
 app.get("/v1/properties/:propertyId/rates",async(req,reply)=>{
  const actor=await requireActor(req);
  const {propertyId}=routeParams.parse(req.params);
  const property=await requireProperty(actor,propertyId);
  reply.header("cache-control","private, no-store");
  return listPropertyRates(property.id,property.organizationId);
 });
 app.post("/v1/properties/:propertyId/rates",{
  config:{rateLimit:{max:10,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req);
  const {propertyId}=routeParams.parse(req.params);
  await requireProperty(actor,propertyId,true);
  const version=await schedulePropertyRate(actor,propertyId,req.body);
  reply.header("cache-control","private, no-store");
  return reply.code(201).send(version);
 });
}
