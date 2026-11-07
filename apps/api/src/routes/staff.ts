import {createHash,randomBytes} from "node:crypto";
import {and,desc,eq,gt,isNull} from "drizzle-orm";
import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {db} from "../db/client.js";
import {auditLogs,memberships,organizations,properties,propertyStaffGrants,staffInvitations,users} from "../db/schema.js";
import {AppError,requireActor,requireOrg,type Actor} from "../security.js";
import {staffInviteTargetIsValid} from "../services/staff-permissions.js";
import {notifyOrganizationMembersTx} from "../services/org-notifications.js";

const uuid=z.uuid();
const orgParams=z.object({orgId:uuid});
const inviteParams=z.object({orgId:uuid,inviteId:uuid});
const inviteRequest=z.object({
 role:z.enum(["MANAGER","STAFF"]),
 propertyId:uuid.nullable().default(null),
 level:z.enum(["VIEWER","METER_READER"]).nullable().default(null)
});
const hashInvite=(token:string)=>createHash("sha256").update("apartment:staff-invite:v1:"+token).digest("hex");
const inviteTimeoutMs=24*60*60*1000;

async function requireOwner(actor:Actor,orgId:string){
 await requireOrg(actor,orgId);
 const [member]=await db.select({role:memberships.role}).from(memberships).where(and(
  eq(memberships.organizationId,orgId),eq(memberships.userId,actor.id),eq(memberships.status,"ACTIVE")
 )).limit(1);
 if(actor.role!=="SUPER_ADMIN"&&member?.role!=="OWNER")throw new AppError(403,"ORG_OWNER_REQUIRED");
}

export async function registerStaffRoutes(app:FastifyInstance){
 app.get("/v1/organizations/:orgId/staff/members",async(req,reply)=>{
  const actor=await requireActor(req),{orgId}=orgParams.parse(req.params);
  await requireOwner(actor,orgId);
  const members=await db.select({id:memberships.id,userId:users.id,displayName:users.displayName,
   role:memberships.role,status:memberships.status}).from(memberships)
   .innerJoin(users,eq(users.id,memberships.userId))
   .where(eq(memberships.organizationId,orgId));
  const grants=await db.select({userId:propertyStaffGrants.userId,propertyId:propertyStaffGrants.propertyId,
   level:propertyStaffGrants.level,status:propertyStaffGrants.status}).from(propertyStaffGrants)
   .where(eq(propertyStaffGrants.organizationId,orgId));
  reply.header("cache-control","private, no-store");
  return members.map(member=>({...member,grants:grants.filter(g=>g.userId===member.userId)}));
 });
 app.get("/v1/organizations/:orgId/staff/invitations",async(req,reply)=>{
  const actor=await requireActor(req),{orgId}=orgParams.parse(req.params);
  await requireOwner(actor,orgId);
  reply.header("cache-control","private, no-store");
  // Token hashes and LINE identifiers must never reach callers.
  return db.select({id:staffInvitations.id,role:staffInvitations.role,
   propertyId:staffInvitations.propertyId,level:staffInvitations.level,
   expiresAt:staffInvitations.expiresAt,createdAt:staffInvitations.createdAt,
   claimedAt:staffInvitations.claimedAt,approvedAt:staffInvitations.approvedAt,
   revokedAt:staffInvitations.revokedAt,claimedBy:staffInvitations.claimedBy,
   claimantName:users.displayName}).from(staffInvitations)
   .leftJoin(users,eq(staffInvitations.claimedBy,users.id))
   .where(eq(staffInvitations.organizationId,orgId))
   .orderBy(desc(staffInvitations.createdAt)).limit(100);
 });
 app.post("/v1/organizations/:orgId/staff/invitations",
  {config:{rateLimit:{max:10,timeWindow:"1 minute"}}},async(req,reply)=>{
  const actor=await requireActor(req),{orgId}=orgParams.parse(req.params);
  await requireOwner(actor,orgId);
  const input=inviteRequest.parse(req.body);
  if(!staffInviteTargetIsValid(input.role,input.propertyId) ||
   (input.role==="STAFF")!==!!input.level)throw new AppError(400,"INVALID_STAFF_INVITATION_SCOPE");
  if(input.propertyId){
   const [p]=await db.select({id:properties.id}).from(properties).where(and(
    eq(properties.id,input.propertyId),eq(properties.organizationId,orgId))).limit(1);
   if(!p)throw new AppError(404,"PROPERTY_NOT_FOUND");
  }
  const token=randomBytes(32).toString("base64url");
  const [invite]=await db.insert(staffInvitations).values({
   organizationId:orgId,propertyId:input.propertyId,role:input.role,level:input.level,
   tokenHash:hashInvite(token),expiresAt:new Date(Date.now()+inviteTimeoutMs),createdBy:actor.id
  }).returning({id:staffInvitations.id,expiresAt:staffInvitations.expiresAt});
  await db.insert(auditLogs).values({actorId:actor.id,organizationId:orgId,
   action:"STAFF_INVITE_CREATED",targetId:invite.id,metadata:{role:input.role,propertyId:input.propertyId}});
  reply.header("cache-control","private, no-store");
  // The one-time token is shown only here and is not persisted in plaintext.
  return reply.code(201).send({...invite,token,approvalRequired:true});
 });
 app.post("/v1/staff/invitations/claim",
  {config:{rateLimit:{max:10,timeWindow:"1 minute"}}},async(req,reply)=>{
  const actor=await requireActor(req);
  const {token}=z.object({token:z.string().min(40).max(128)}).parse(req.body);
  const [invite]=await db.update(staffInvitations).set({claimedBy:actor.id,claimedAt:new Date()})
   .where(and(eq(staffInvitations.tokenHash,hashInvite(token)),
    isNull(staffInvitations.claimedBy),isNull(staffInvitations.revokedAt),
    gt(staffInvitations.expiresAt,new Date()),isNull(staffInvitations.approvedAt)))
   .returning({id:staffInvitations.id});
  if(!invite)throw new AppError(409,"INVITATION_UNAVAILABLE");
  reply.header("cache-control","private, no-store");
  return {invitationId:invite.id,status:"PENDING_OWNER_APPROVAL"};
 });
 app.post("/v1/organizations/:orgId/staff/invitations/:inviteId/approve",
  {config:{rateLimit:{max:20,timeWindow:"1 minute"}}},async(req,reply)=>{
  const actor=await requireActor(req),{orgId,inviteId}=inviteParams.parse(req.params);
  await requireOwner(actor,orgId);
  const result=await db.transaction(async tx=>{
   // Serialize grant activation and revocation per organization.
   const [org]=await tx.select({id:organizations.id}).from(organizations)
    .where(and(eq(organizations.id,orgId),eq(organizations.status,"ACTIVE"))).for("update");
   if(!org)throw new AppError(404,"ORGANIZATION_NOT_FOUND");
   const [invite]=await tx.select().from(staffInvitations).where(and(
    eq(staffInvitations.id,inviteId),eq(staffInvitations.organizationId,orgId)
   )).for("update");
   if(!invite||!invite.claimedBy||invite.approvedAt||invite.revokedAt||
    invite.expiresAt<=new Date())throw new AppError(409,"INVITATION_UNAVAILABLE");
   if(invite.role!=="MANAGER"&&invite.role!=="STAFF")throw new AppError(400,"INVALID_STAFF_ROLE");
   if(!staffInviteTargetIsValid(invite.role,invite.propertyId))throw new AppError(409,"INVALID_STAFF_SCOPE");
   const [claimant]=await tx.select({id:users.id}).from(users).where(and(
    eq(users.id,invite.claimedBy),eq(users.status,"ACTIVE"))).limit(1);
   if(!claimant)throw new AppError(409,"CLAIMANT_NOT_ACTIVE");
   if(invite.role==="STAFF"){
    if(!invite.level)throw new AppError(409,"INVALID_STAFF_SCOPE");
    const [p]=await tx.select({id:properties.id}).from(properties).where(and(
     eq(properties.id,invite.propertyId!),eq(properties.organizationId,orgId))).limit(1);
    if(!p)throw new AppError(409,"PROPERTY_NOT_FOUND");
   }
   const [existing]=await tx.select().from(memberships).where(and(
    eq(memberships.organizationId,orgId),eq(memberships.userId,invite.claimedBy))).limit(1);
   if(existing?.role==="OWNER"||(invite.role==="STAFF"&&existing?.role==="MANAGER"&&existing.status==="ACTIVE"))
    throw new AppError(409,"STAFF_MEMBERSHIP_CONFLICT");
   if(existing){
    await tx.update(memberships).set({role:invite.role,status:"ACTIVE"}).where(eq(memberships.id,existing.id));
   }else{
    await tx.insert(memberships).values({organizationId:orgId,userId:invite.claimedBy,role:invite.role});
   }
   if(invite.role==="STAFF"){
    await tx.insert(propertyStaffGrants).values({organizationId:orgId,propertyId:invite.propertyId!,
     userId:invite.claimedBy,level:invite.level!,updatedBy:actor.id})
     .onConflictDoUpdate({target:[propertyStaffGrants.propertyId,propertyStaffGrants.userId],
      set:{status:"ACTIVE",level:invite.level!,updatedBy:actor.id,updatedAt:new Date()}});
   }else{
    // No dormant scoped grants should become effective if the manager is later downgraded.
    await tx.update(propertyStaffGrants).set({status:"DISABLED",updatedAt:new Date(),updatedBy:actor.id})
     .where(and(eq(propertyStaffGrants.organizationId,orgId),eq(propertyStaffGrants.userId,invite.claimedBy)));
   }
   await tx.update(staffInvitations).set({approvedAt:new Date(),approvedBy:actor.id})
    .where(eq(staffInvitations.id,inviteId));
   await tx.insert(auditLogs).values({actorId:actor.id,organizationId:orgId,
    action:"STAFF_INVITE_APPROVED",targetId:inviteId,
    metadata:{userId:invite.claimedBy,role:invite.role,propertyId:invite.propertyId}});
   await notifyOrganizationMembersTx(tx,orgId,{eventKey:`STAFF_ROLE_GRANTED:${inviteId}`,kind:"STAFF_ROLE_CHANGED",
    title:"มีการเปลี่ยนสิทธิสมาชิก",body:`เพิ่มหรือปรับสิทธิสมาชิกเป็น ${invite.role} แล้ว`});
   return {ok:true,userId:invite.claimedBy,role:invite.role};
  });
  reply.header("cache-control","private, no-store");
  return result;
 });
 app.post("/v1/organizations/:orgId/staff/invitations/:inviteId/revoke",async(req,reply)=>{
  const actor=await requireActor(req),{orgId,inviteId}=inviteParams.parse(req.params);
  await requireOwner(actor,orgId);
  const [invite]=await db.update(staffInvitations).set({revokedAt:new Date()}).where(and(
   eq(staffInvitations.id,inviteId),eq(staffInvitations.organizationId,orgId),
   isNull(staffInvitations.approvedAt),isNull(staffInvitations.revokedAt)
  )).returning({id:staffInvitations.id});
  if(!invite)throw new AppError(409,"INVITATION_UNAVAILABLE");
  await db.insert(auditLogs).values({actorId:actor.id,organizationId:orgId,
   action:"STAFF_INVITE_REVOKED",targetId:inviteId,metadata:{}});
  reply.header("cache-control","private, no-store");
  return {ok:true};
 });
 app.post("/v1/organizations/:orgId/staff/members/:userId/revoke",async(req,reply)=>{
  const actor=await requireActor(req);
  const {orgId,userId}=z.object({orgId:uuid,userId:uuid}).parse(req.params);
  const {propertyId}=z.object({propertyId:uuid.nullable().default(null)}).parse(req.body??{});
  await requireOwner(actor,orgId);
  if(actor.id===userId)throw new AppError(409,"CANNOT_REVOKE_SELF");
  await db.transaction(async tx=>{
   await tx.select({id:organizations.id}).from(organizations).where(eq(organizations.id,orgId)).for("update");
   const [member]=await tx.select().from(memberships).where(and(
    eq(memberships.organizationId,orgId),eq(memberships.userId,userId),
    eq(memberships.status,"ACTIVE"))).limit(1);
   if(!member||member.role==="OWNER")throw new AppError(409,"STAFF_MEMBER_NOT_REVOCABLE");
   if(member.role==="MANAGER"){
    if(propertyId)throw new AppError(400,"MANAGER_IS_ORG_WIDE");
    await tx.update(memberships).set({status:"DISABLED"}).where(eq(memberships.id,member.id));
   }else{
    if(!propertyId)throw new AppError(400,"PROPERTY_REQUIRED");
    const [grant]=await tx.update(propertyStaffGrants).set({status:"DISABLED",
     updatedBy:actor.id,updatedAt:new Date()}).where(and(
      eq(propertyStaffGrants.organizationId,orgId),eq(propertyStaffGrants.propertyId,propertyId),
      eq(propertyStaffGrants.userId,userId),eq(propertyStaffGrants.status,"ACTIVE")
     )).returning({id:propertyStaffGrants.id});
    if(!grant)throw new AppError(409,"STAFF_GRANT_NOT_ACTIVE");
    const [other]=await tx.select({id:propertyStaffGrants.id}).from(propertyStaffGrants)
     .where(and(eq(propertyStaffGrants.organizationId,orgId),eq(propertyStaffGrants.userId,userId),
      eq(propertyStaffGrants.status,"ACTIVE"))).limit(1);
    if(!other)await tx.update(memberships).set({status:"DISABLED"}).where(eq(memberships.id,member.id));
   }
   await tx.insert(auditLogs).values({actorId:actor.id,organizationId:orgId,
    action:"STAFF_ACCESS_REVOKED",targetId:userId,metadata:{propertyId}});
   await notifyOrganizationMembersTx(tx,orgId,{eventKey:`STAFF_ACCESS_REVOKED:${userId}:${propertyId??"organization"}`,kind:"STAFF_ROLE_CHANGED",
    title:"มีการเปลี่ยนสิทธิสมาชิก",body:"มีการเพิกถอนสิทธิสมาชิกหรือสิทธิเข้าถึงที่พักแล้ว"});
  });
  reply.header("cache-control","private, no-store");
  return {ok:true};
 });
}
