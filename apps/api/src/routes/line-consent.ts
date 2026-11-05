import type {FastifyInstance} from "fastify";
import {and,eq,inArray} from "drizzle-orm";
import {z} from "zod";
import {config} from "../config.js";
import {db} from "../db/client.js";
import {auditLogs,leases,lineNotificationConsents,lineOaBindings,lineOutbox,organizations,properties,users} from "../db/schema.js";
import {AppError,requireActor} from "../security.js";

const leaseParams=z.object({leaseId:z.uuid()});
const change=z.discriminatedUnion("enabled",[
 z.object({enabled:z.literal(true),policyVersion:z.literal("2026-11-v1"),
  acknowledgedPurpose:z.literal(true)}),
 z.object({enabled:z.literal(false)})
]);
async function subjectFor(actorId:string){
 const [u]=await db.select({lineSubject:users.lineSubject}).from(users)
  .where(and(eq(users.id,actorId),eq(users.status,"ACTIVE"))).limit(1);
 if(!u)throw new AppError(401,"UNAUTHENTICATED");
 return u.lineSubject;
}
export async function registerLineConsentRoutes(app:FastifyInstance){
 // Tenant sees only the active, verified LINE-linked leases belonging to their session.
 app.get("/v1/tenant/notification-consents",async(req,reply)=>{
  const actor=await requireActor(req),subject=await subjectFor(actor.id);
  const rows=await db.select({leaseId:leases.id,organizationId:leases.organizationId,
   propertyName:properties.name}).from(leases)
   .innerJoin(properties,and(eq(properties.id,leases.propertyId),
    eq(properties.organizationId,leases.organizationId)))
   .innerJoin(organizations,and(eq(organizations.id,leases.organizationId),
    eq(organizations.status,"ACTIVE")))
   .where(and(eq(leases.tenantLineSubject,subject),eq(leases.status,"ACTIVE")));
  const result=await Promise.all(rows.map(async lease=>{
   const [oa]=await db.select().from(lineOaBindings).where(
    eq(lineOaBindings.organizationId,lease.organizationId)).limit(1);
   const [consent]=oa?await db.select().from(lineNotificationConsents).where(and(
    eq(lineNotificationConsents.bindingId,oa.id),
    eq(lineNotificationConsents.leaseId,lease.leaseId),
    eq(lineNotificationConsents.organizationId,lease.organizationId),
    eq(lineNotificationConsents.recipientLineUserId,subject)
   )).limit(1):[];
   return {
    leaseId:lease.leaseId,propertyName:lease.propertyName,
    available:!!oa?.enabled && oa.botUserId===config.LINE_OA_BOT_USER_ID,
    enabled:!!consent&&!consent.revokedAt,
    policyVersion:"2026-11-v1",
    grantedAt:consent?.grantedAt??null,revokedAt:consent?.revokedAt??null,
    outboundActive:config.LINE_OUTBOUND_MODE==="live"
   };
  }));
  reply.header("cache-control","private, no-store");
  return result;
 });
 app.put("/v1/tenant/leases/:leaseId/notification-consent",{
  config:{rateLimit:{max:12,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req),subject=await subjectFor(actor.id);
  const {leaseId}=leaseParams.parse(req.params),input=change.parse(req.body);
  const result=await db.transaction(async tx=>{
   // Lease lock serializes consent changes with owner-controlled tenant re-link and
   // avoids accidentally granting consent to a previous tenant of a room.
   const [lease]=await tx.select().from(leases).where(and(eq(leases.id,leaseId),
    eq(leases.tenantLineSubject,subject),eq(leases.status,"ACTIVE"))).for("update");
   if(!lease)throw new AppError(404,"LEASE_NOT_FOUND");
   const [org]=await tx.select({id:organizations.id}).from(organizations)
    .where(and(eq(organizations.id,lease.organizationId),
     eq(organizations.status,"ACTIVE"))).limit(1);
   if(!org)throw new AppError(404,"LEASE_NOT_FOUND");
   const [binding]=await tx.select().from(lineOaBindings).where(
    eq(lineOaBindings.organizationId,lease.organizationId)).limit(1);
   if(!binding){
    if(input.enabled)throw new AppError(409,"LINE_OA_NOT_AVAILABLE");
    return {leaseId,enabled:false,available:false};
   }
   const [current]=await tx.select().from(lineNotificationConsents).where(and(
    eq(lineNotificationConsents.bindingId,binding.id),
    eq(lineNotificationConsents.leaseId,leaseId),
    eq(lineNotificationConsents.organizationId,lease.organizationId)
   )).for("update").limit(1);
   if(input.enabled){
    if(!binding.enabled||binding.botUserId!==config.LINE_OA_BOT_USER_ID)
     throw new AppError(409,"LINE_OA_NOT_AVAILABLE");
    if(current&&!current.revokedAt&&current.recipientLineUserId===subject)
     return {leaseId,enabled:true,available:true,grantedAt:current.grantedAt};
    const now=new Date();
    const [saved]=await tx.insert(lineNotificationConsents).values({
     bindingId:binding.id,organizationId:lease.organizationId,leaseId,
     recipientLineUserId:subject,evidenceRef:"tenant-self-service/notification-v2026-11",
     grantedAt:now,revokedAt:null
    }).onConflictDoUpdate({
     target:[lineNotificationConsents.bindingId,lineNotificationConsents.leaseId],
     set:{recipientLineUserId:subject,
      evidenceRef:"tenant-self-service/notification-v2026-11",grantedAt:now,revokedAt:null}
    }).returning({id:lineNotificationConsents.id,grantedAt:lineNotificationConsents.grantedAt});
    await tx.insert(auditLogs).values({actorId:actor.id,organizationId:lease.organizationId,
     targetId:saved.id,action:"LINE_NOTIFICATION_CONSENT_GRANTED",
     metadata:{leaseId,policyVersion:"2026-11-v1"}});
    return {leaseId,enabled:true,available:true,grantedAt:saved.grantedAt};
   }
   if(!current||current.revokedAt||current.recipientLineUserId!==subject)
    return {leaseId,enabled:false,available:binding.enabled};
   const revokedAt=new Date();
   await tx.update(lineNotificationConsents).set({revokedAt})
    .where(eq(lineNotificationConsents.id,current.id));
   // Already-sent messages cannot be recalled; prevent pending and retry jobs
   // from being sent if the user changes their mind.
   await tx.update(lineOutbox).set({
    status:"DEAD",leaseUntil:null,lastErrorCode:"TENANT_CONSENT_REVOKED",
    processedAt:revokedAt
   }).where(and(eq(lineOutbox.consentId,current.id),
    inArray(lineOutbox.status,["QUEUED","RETRY","SENDING"])));
   await tx.insert(auditLogs).values({actorId:actor.id,organizationId:lease.organizationId,
    targetId:current.id,action:"LINE_NOTIFICATION_CONSENT_REVOKED",
    metadata:{leaseId,policyVersion:"2026-11-v1"}});
   return {leaseId,enabled:false,available:binding.enabled,revokedAt};
  });
  reply.header("cache-control","private, no-store");
  return result;
 });
}
