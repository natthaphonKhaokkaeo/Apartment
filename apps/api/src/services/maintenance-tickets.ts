import {and,desc,eq,notInArray} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {
 auditLogs,leases,maintenanceTickets,organizations,properties,rooms,users
} from "../db/schema.js";
import {AppError,type Actor} from "../security.js";

const categories=z.enum([
 "PLUMBING","ELECTRICAL","APPLIANCE","STRUCTURE","CLEANING","OTHER"
]);
const priorities=z.enum(["LOW","NORMAL","HIGH","URGENT"]);
const statuses=z.enum(["OPEN","ACKNOWLEDGED","IN_PROGRESS","RESOLVED","CLOSED","CANCELLED"]);
type Status=z.infer<typeof statuses>;
const transitions:Record<Status,readonly Status[]>={
 OPEN:["ACKNOWLEDGED","CANCELLED"],
 ACKNOWLEDGED:["IN_PROGRESS","CANCELLED"],
 IN_PROGRESS:["RESOLVED","CANCELLED"],
 RESOLVED:["IN_PROGRESS","CLOSED"],
 CLOSED:[],
 CANCELLED:[]
};

export function assertMaintenanceTransition(from:Status,to:Status):void{
 if(from!==to&&!transitions[from].includes(to))
  throw new AppError(409,"MAINTENANCE_TRANSITION_INVALID");
}
export function isMaintenanceTicketOverdue(
 dueAt:Date|null,status:Status,now=new Date()
):boolean{
 return dueAt!==null&&dueAt<now&&
  !["RESOLVED","CLOSED","CANCELLED"].includes(status);
}

const ownerCreate=z.object({
 roomId:z.uuid().optional().nullable(),
 title:z.string().trim().min(3).max(160),
 description:z.string().trim().min(3).max(4000),
 category:categories,
 priority:priorities.default("NORMAL"),
 dueAt:z.iso.datetime().optional().nullable()
});
const tenantCreate=z.object({
 title:z.string().trim().min(3).max(160),
 description:z.string().trim().min(3).max(4000),
 category:categories
});

function parseDueAt(value:string|null|undefined):Date|null{
 return value?new Date(value):null;
}

export async function createOwnerMaintenanceTicket(
 actor:Actor,propertyId:string,raw:unknown
){
 const body=ownerCreate.parse(raw);
 return db.transaction(async tx=>{
  const [property]=await tx.select().from(properties).where(eq(properties.id,propertyId))
   .for("share").limit(1);
  if(!property)throw new AppError(404,"PROPERTY_NOT_FOUND");
  let roomId=body.roomId??null;
  if(roomId){
   const [room]=await tx.select({id:rooms.id}).from(rooms).where(and(
    eq(rooms.id,roomId),eq(rooms.propertyId,property.id),
    eq(rooms.organizationId,property.organizationId))).for("share").limit(1);
   if(!room)throw new AppError(404,"ROOM_NOT_FOUND");
  }
  const [ticket]=await tx.insert(maintenanceTickets).values({
   organizationId:property.organizationId,propertyId:property.id,roomId,
   reportedByUserId:actor.id,reporterType:"OWNER",title:body.title,
   description:body.description,category:body.category,priority:body.priority,
   dueAt:parseDueAt(body.dueAt)
  }).returning();
  await tx.insert(auditLogs).values({
   actorId:actor.id,organizationId:property.organizationId,
   action:"MAINTENANCE_TICKET_CREATED",targetId:ticket.id,
   metadata:{propertyId:property.id,roomId,reporterType:"OWNER",priority:ticket.priority}
  });
  return ticket;
 });
}

export async function createTenantMaintenanceTicket(
 actor:Actor,leaseId:string,raw:unknown
){
 const body=tenantCreate.parse(raw);
 const [user]=await db.select({lineSubject:users.lineSubject}).from(users)
  .where(eq(users.id,actor.id)).limit(1);
 if(!user)throw new AppError(401,"UNAUTHENTICATED");
 const [scope]=await db.select({
  organizationId:leases.organizationId,propertyId:leases.propertyId
 }).from(leases).where(eq(leases.id,leaseId)).limit(1);
 if(!scope)throw new AppError(404,"TENANT_LEASE_NOT_FOUND");
 return db.transaction(async tx=>{
  // Match move-out's property -> lease lock order so a tenant submit cannot
  // deadlock with lease closure or slip in after the lease has ended.
  const [property]=await tx.select({id:properties.id})
   .from(properties).where(and(eq(properties.id,scope.propertyId),
    eq(properties.organizationId,scope.organizationId))).for("share").limit(1);
  if(!property)throw new AppError(404,"TENANT_LEASE_NOT_FOUND");
  const [lease]=await tx.select({
   id:leases.id,organizationId:leases.organizationId,propertyId:leases.propertyId,
   roomId:leases.roomId
  }).from(leases).where(and(eq(leases.id,leaseId),
   eq(leases.propertyId,scope.propertyId),
   eq(leases.organizationId,scope.organizationId),
   eq(leases.status,"ACTIVE"),eq(leases.tenantLineSubject,user.lineSubject)))
   .for("share").limit(1);
  if(!lease)throw new AppError(404,"TENANT_LEASE_NOT_FOUND");
  const [organization]=await tx.select({id:organizations.id})
   .from(organizations).where(and(eq(organizations.id,lease.organizationId),
    eq(organizations.status,"ACTIVE"))).for("share").limit(1);
  if(!organization)throw new AppError(404,"TENANT_LEASE_NOT_FOUND");
  const [ticket]=await tx.insert(maintenanceTickets).values({
   organizationId:lease.organizationId,propertyId:lease.propertyId,
   roomId:lease.roomId,leaseId:lease.id,reportedByUserId:actor.id,
   reporterType:"TENANT",title:body.title,description:body.description,
   category:body.category,priority:"NORMAL"
  }).returning();
  await tx.insert(auditLogs).values({
   actorId:actor.id,organizationId:lease.organizationId,
   action:"MAINTENANCE_TICKET_CREATED",targetId:ticket.id,
   metadata:{propertyId:lease.propertyId,roomId:lease.roomId,
    reporterType:"TENANT",priority:ticket.priority}
  });
  return ticket;
 });
}

export async function listPropertyMaintenanceTickets(propertyId:string,organizationId:string){
 const rows=await db.select({
  ticket:maintenanceTickets,roomNumber:rooms.number
 }).from(maintenanceTickets).leftJoin(rooms,eq(rooms.id,maintenanceTickets.roomId))
  .where(and(eq(maintenanceTickets.propertyId,propertyId),
   eq(maintenanceTickets.organizationId,organizationId)))
  .orderBy(desc(maintenanceTickets.createdAt)).limit(100);
 return rows.map(({ticket,roomNumber})=>({
  ...ticket,roomNumber,
  overdue:isMaintenanceTicketOverdue(ticket.dueAt,ticket.status)
 }));
}

export async function listTenantMaintenanceTickets(actor:Actor){
 return db.select().from(maintenanceTickets).where(and(
  eq(maintenanceTickets.reportedByUserId,actor.id),
  eq(maintenanceTickets.reporterType,"TENANT")
 )).orderBy(desc(maintenanceTickets.createdAt)).limit(100);
}

const updateInput=z.object({status:statuses});
export async function updateMaintenanceTicket(
 actor:Actor,propertyId:string,ticketId:string,raw:unknown
){
 const {status}=updateInput.parse(raw);
 return db.transaction(async tx=>{
  const [ticket]=await tx.select().from(maintenanceTickets).where(and(
   eq(maintenanceTickets.id,ticketId),eq(maintenanceTickets.propertyId,propertyId)
  )).for("update").limit(1);
  if(!ticket)throw new AppError(404,"MAINTENANCE_TICKET_NOT_FOUND");
  assertMaintenanceTransition(ticket.status,status);
  if(ticket.status===status)return ticket;
  const now=new Date();
  const [updated]=await tx.update(maintenanceTickets).set({
   status,updatedAt:now,
   resolvedAt:status==="RESOLVED"?now:
    ticket.status==="RESOLVED"&&status==="IN_PROGRESS"?null:ticket.resolvedAt,
   closedAt:status==="CLOSED"?now:null
  }).where(and(eq(maintenanceTickets.id,ticket.id),
   eq(maintenanceTickets.organizationId,ticket.organizationId))).returning();
  await tx.insert(auditLogs).values({
   actorId:actor.id,organizationId:ticket.organizationId,
   action:"MAINTENANCE_TICKET_STATUS_CHANGED",targetId:ticket.id,
   metadata:{from:ticket.status,to:updated.status,propertyId:ticket.propertyId}
  });
  return updated;
 });
}

export async function enterRoomMaintenance(
 actor:Actor,propertyId:string,roomId:string,raw:unknown
){
 const {reason}=z.object({
  reason:z.string().trim().min(8).max(500)
 }).parse(raw);
 return db.transaction(async tx=>{
  const [property]=await tx.select().from(properties).where(eq(properties.id,propertyId))
   .for("update").limit(1);
  if(!property)throw new AppError(404,"PROPERTY_NOT_FOUND");
  const [room]=await tx.select().from(rooms).where(and(eq(rooms.id,roomId),
   eq(rooms.propertyId,property.id),eq(rooms.organizationId,property.organizationId)))
   .for("update").limit(1);
  if(!room)throw new AppError(404,"ROOM_NOT_FOUND");
  if(room.status!=="AVAILABLE")throw new AppError(409,"ROOM_NOT_AVAILABLE_FOR_MAINTENANCE");
  const [activeLease]=await tx.select({id:leases.id}).from(leases).where(and(
   eq(leases.roomId,room.id),eq(leases.organizationId,property.organizationId),
   eq(leases.status,"ACTIVE"))).limit(1);
  if(activeLease)throw new AppError(409,"ROOM_HAS_ACTIVE_LEASE");
  const [updated]=await tx.update(rooms).set({status:"MAINTENANCE"})
   .where(and(eq(rooms.id,room.id),eq(rooms.status,"AVAILABLE"))).returning();
  if(!updated)throw new AppError(409,"ROOM_NOT_AVAILABLE_FOR_MAINTENANCE");
  await tx.insert(auditLogs).values({
   actorId:actor.id,organizationId:property.organizationId,
   action:"ROOM_MAINTENANCE_STARTED",targetId:room.id,
   metadata:{propertyId:property.id,reason}
  });
  return updated;
 });
}

export async function returnRoomFromMaintenance(
 actor:Actor,propertyId:string,roomId:string,raw:unknown
){
 z.object({confirmed:z.literal(true)}).parse(raw);
 return db.transaction(async tx=>{
  const [property]=await tx.select().from(properties).where(eq(properties.id,propertyId))
   .for("update").limit(1);
  if(!property)throw new AppError(404,"PROPERTY_NOT_FOUND");
  const [room]=await tx.select().from(rooms).where(and(eq(rooms.id,roomId),
   eq(rooms.propertyId,property.id),eq(rooms.organizationId,property.organizationId)))
   .for("update").limit(1);
  if(!room)throw new AppError(404,"ROOM_NOT_FOUND");
  if(room.status!=="MAINTENANCE")throw new AppError(409,"ROOM_NOT_IN_MAINTENANCE");
  const [activeLease]=await tx.select({id:leases.id}).from(leases).where(and(
   eq(leases.roomId,room.id),eq(leases.organizationId,property.organizationId),
   eq(leases.status,"ACTIVE"))).limit(1);
  if(activeLease)throw new AppError(409,"ROOM_HAS_ACTIVE_LEASE");
  const [openTicket]=await tx.select({id:maintenanceTickets.id})
   .from(maintenanceTickets).where(and(
    eq(maintenanceTickets.roomId,room.id),
    eq(maintenanceTickets.organizationId,property.organizationId),
    notInArray(maintenanceTickets.status,["CLOSED","CANCELLED"])
   )).limit(1);
  if(openTicket)throw new AppError(409,"ROOM_MAINTENANCE_TICKETS_OPEN");
  const [updated]=await tx.update(rooms).set({status:"AVAILABLE"})
   .where(and(eq(rooms.id,room.id),eq(rooms.status,"MAINTENANCE"))).returning();
  if(!updated)throw new AppError(409,"ROOM_NOT_IN_MAINTENANCE");
  await tx.insert(auditLogs).values({
   actorId:actor.id,organizationId:property.organizationId,
   action:"ROOM_MAINTENANCE_COMPLETED",targetId:room.id,
   metadata:{propertyId:property.id}
  });
  return updated;
 });
}

export const maintenanceTicketEnums={categories,priorities,statuses};
