import {createHash,randomUUID} from "node:crypto";
import {and,eq,desc,inArray,isNull} from "drizzle-orm";
import {db} from "../db/client.js";
import {users,privacyRequests,memberships,leases,paymentClaims,sessions,propertyStaffGrants,leaseInvitations,staffInvitations,lineNotificationConsents,lineOutbox,auditLogs} from "../db/schema.js";
import {config} from "../config.js";
import {AppError,requireAdmin,type Actor} from "../security.js";
import {bangkokToday} from "./property-rates.js";
import {assertProfileAnonymizationAllowed,retentionElapsed} from "./privacy-policy.js";
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
export const privacyExecutionEnabled=()=>config.PRIVACY_PROFILE_ANONYMIZATION_APPROVED==="true";
export async function listMyPrivacyRequests(actor:Actor){
 const requests=await db.select({id:privacyRequests.id,status:privacyRequests.status,reason:privacyRequests.reason,reviewReason:privacyRequests.reviewReason,createdAt:privacyRequests.createdAt,executedAt:privacyRequests.executedAt}).from(privacyRequests).where(eq(privacyRequests.userId,actor.id)).orderBy(desc(privacyRequests.createdAt)).limit(50);
 return {requests,profileOnly:true,financialRecordsRetained:true,executionEnabled:privacyExecutionEnabled()};
}
export async function submitPrivacyRequest(actor:Actor,reason:string,key:string){
 return db.transaction(async tx=>{
  const [user]=await tx.select().from(users).where(and(eq(users.id,actor.id),eq(users.status,"ACTIVE"))).for("update");
  if(!user)throw new AppError(401,"UNAUTHENTICATED");
  if(user.platformRole==="SUPER_ADMIN"||user.lineSubject===config.SUPER_ADMIN_LINE_USER_ID)throw new AppError(409,"PRIVACY_PROTECTED_ACCOUNT");
  const hash=createHash("sha256").update(JSON.stringify({reason,profileOnly:true})).digest("hex");
  const [prior]=await tx.select().from(privacyRequests).where(and(eq(privacyRequests.userId,actor.id),eq(privacyRequests.idempotencyKey,key)));
  if(prior){if(prior.requestHash!==hash)throw new AppError(409,"IDEMPOTENCY_KEY_REUSED");return {request:prior,replayed:true};}
  const [open]=await tx.select({id:privacyRequests.id}).from(privacyRequests).where(and(eq(privacyRequests.userId,actor.id),inArray(privacyRequests.status,["REQUESTED","APPROVED"]))).limit(1);
  if(open)throw new AppError(409,"PRIVACY_REQUEST_ALREADY_OPEN");
  const [request]=await tx.insert(privacyRequests).values({userId:actor.id,reason,idempotencyKey:key,requestHash:hash}).returning();
  await tx.insert(auditLogs).values({actorId:actor.id,action:"PRIVACY_REQUEST_SUBMITTED",targetId:request.id,metadata:{profileOnly:true}});
  return {request,replayed:false};
 });
}
export async function cancelPrivacyRequest(actor:Actor,id:string){
 return db.transaction(async tx=>{
  const [user]=await tx.select({id:users.id}).from(users).where(and(eq(users.id,actor.id),eq(users.status,"ACTIVE"))).for("update");
  if(!user)throw new AppError(401,"UNAUTHENTICATED");
  const [r]=await tx.select().from(privacyRequests).where(and(eq(privacyRequests.id,id),eq(privacyRequests.userId,actor.id))).for("update");
  if(!r)throw new AppError(404,"PRIVACY_REQUEST_NOT_FOUND");
  if(r.status==="CANCELLED")return {request:r,replayed:true};
  if(!["REQUESTED","APPROVED"].includes(r.status))throw new AppError(409,"PRIVACY_REQUEST_ALREADY_CLOSED");
  const [request]=await tx.update(privacyRequests).set({status:"CANCELLED"}).where(eq(privacyRequests.id,id)).returning();
  await tx.insert(auditLogs).values({actorId:actor.id,action:"PRIVACY_REQUEST_CANCELLED",targetId:id,metadata:{profileOnly:true}});
  return {request,replayed:false};
 });
}
async function adminCase<T>(actor:Actor,id:string,work:(tx:Tx,target:typeof users.$inferSelect,request:typeof privacyRequests.$inferSelect)=>Promise<T>){
 requireAdmin(actor);
 return db.transaction(async tx=>{
  const [admin]=await tx.select({id:users.id}).from(users).where(and(eq(users.id,actor.id),eq(users.status,"ACTIVE"),eq(users.platformRole,"SUPER_ADMIN"))).for("share");
  if(!admin)throw new AppError(403,"SUPER_ADMIN_REQUIRED");
  const [candidate]=await tx.select().from(privacyRequests).where(eq(privacyRequests.id,id)).limit(1);
  if(!candidate)throw new AppError(404,"PRIVACY_REQUEST_NOT_FOUND");
  if(candidate.userId===actor.id)throw new AppError(403,"PRIVACY_SELF_ADMIN_DECISION_FORBIDDEN");
  const [target]=await tx.select().from(users).where(eq(users.id,candidate.userId)).for("update");
  const [request]=await tx.select().from(privacyRequests).where(eq(privacyRequests.id,id)).for("update");
  if(!target||!request)throw new AppError(404,"PRIVACY_REQUEST_NOT_FOUND");
  return work(tx,target,request);
 });
}
async function eligibility(tx:Tx,target:typeof users.$inferSelect){
 const owners=await tx.select({id:memberships.id}).from(memberships).where(and(eq(memberships.userId,target.id),eq(memberships.status,"ACTIVE"),eq(memberships.role,"OWNER"))).for("share");
 const linked=await tx.select().from(leases).where(eq(leases.tenantLineSubject,target.lineSubject)).for("update");
 const payments=await tx.select({id:paymentClaims.id}).from(paymentClaims).where(and(eq(paymentClaims.submittedBy,target.id),eq(paymentClaims.status,"PENDING"))).for("share");
 const days=config.PRIVACY_PROFILE_RETENTION_DAYS;
 const elapsed=linked.every(l=>l.status==="ENDED"&&!!l.endDate&&!!days&&retentionElapsed(l.endDate,bangkokToday(),days));
 return {policyApproved:privacyExecutionEnabled(),protectedAccount:target.platformRole==="SUPER_ADMIN"||target.lineSubject===config.SUPER_ADMIN_LINE_USER_ID,activeOwnerCount:owners.length,activeLeaseCount:linked.filter(l=>l.status!=="ENDED").length,pendingPaymentCount:payments.length,retentionElapsed:elapsed};
}
export async function previewPrivacyRequest(actor:Actor,id:string){
 return adminCase(actor,id,async(tx,target,request)=>{
  const context=await eligibility(tx,target);
  let blocker:string|null=null;
  try{assertProfileAnonymizationAllowed(context);}catch(e){blocker=e instanceof Error?e.message:"PRIVACY_CONTEXT_INVALID";}
  return {id:request.id,status:request.status,canExecute:request.status==="APPROVED"&&!blocker,blocker,profileOnly:true,financialRecordsRetained:true};
 });
}
export async function decidePrivacyRequest(actor:Actor,id:string,input:{action:"APPROVE"|"REJECT";reason:string}){
 return adminCase(actor,id,async(tx,_target,request)=>{
  if(request.status!=="REQUESTED")throw new AppError(409,"PRIVACY_REQUEST_ALREADY_DECIDED");
  const [updated]=await tx.update(privacyRequests).set({status:input.action==="APPROVE"?"APPROVED":"REJECTED",reviewedBy:actor.id,reviewReason:input.reason,reviewedAt:new Date()}).where(eq(privacyRequests.id,id)).returning();
  await tx.insert(auditLogs).values({actorId:actor.id,action:"PRIVACY_REQUEST_"+updated.status,targetId:id,metadata:{profileOnly:true,executionEnabled:privacyExecutionEnabled()}});
  return {request:updated,executionEnabled:privacyExecutionEnabled()};
 });
}
export async function executePrivacyRequest(actor:Actor,id:string){
 return adminCase(actor,id,async(tx,target,request)=>{
  if(request.status==="PROFILE_ANONYMIZED")return {request,replayed:true,profileOnly:true,financialRecordsChanged:false};
  if(request.status!=="APPROVED")throw new AppError(409,"PRIVACY_REQUEST_NOT_APPROVED");
  if(target.lineSubject.startsWith("erased:"))throw new AppError(409,"PRIVACY_PROFILE_ALREADY_ANONYMIZED");
  const context=await eligibility(tx,target);
  try{assertProfileAnonymizationAllowed(context);}catch(e){throw new AppError(409,e instanceof Error?e.message:"PRIVACY_CONTEXT_INVALID");}
  const now=new Date(),pseudonym="E"+randomUUID().replace(/-/g,"");
  await tx.update(sessions).set({revokedAt:now}).where(eq(sessions.userId,target.id));
  await tx.update(memberships).set({status:"DISABLED"}).where(eq(memberships.userId,target.id));
  await tx.update(propertyStaffGrants).set({status:"DISABLED",updatedAt:now,updatedBy:actor.id}).where(eq(propertyStaffGrants.userId,target.id));
  await tx.update(leaseInvitations).set({revokedAt:now}).where(and(eq(leaseInvitations.claimedBy,target.id),isNull(leaseInvitations.revokedAt)));
  await tx.update(staffInvitations).set({revokedAt:now}).where(and(eq(staffInvitations.claimedBy,target.id),isNull(staffInvitations.revokedAt)));
  await tx.update(lineOutbox).set({status:"DEAD",leaseUntil:null,processedAt:now,lastErrorCode:"PROFILE_ANONYMIZED"}).where(and(eq(lineOutbox.recipientLineUserId,target.lineSubject),inArray(lineOutbox.status,["QUEUED","RETRY","SENDING"])));
  await tx.update(lineOutbox).set({recipientLineUserId:pseudonym,messageText:"[profile anonymized]"}).where(eq(lineOutbox.recipientLineUserId,target.lineSubject));
  await tx.update(lineNotificationConsents).set({recipientLineUserId:pseudonym,revokedAt:now}).where(eq(lineNotificationConsents.recipientLineUserId,target.lineSubject));
  await tx.update(leases).set({tenantLineSubject:null,tenantName:"Former tenant (profile anonymized)"}).where(eq(leases.tenantLineSubject,target.lineSubject));
  await tx.update(users).set({displayName:"Deleted account",lineSubject:"erased:"+randomUUID(),status:"DISABLED"}).where(eq(users.id,target.id));
  await tx.update(privacyRequests).set({reason:"[removed after profile anonymization]"}).where(eq(privacyRequests.userId,target.id));
  const [updated]=await tx.update(privacyRequests).set({status:"PROFILE_ANONYMIZED",policyEvidenceRef:config.PRIVACY_POLICY_EVIDENCE_REF,policyRetentionDays:config.PRIVACY_PROFILE_RETENTION_DAYS,executedAt:now}).where(eq(privacyRequests.id,id)).returning();
  await tx.insert(auditLogs).values({actorId:actor.id,action:"PRIVACY_PROFILE_ANONYMIZED",targetId:id,metadata:{userId:target.id,profileOnly:true,financialRecordsChanged:false,policyEvidenceRef:config.PRIVACY_POLICY_EVIDENCE_REF}});
  return {request:updated,replayed:false,profileOnly:true,financialRecordsChanged:false};
 });
}
export async function listAdminPrivacyRequests(actor:Actor){
 requireAdmin(actor);
 return {requests:await db.select().from(privacyRequests).orderBy(desc(privacyRequests.createdAt)).limit(100),executionEnabled:privacyExecutionEnabled(),profileOnly:true,financialRecordsRetained:true};
}
