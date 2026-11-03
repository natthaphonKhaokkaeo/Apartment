import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {requireActor,requireProperty} from "../security.js";
import {listMeterReplacements,replacePhysicalMeter} from "../services/meter-replacement.js";

const path=z.object({propertyId:z.uuid(),roomId:z.uuid()});
export async function registerMeterReplacementRoutes(app:FastifyInstance){
 app.get("/v1/properties/:propertyId/rooms/:roomId/meter-replacements",
  async(req,reply)=>{
   const actor=await requireActor(req);
   const {propertyId,roomId}=path.parse(req.params);
   const property=await requireProperty(actor,propertyId);
   reply.header("cache-control","private, no-store");
   return listMeterReplacements(property.id,property.organizationId,roomId);
  });
 app.post("/v1/properties/:propertyId/rooms/:roomId/meter-replacements",{
  config:{rateLimit:{max:10,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req);
  const {propertyId,roomId}=path.parse(req.params);
  await requireProperty(actor,propertyId,true);
  const body=z.object({roomId:z.uuid()}).passthrough().parse(req.body);
  if(body.roomId!==roomId)return reply.code(422).send({error:"METER_ROOM_SCOPE_MISMATCH"});
  const created=await replacePhysicalMeter(actor,propertyId,req.body);
  reply.header("cache-control","private, no-store");
  return reply.code(201).send(created);
 });
}
