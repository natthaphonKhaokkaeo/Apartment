import {and,asc,count,desc,eq,gte,inArray,isNull,lt} from "drizzle-orm";
import {db} from "../db/client.js";
import {auditLogs,lineOutbox,lineOutboxDeadReviews,lineDispatchReservations} from "../db/schema.js";
import {config} from "../config.js";
import {AppError} from "../security.js";

const statuses=["QUEUED","SENDING","RETRY","ACCEPTED","SIMULATED","DEAD"] as const;
export type SafeLineStatus=typeof statuses[number];
export function safeOperatorStatus(value:string):SafeLineStatus{
 if(!statuses.some(s=>s===value))throw new Error("INVALID_LINE_STATUS");
 return value as SafeLineStatus;
}
export type WorkerMode="observe"|"live";
export function decideWorkerMode(input:{
 requested:string|undefined;outbound:string|undefined;approved:string|undefined;hasCredentials:boolean
}):WorkerMode{
 return input.requested==="live"&&input.outbound==="live"&&
  input.approved==="true"&&input.hasCredentials?"live":"observe";
}
const allowedErrors=new Set([
 "CONSENT_OR_SCOPE_REVOKED","TENANT_CONSENT_REVOKED",
 "SIMULATED_NO_MESSAGE_SENT","RETRY_KEY_WINDOW_EXPIRED",
 "NETWORK_FAILURE","LINE_OUTBOUND_INVALID"
]);
export function redactOutboxErrorCode(code:string|null):string|null{
 if(code===null)return null;
 if(allowedErrors.has(code))return code;
 if(/^HTTP_[4-5][0-9]{2}$/.test(code))return code;
 return "OTHER";
}
export function staleAgeSeconds(date:Date|null,now=new Date()):number|null{
 return date?Math.max(0,Math.floor((now.getTime()-date.getTime())/1000)):null;
}
const projection={
 id:lineOutbox.id,status:lineOutbox.status,
 templateKey:lineOutbox.templateKey,attempts:lineOutbox.attempts,
 createdAt:lineOutbox.createdAt,processedAt:lineOutbox.processedAt,
 lastErrorCode:lineOutbox.lastErrorCode,leaseUntil:lineOutbox.leaseUntil
};
export async function outboxOrgOverview(organizationId:string,now=new Date()){
 const rows=await db.select({status:lineOutbox.status,total:count()})
  .from(lineOutbox).where(eq(lineOutbox.organizationId,organizationId))
  .groupBy(lineOutbox.status);
 const counters=Object.fromEntries(statuses.map(status=>[status,0])) as Record<SafeLineStatus,number>;
 for(const row of rows)counters[row.status]=row.total;
 const [oldestActive]=await db.select({createdAt:lineOutbox.createdAt})
  .from(lineOutbox).where(and(eq(lineOutbox.organizationId,organizationId),
   inArray(lineOutbox.status,["QUEUED","RETRY"])))
  .orderBy(asc(lineOutbox.createdAt)).limit(1);
 const [oldestDead]=await db.select({createdAt:lineOutbox.createdAt})
  .from(lineOutbox).leftJoin(lineOutboxDeadReviews,
   eq(lineOutboxDeadReviews.outboxId,lineOutbox.id))
  .where(and(eq(lineOutbox.organizationId,organizationId),
   eq(lineOutbox.status,"DEAD"),isNull(lineOutboxDeadReviews.id)))
  .orderBy(asc(lineOutbox.createdAt)).limit(1);
 const [unreviewed]=await db.select({total:count()}).from(lineOutbox)
  .leftJoin(lineOutboxDeadReviews,eq(lineOutboxDeadReviews.outboxId,lineOutbox.id))
  .where(and(eq(lineOutbox.organizationId,organizationId),
   eq(lineOutbox.status,"DEAD"),isNull(lineOutboxDeadReviews.id)));
 const [orgReserved]=await db.select({total:count()}).from(lineDispatchReservations)
  .where(and(eq(lineDispatchReservations.organizationId,organizationId),
   gte(lineDispatchReservations.reservedAt,new Date(now.getTime()-60_000))));
 const [expiredLease]=await db.select({total:count()}).from(lineOutbox)
  .where(and(eq(lineOutbox.organizationId,organizationId),
   eq(lineOutbox.status,"SENDING"),lt(lineOutbox.leaseUntil,now)));
 return {organizationId,counts:counters,
  quotaWindowUsed:orgReserved?.total??0,
  quotaPerMinute:config.LINE_ORG_PER_MINUTE,
  unreviewedDeadCount:unreviewed?.total??0,
  expiredSendingLeaseCount:expiredLease?.total??0,
  oldestActiveAgeSeconds:staleAgeSeconds(oldestActive?.createdAt??null,now),
  oldestUnreviewedDeadAgeSeconds:staleAgeSeconds(oldestDead?.createdAt??null,now),
  checkedAt:now.toISOString(),
  notice:"ACCEPTED means LINE HTTP accepted, not delivered or read. SIMULATED means not sent."};
}
export async function outboxDeadLetters(organizationId:string,limit=40){
 const rows=await db.select({...projection,
  reviewedAt:lineOutboxDeadReviews.reviewedAt})
  .from(lineOutbox)
  .leftJoin(lineOutboxDeadReviews,eq(lineOutboxDeadReviews.outboxId,lineOutbox.id))
  .where(and(eq(lineOutbox.organizationId,organizationId),eq(lineOutbox.status,"DEAD")))
  .orderBy(desc(lineOutbox.createdAt)).limit(Math.min(50,Math.max(1,limit)));
 return rows.map(({lastErrorCode,...r})=>({
  ...r,lastErrorCode:redactOutboxErrorCode(lastErrorCode)
 }));
}
/** Review is acknowledgment only; it must never resubmit a terminal LINE job. */
export async function acknowledgeOutboxDeadLetter(input:{
 organizationId:string;outboxId:string;actorId:string;reason:string
}){
 return db.transaction(async tx=>{
  const [job]=await tx.select({id:lineOutbox.id,status:lineOutbox.status})
   .from(lineOutbox).where(and(eq(lineOutbox.id,input.outboxId),
    eq(lineOutbox.organizationId,input.organizationId))).for("update").limit(1);
  if(!job)throw new AppError(404,"LINE_DEAD_LETTER_NOT_FOUND");
  if(job.status!=="DEAD")throw new AppError(409,"LINE_JOB_NOT_TERMINAL");
  const [inserted]=await tx.insert(lineOutboxDeadReviews).values({
   outboxId:job.id,organizationId:input.organizationId,
   reviewedBy:input.actorId,reviewReason:input.reason
  }).onConflictDoNothing().returning({id:lineOutboxDeadReviews.id});
  if(!inserted)throw new AppError(409,"LINE_DEAD_LETTER_ALREADY_REVIEWED");
  await tx.insert(auditLogs).values({actorId:input.actorId,
   organizationId:input.organizationId,targetId:job.id,
   action:"LINE_DEAD_LETTER_ACKNOWLEDGED",
   metadata:{reviewId:inserted.id,deliveryRetried:false}});
  return {outboxId:job.id,acknowledged:true,deliveryRetried:false};
 });
}
/** Observer obtains global STATUS COUNTS only; no recipients, message bodies or tokens. */
export async function outboxGlobalCounts(){
 const rows=await db.select({status:lineOutbox.status,total:count()})
  .from(lineOutbox).groupBy(lineOutbox.status);
 return Object.fromEntries(statuses.map(s=>[s,rows.find(r=>r.status===s)?.total??0])) as Record<SafeLineStatus,number>;
}
