import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {requireActor,requireProperty} from "../security.js";
import {
 createOwnerMaintenanceTicket,createTenantMaintenanceTicket,
 enterRoomMaintenance,
 listPropertyMaintenanceTickets,listTenantMaintenanceTickets,
 returnRoomFromMaintenance,updateMaintenanceTicket
} from "../services/maintenance-tickets.js";

export async function registerMaintenanceTicketRoutes(app:FastifyInstance){
 app.get("/v1/properties/:propertyId/maintenance-tickets",async(req,reply)=>{
  const actor=await requireActor(req);
  const {propertyId}=z.object({propertyId:z.uuid()}).parse(req.params);
  const property=await requireProperty(actor,propertyId);
  reply.header("cache-control","private, no-store");
  return listPropertyMaintenanceTickets(property.id,property.organizationId);
 });
 app.post("/v1/properties/:propertyId/maintenance-tickets",{
  config:{rateLimit:{max:20,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req);
  const {propertyId}=z.object({propertyId:z.uuid()}).parse(req.params);
  await requireProperty(actor,propertyId,true);
  const ticket=await createOwnerMaintenanceTicket(actor,propertyId,req.body);
  reply.header("cache-control","no-store");
  return reply.code(201).send(ticket);
 });
 app.patch("/v1/properties/:propertyId/maintenance-tickets/:ticketId",async(req,reply)=>{
  const actor=await requireActor(req);
  const {propertyId,ticketId}=z.object({
   propertyId:z.uuid(),ticketId:z.uuid()
  }).parse(req.params);
  await requireProperty(actor,propertyId,true);
  const ticket=await updateMaintenanceTicket(actor,propertyId,ticketId,req.body);
  reply.header("cache-control","no-store");
  return ticket;
 });
 app.post("/v1/properties/:propertyId/rooms/:roomId/maintenance/enter",async(req,reply)=>{
  const actor=await requireActor(req);
  const {propertyId,roomId}=z.object({
   propertyId:z.uuid(),roomId:z.uuid()
  }).parse(req.params);
  await requireProperty(actor,propertyId,true);
  const room=await enterRoomMaintenance(actor,propertyId,roomId,req.body);
  reply.header("cache-control","no-store");
  return room;
 });
 app.post("/v1/properties/:propertyId/rooms/:roomId/maintenance/return",async(req,reply)=>{
  const actor=await requireActor(req);
  const {propertyId,roomId}=z.object({
   propertyId:z.uuid(),roomId:z.uuid()
  }).parse(req.params);
  await requireProperty(actor,propertyId,true);
  const room=await returnRoomFromMaintenance(actor,propertyId,roomId,req.body);
  reply.header("cache-control","no-store");
  return room;
 });
 app.get("/v1/tenant/maintenance-tickets",async(req,reply)=>{
  const actor=await requireActor(req);
  reply.header("cache-control","private, no-store");
  return listTenantMaintenanceTickets(actor);
 });
 app.post("/v1/tenant/leases/:leaseId/maintenance-tickets",{
  config:{rateLimit:{max:10,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req);
  const {leaseId}=z.object({leaseId:z.uuid()}).parse(req.params);
  const ticket=await createTenantMaintenanceTicket(actor,leaseId,req.body);
  reply.header("cache-control","no-store");
  return reply.code(201).send(ticket);
 });
}
