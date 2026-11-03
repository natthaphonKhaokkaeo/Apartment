import type {FastifyInstance} from "fastify";
import {and,eq,desc,isNull,gt} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {auditLogs,invoiceLines,invoices,leaseInvitations,leases,organizations,properties,rooms,users} from "../db/schema.js";
import {AppError,requireActor,requireProperty} from "../security.js";
import {generateLeaseInvite,hashLeaseInvite,inviteExpiry} from "../services/invitations.js";

const uuid=z.uuid();
const propertyLeaseParams=z.object({propertyId:uuid,leaseId:uuid});
const approvalParams=propertyLeaseParams.extend({inviteId:uuid});

async function getLease(propertyId:string,leaseId:string){
 const [lease]=await db.select().from(leases).where(and(eq(leases.propertyId,propertyId),eq(leases.id,leaseId))).limit(1);
 if(!lease) throw new AppError(404,"LEASE_NOT_FOUND");
 return lease;
}
async function subjectFor(actorId:string):Promise<string>{
 const [user]=await db.select({lineSubject:users.lineSubject}).from(users).where(and(eq(users.id,actorId),eq(users.status,"ACTIVE"))).limit(1);
 if(!user)throw new AppError(401,"UNAUTHENTICATED");
 return user.lineSubject;
}
function invalidInvite():never{throw new AppError(404,"INVITATION_NOT_FOUND");}

export async function registerTenantRoutes(app:FastifyInstance):Promise<void>{
 // Creator must be an authorized owner/manager of the real property (not a client-controlled organization).
 app.post("/v1/properties/:propertyId/leases/:leaseId/invitations",async(req,reply)=>{
  const {propertyId,leaseId}=propertyLeaseParams.parse(req.params);
  const actor=await requireActor(req);
  const property=await requireProperty(actor,propertyId,true);
  const {token,hash}=generateLeaseInvite();
  const expiresAt=inviteExpiry();
  const invitation=await db.transaction(async tx=>{
   const [lease]=await tx.select().from(leases).where(and(eq(leases.id,leaseId),eq(leases.propertyId,property.id),eq(leases.organizationId,property.organizationId))).for("update");
   if(!lease)throw new AppError(404,"LEASE_NOT_FOUND");
   if(lease.status!=="ACTIVE" || lease.tenantLineSubject!==null)throw new AppError(409,"LEASE_NOT_INVITABLE");
   // Supersede all prior claims and invitations that have not been approved.
   await tx.update(leaseInvitations).set({revokedAt:new Date()}).where(and(eq(leaseInvitations.leaseId,lease.id),isNull(leaseInvitations.approvedAt),isNull(leaseInvitations.revokedAt)));
   const [created]=await tx.insert(leaseInvitations).values({
    organizationId:property.organizationId,propertyId:property.id,leaseId:lease.id,
    tokenHash:hash,expiresAt,createdBy:actor.id
   }).returning({id:leaseInvitations.id,expiresAt:leaseInvitations.expiresAt});
   await tx.insert(auditLogs).values({actorId:actor.id,organizationId:property.organizationId,action:"TENANT_INVITE_ISSUED",targetId:created.id,
    metadata:{leaseId:lease.id,expiresAt:expiresAt.toISOString()}});
   return created;
  });
  reply.header("cache-control","no-store");
  return reply.code(201).send({...invitation,token,approvalRequired:true});
 });

 // Owner sees pending claimant identity and can approve or revoke. Never return a token hash.
 app.get("/v1/properties/:propertyId/leases/:leaseId/invitations",async req=>{
  const {propertyId,leaseId}=propertyLeaseParams.parse(req.params);
  const actor=await requireActor(req), property=await requireProperty(actor,propertyId);
  const lease=await getLease(propertyId,leaseId);
  if(lease.organizationId!==property.organizationId)throw new AppError(404,"LEASE_NOT_FOUND");
  return db.select({id:leaseInvitations.id,expiresAt:leaseInvitations.expiresAt,
   createdAt:leaseInvitations.createdAt,claimedAt:leaseInvitations.claimedAt,
   approvedAt:leaseInvitations.approvedAt,revokedAt:leaseInvitations.revokedAt,
   claimantName:users.displayName})
   .from(leaseInvitations).leftJoin(users,eq(users.id,leaseInvitations.claimedBy))
   .where(and(eq(leaseInvitations.leaseId,lease.id),eq(leaseInvitations.organizationId,property.organizationId)))
   .orderBy(desc(leaseInvitations.createdAt)).limit(20);
 });

 app.post("/v1/properties/:propertyId/leases/:leaseId/invitations/:inviteId/revoke",async req=>{
  const {propertyId,leaseId,inviteId}=approvalParams.parse(req.params);
  const actor=await requireActor(req),property=await requireProperty(actor,propertyId,true);
  const result=await db.transaction(async tx=>{
   const [lease]=await tx.select().from(leases).where(and(eq(leases.id,leaseId),eq(leases.propertyId,property.id),eq(leases.organizationId,property.organizationId))).for("update");
   if(!lease)throw new AppError(404,"LEASE_NOT_FOUND");
   const [inv]=await tx.select().from(leaseInvitations).where(and(eq(leaseInvitations.id,inviteId),eq(leaseInvitations.leaseId,lease.id))).for("update");
   if(!inv)throw new AppError(404,"INVITATION_NOT_FOUND");
   if(inv.approvedAt)throw new AppError(409,"INVITATION_ALREADY_APPROVED");
   if(inv.revokedAt)return {revoked:true};
   await tx.update(leaseInvitations).set({revokedAt:new Date()}).where(eq(leaseInvitations.id,inv.id));
   await tx.insert(auditLogs).values({actorId:actor.id,organizationId:property.organizationId,action:"TENANT_INVITE_REVOKED",targetId:inv.id,metadata:{leaseId:lease.id}});
   return {revoked:true};
  });
  return result;
 });

 // "Claim" does not grant bill access. Owner must explicitly approve the LINE account that claimed the code.
 app.post("/v1/tenant/invitations/claim",{
  config:{rateLimit:{max:10,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req);
  const {token}=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).parse(req.body);
  const hash=hashLeaseInvite(token);
  const subject=await subjectFor(actor.id);
  const result=await db.transaction(async tx=>{
   // Read hash lookup, then lock lease first and invitation second.
   // The same lock order is used by owner approval, revoke, and invite regeneration.
   const [candidate]=await tx.select().from(leaseInvitations).where(eq(leaseInvitations.tokenHash,hash)).limit(1);
   if(!candidate)invalidInvite();
   const [lease]=await tx.select().from(leases).where(and(eq(leases.id,candidate.leaseId),eq(leases.organizationId,candidate.organizationId),eq(leases.propertyId,candidate.propertyId))).for("update");
   const [invite]=await tx.select().from(leaseInvitations).where(eq(leaseInvitations.id,candidate.id)).for("update");
   if(!invite || invite.revokedAt || invite.claimedAt || invite.approvedAt || invite.expiresAt<=new Date())invalidInvite();
   if(!lease || lease.status!=="ACTIVE" || lease.tenantLineSubject)invalidInvite();
   const [owner]=await tx.select().from(organizations).where(and(eq(organizations.id,invite.organizationId),eq(organizations.status,"ACTIVE")));
   const [property]=await tx.select().from(properties).where(and(eq(properties.id,invite.propertyId),eq(properties.organizationId,invite.organizationId)));
   if(!owner || !property)invalidInvite();
   // A claimant can have any LINE account, but owner approval protects against misdirected/stolen codes.
   const [updated]=await tx.update(leaseInvitations).set({claimedAt:new Date(),claimedBy:actor.id})
    .where(and(eq(leaseInvitations.id,invite.id),isNull(leaseInvitations.claimedAt),isNull(leaseInvitations.revokedAt))).returning({id:leaseInvitations.id});
   if(!updated)invalidInvite();
   await tx.insert(auditLogs).values({actorId:actor.id,organizationId:invite.organizationId,action:"TENANT_INVITE_CLAIMED",targetId:invite.id,
    metadata:{leaseId:lease.id}});
   return {invitationId:invite.id,status:"PENDING_OWNER_APPROVAL" as const};
  });
  reply.header("cache-control","no-store");
  return reply.code(202).send(result);
 });

 app.post("/v1/properties/:propertyId/leases/:leaseId/invitations/:inviteId/approve",async req=>{
  const {propertyId,leaseId,inviteId}=approvalParams.parse(req.params);
  const actor=await requireActor(req),property=await requireProperty(actor,propertyId,true);
  return db.transaction(async tx=>{
   const [lease]=await tx.select().from(leases).where(and(eq(leases.id,leaseId),eq(leases.propertyId,property.id),eq(leases.organizationId,property.organizationId))).for("update");
   if(!lease)throw new AppError(404,"LEASE_NOT_FOUND");
   if(lease.status!=="ACTIVE"||lease.tenantLineSubject)throw new AppError(409,"LEASE_ALREADY_LINKED");
   const [invite]=await tx.select().from(leaseInvitations).where(and(eq(leaseInvitations.id,inviteId),eq(leaseInvitations.leaseId,leaseId),eq(leaseInvitations.organizationId,property.organizationId))).for("update");
   if(!invite||invite.revokedAt||invite.approvedAt||!invite.claimedAt||!invite.claimedBy)throw new AppError(409,"INVITATION_NOT_APPROVABLE");
   const [tenant]=await tx.select().from(users).where(and(eq(users.id,invite.claimedBy),eq(users.status,"ACTIVE")));
   if(!tenant)throw new AppError(409,"TENANT_ACCOUNT_DISABLED");
   const [updated]=await tx.update(leases).set({tenantLineSubject:tenant.lineSubject})
    .where(and(eq(leases.id,lease.id),isNull(leases.tenantLineSubject),eq(leases.status,"ACTIVE"))).returning({id:leases.id});
   if(!updated)throw new AppError(409,"LEASE_ALREADY_LINKED");
   const now=new Date();
   await tx.update(leaseInvitations).set({approvedAt:now,approvedBy:actor.id}).where(eq(leaseInvitations.id,invite.id));
   await tx.update(leaseInvitations).set({revokedAt:now}).where(and(eq(leaseInvitations.leaseId,lease.id),isNull(leaseInvitations.approvedAt),isNull(leaseInvitations.revokedAt)));
   await tx.insert(auditLogs).values({actorId:actor.id,organizationId:property.organizationId,action:"TENANT_LINK_APPROVED",targetId:lease.id,
    metadata:{tenantId:tenant.id,invitationId:invite.id}});
   return {linked:true,leaseId:lease.id};
  });
 });

 // The user can see their own claims, but never lease/invoice information until approval.
 app.get("/v1/tenant/invitations",async req=>{
  const actor=await requireActor(req);
  return db.select({id:leaseInvitations.id,claimedAt:leaseInvitations.claimedAt,
   approvedAt:leaseInvitations.approvedAt,revokedAt:leaseInvitations.revokedAt,expiresAt:leaseInvitations.expiresAt})
   .from(leaseInvitations).where(eq(leaseInvitations.claimedBy,actor.id))
   .orderBy(desc(leaseInvitations.createdAt)).limit(20);
 });
 app.get("/v1/tenant/leases",async req=>{
  const actor=await requireActor(req),subject=await subjectFor(actor.id);
  return db.select({leaseId:leases.id,tenantName:leases.tenantName,
   propertyName:properties.name,propertyAddress:properties.address,roomNumber:rooms.number,
   startDate:leases.startDate,endDate:leases.endDate})
    .from(leases).innerJoin(properties,eq(properties.id,leases.propertyId))
    .innerJoin(organizations,eq(organizations.id,leases.organizationId))
    .innerJoin(rooms,eq(rooms.id,leases.roomId))
    .where(and(eq(leases.tenantLineSubject,subject),eq(leases.status,"ACTIVE"),
      eq(organizations.status,"ACTIVE"),eq(properties.organizationId,leases.organizationId),
      eq(rooms.propertyId,leases.propertyId))).orderBy(desc(leases.startDate)).limit(100);
 });
 app.get("/v1/tenant/invoices",async req=>{
  const actor=await requireActor(req),subject=await subjectFor(actor.id);
  return db.select({id:invoices.id,leaseId:leases.id,roomId:invoices.roomId,
    propertyName:properties.name,periodStart:invoices.periodStart,periodEnd:invoices.periodEnd,
    dueDate:invoices.dueDate,amountSatang:invoices.amountSatang,status:invoices.status,createdAt:invoices.createdAt})
    .from(invoices).innerJoin(leases,eq(invoices.leaseId,leases.id))
    .innerJoin(properties,eq(properties.id,leases.propertyId))
    .innerJoin(organizations,eq(organizations.id,leases.organizationId))
    .where(and(eq(leases.tenantLineSubject,subject),eq(leases.status,"ACTIVE"),
      eq(organizations.status,"ACTIVE"),eq(properties.organizationId,leases.organizationId),
      eq(invoices.propertyId,leases.propertyId),eq(invoices.organizationId,leases.organizationId)))
    .orderBy(desc(invoices.createdAt)).limit(100);
 });
 app.get("/v1/tenant/invoices/:invoiceId",async req=>{
  const actor=await requireActor(req),subject=await subjectFor(actor.id);
  const {invoiceId}=z.object({invoiceId:uuid}).parse(req.params);
  const [bill]=await db.select({id:invoices.id,leaseId:leases.id,propertyName:properties.name,
    periodStart:invoices.periodStart,periodEnd:invoices.periodEnd,dueDate:invoices.dueDate,
    amountSatang:invoices.amountSatang,status:invoices.status})
   .from(invoices).innerJoin(leases,eq(invoices.leaseId,leases.id))
   .innerJoin(properties,eq(properties.id,leases.propertyId))
   .innerJoin(organizations,eq(organizations.id,leases.organizationId))
   .where(and(eq(invoices.id,invoiceId),eq(leases.tenantLineSubject,subject),eq(leases.status,"ACTIVE"),
      eq(organizations.status,"ACTIVE"),eq(properties.organizationId,leases.organizationId),
      eq(invoices.propertyId,leases.propertyId),eq(invoices.organizationId,leases.organizationId))).limit(1);
  if(!bill)throw new AppError(404,"INVOICE_NOT_FOUND");
  const lines=await db.select({type:invoiceLines.type,description:invoiceLines.description,
    unitsMilli:invoiceLines.unitsMilli,tariffSatang:invoiceLines.tariffSatang,
    amountSatang:invoiceLines.amountSatang}).from(invoiceLines).where(eq(invoiceLines.invoiceId,bill.id));
  return {...bill,lines};
 });
}
