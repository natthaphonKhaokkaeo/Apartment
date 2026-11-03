import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {requireActor,requireProperty} from "../security.js";
import {listRoomRates,scheduleRoomRate} from "../services/room-rates.js";

const ids=z.object({propertyId:z.uuid(),roomId:z.uuid()});
export async function registerRoomRateRoutes(app:FastifyInstance){
 app.get("/v1/properties/:propertyId/rooms/:roomId/rates",async(req,reply)=>{
  const actor=await requireActor(req),{propertyId,roomId}=ids.parse(req.params);
  const property=await requireProperty(actor,propertyId);
  reply.header("cache-control","private, no-store");
  return listRoomRates(roomId,property.id,property.organizationId);
 });
 app.post("/v1/properties/:propertyId/rooms/:roomId/rates",{
  config:{rateLimit:{max:10,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req),{propertyId,roomId}=ids.parse(req.params);
  await requireProperty(actor,propertyId,true);
  const rate=await scheduleRoomRate(actor,propertyId,roomId,req.body);
  reply.header("cache-control","private, no-store");
  return reply.code(201).send(rate);
 });
}
