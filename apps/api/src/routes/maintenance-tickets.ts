import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {AppError,requireActor,requireProperty} from "../security.js";
import {
 createOwnerMaintenanceTicket,createTenantMaintenanceTicket,
 enterRoomMaintenance,
 getScopedMaintenanceTicket,getTenantMaintenanceTicket,listPropertyMaintenanceTickets,listTenantMaintenanceTickets,summarizeMaintenanceSla,
 returnRoomFromMaintenance,updateMaintenanceTicket
} from "../services/maintenance-tickets.js";
import {addMaintenanceTicketAttachment,listMaintenanceTicketAttachments,readMaintenanceTicketAttachment,maintenanceAttachmentLimits} from "../services/maintenance-attachments.js";

export async function registerMaintenanceTicketRoutes(app:FastifyInstance){
 const tenantScope=async(actor:Awaited<ReturnType<typeof requireActor>>,ticketId:string)=>{
  const ticket=await getTenantMaintenanceTicket(actor.id,ticketId);
  if(!ticket) throw new AppError(404,"MAINTENANCE_TICKET_NOT_FOUND");
  return {ticketId,propertyId:ticket.propertyId,organizationId:ticket.organizationId,actorId:actor.id};
 };
 const propertyScope=async(actor:Awaited<ReturnType<typeof requireActor>>,propertyId:string,ticketId:string)=>{
  const property=await requireProperty(actor,propertyId);
  const ticket=await getScopedMaintenanceTicket(ticketId,property.id,property.organizationId);
  if(!ticket) throw new AppError(404,"MAINTENANCE_TICKET_NOT_FOUND");
  return {ticketId,propertyId:property.id,organizationId:property.organizationId,actorId:actor.id};
 };
 const attachmentParams=z.object({ticketId:z.uuid(),attachmentId:z.uuid()});
 app.post("/v1/tenant/maintenance-tickets/:ticketId/attachments",{config:{bodyLimit:Math.ceil(maintenanceAttachmentLimits.maxBytes*4/3)+4096,rateLimit:{max:5,timeWindow:"1 minute"}}},async(req,reply)=>{
  const actor=await requireActor(req);const {ticketId}=z.object({ticketId:z.uuid()}).parse(req.params);
  const result=await addMaintenanceTicketAttachment(await tenantScope(actor,ticketId),req.body);
  reply.header("cache-control","private, no-store");return result;
 });
 app.get("/v1/tenant/maintenance-tickets/:ticketId/attachments",async(req,reply)=>{
  const actor=await requireActor(req);const {ticketId}=z.object({ticketId:z.uuid()}).parse(req.params);
  reply.header("cache-control","private, no-store");return listMaintenanceTicketAttachments(await tenantScope(actor,ticketId));
 });
 app.get("/v1/tenant/maintenance-tickets/:ticketId/attachments/:attachmentId",async(req,reply)=>{
  const actor=await requireActor(req);const params=attachmentParams.parse(req.params);
  const file=await readMaintenanceTicketAttachment(await tenantScope(actor,params.ticketId),params.attachmentId);
  return reply.type(file.contentType).header("cache-control","private, no-store").header("x-content-type-options","nosniff").header("content-disposition","attachment; filename=maintenance-image.webp").send(file.content);
 });
 app.post("/v1/properties/:propertyId/maintenance-tickets/:ticketId/attachments",{config:{bodyLimit:Math.ceil(maintenanceAttachmentLimits.maxBytes*4/3)+4096,rateLimit:{max:5,timeWindow:"1 minute"}}},async(req,reply)=>{
  const actor=await requireActor(req);const params=z.object({propertyId:z.uuid(),ticketId:z.uuid()}).parse(req.params);
  const result=await addMaintenanceTicketAttachment(await propertyScope(actor,params.propertyId,params.ticketId),req.body);
  reply.header("cache-control","private, no-store");return result;
 });
 app.get("/v1/properties/:propertyId/maintenance-tickets/:ticketId/attachments",async(req,reply)=>{
  const actor=await requireActor(req);const params=z.object({propertyId:z.uuid(),ticketId:z.uuid()}).parse(req.params);
  reply.header("cache-control","private, no-store");return listMaintenanceTicketAttachments(await propertyScope(actor,params.propertyId,params.ticketId));
 });
 app.get("/v1/properties/:propertyId/maintenance-tickets/:ticketId/attachments/:attachmentId",async(req,reply)=>{
  const actor=await requireActor(req);const params=z.object({propertyId:z.uuid(),ticketId:z.uuid(),attachmentId:z.uuid()}).parse(req.params);
  const file=await readMaintenanceTicketAttachment(await propertyScope(actor,params.propertyId,params.ticketId),params.attachmentId);
  return reply.type(file.contentType).header("cache-control","private, no-store").header("x-content-type-options","nosniff").header("content-disposition","attachment; filename=maintenance-image.webp").send(file.content);
 });
 app.get("/v1/properties/:propertyId/maintenance-tickets/sla-report",async(req,reply)=>{
  const actor=await requireActor(req);
  const {propertyId}=z.object({propertyId:z.uuid()}).parse(req.params);
  const property=await requireProperty(actor,propertyId);
  const tickets=await listPropertyMaintenanceTickets(property.id,property.organizationId);
  reply.header("cache-control","private, no-store");
  return {generatedAt:new Date().toISOString(),...summarizeMaintenanceSla(tickets)};
 });
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
