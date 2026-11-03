import {and,count,eq,gte,inArray,isNull,lt,lte,min,or,sql} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {config} from "../config.js";
import {leases,lineNotificationConsents,lineOaBindings,lineOutbox,lineDispatchReservations} from "../db/schema.js";
import {AppError} from "../security.js";
import {deliveryPlan,sendLinePushMessage,type SendStatus} from "./line-oa.js";
import {rankOrgQueues} from "./line-fairness.js";

const templates=["BILL_ISSUED","PAYMENT_DUE","MAINTENANCE_NOTICE"] as const;
const lineUser=/^U[0-9a-f]{32}$/i;
const enqueueSchema=z.object({
 organizationId:z.uuid(),bindingId:z.uuid(),leaseId:z.uuid(),consentId:z.uuid(),
 recipientLineUserId:z.string().regex(lineUser),eventKey:z.string().trim().min(8).max(128),
 templateKey:z.enum(templates),messageText:z.string().min(1).max(5000)
});
/** Internal service ONLY. Callers must explicitly attest tenant consent in DB.
 * No HTTP trigger until P4-04 consent capture UX and legal terms are implemented.
 */
export async function enqueueLineNotification(input:z.infer<typeof enqueueSchema>){
 const b=enqueueSchema.parse(input);
 return db.transaction(async tx=>{
  const [[oa],[consent],[lease]]=await Promise.all([
   tx.select().from(lineOaBindings).where(and(eq(lineOaBindings.id,b.bindingId),
    eq(lineOaBindings.organizationId,b.organizationId),eq(lineOaBindings.enabled,true))).limit(1),
   tx.select().from(lineNotificationConsents).where(and(
    eq(lineNotificationConsents.id,b.consentId),eq(lineNotificationConsents.bindingId,b.bindingId),
    eq(lineNotificationConsents.organizationId,b.organizationId),
    eq(lineNotificationConsents.leaseId,b.leaseId),
    eq(lineNotificationConsents.recipientLineUserId,b.recipientLineUserId),
    isNull(lineNotificationConsents.revokedAt))).limit(1),
   tx.select().from(leases).where(and(eq(leases.id,b.leaseId),
    eq(leases.organizationId,b.organizationId),eq(leases.status,"ACTIVE"),
    eq(leases.tenantLineSubject,b.recipientLineUserId))).limit(1)
  ]);
  if(!oa||!consent||!lease)throw new AppError(403,"LINE_NOTIFICATION_CONSENT_REQUIRED");
  const [created]=await tx.insert(lineOutbox).values(b)
   .onConflictDoNothing().returning();
  if(created)return {entry:created,replayed:false};
  const [previous]=await tx.select().from(lineOutbox).where(and(
   eq(lineOutbox.bindingId,b.bindingId),eq(lineOutbox.eventKey,b.eventKey))).limit(1);
  if(!previous||previous.recipientLineUserId!==b.recipientLineUserId||
   previous.messageText!==b.messageText||previous.templateKey!==b.templateKey||
   previous.leaseId!==b.leaseId||previous.consentId!==b.consentId)
   throw new AppError(409,"LINE_OUTBOX_IDEMPOTENCY_CONFLICT");
  return {entry:previous,replayed:true};
 });
}
export type OutboxSendResult={status:SendStatus;httpStatus:number;requestId:string|null};
export type DispatchMode="disabled"|"simulate"|"live";
export async function runLineOutboxBatch(options:{
 mode?:DispatchMode;limit?:number;now?:Date;
 quota?:{globalPerMinute:number;perOrgPerMinute:number};
 send?:(message:{to:string;text:string;retryKey:string;createdAt:Date})=>Promise<OutboxSendResult>
}={}){
 const mode=options.mode??config.LINE_OUTBOUND_MODE;
 const limit=Math.max(1,Math.min(10,options.limit??5));
 const now=options.now??new Date();
 const quota=options.quota??{
  globalPerMinute:config.LINE_GLOBAL_PER_MINUTE,
  perOrgPerMinute:config.LINE_ORG_PER_MINUTE
 };
 if(!Number.isInteger(quota.globalPerMinute)||quota.globalPerMinute<1||quota.globalPerMinute>60||
  !Number.isInteger(quota.perOrgPerMinute)||quota.perOrgPerMinute<1||
  quota.perOrgPerMinute>quota.globalPerMinute)throw new Error("LINE_QUOTA_INVALID");
 const result={mode,attempted:0,accepted:0,simulated:0,retried:0,dead:0,
  quotaLimited:false};
 if(mode==="disabled")return result;
 if(mode==="live"&&!config.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN&&!options.send)
  throw new AppError(503,"LINE_OUTBOUND_TOKEN_REQUIRED");
 const sender=options.send??(async message=>sendLinePushMessage({
  token:config.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN!,...message,now
 }));
 for(let i=0;i<limit;i++){
  const item=await db.transaction(async tx=>{
   const due=or(
    and(inArray(lineOutbox.status,["QUEUED","RETRY"]),lte(lineOutbox.nextAttemptAt,now)),
    and(eq(lineOutbox.status,"SENDING"),lt(lineOutbox.leaseUntil,now))
   );
   // Database-wide transactional advisory lock serializes global and per-org
   // quota reservations across all worker replicas. Never hold during network I/O.
   if(mode==="live"){
    await tx.execute(sql.raw("SELECT pg_advisory_xact_lock(72853019947)"));
    const windowStart=new Date(now.getTime()-60_000);
    const [globalCount]=await tx.select({total:count()}).from(lineDispatchReservations)
     .where(gte(lineDispatchReservations.reservedAt,windowStart));
    if((globalCount?.total??0)>=quota.globalPerMinute){
     result.quotaLimited=true;
     return null;
    }
    const byOrg=await tx.select({
     organizationId:lineDispatchReservations.organizationId,total:count()
    }).from(lineDispatchReservations)
     .where(gte(lineDispatchReservations.reservedAt,windowStart))
     .groupBy(lineDispatchReservations.organizationId);
    const groups=await tx.select({
     organizationId:lineOutbox.organizationId,oldest:min(lineOutbox.createdAt)
    }).from(lineOutbox).where(due).groupBy(lineOutbox.organizationId);
    const used=Object.fromEntries(byOrg.map(row=>[row.organizationId,row.total]));
    const ranked=rankOrgQueues(groups,used,quota.perOrgPerMinute);
    if(groups.length>0&&ranked.length===0)result.quotaLimited=true;
    for(const organizationId of ranked){
     const [candidate]=await tx.select().from(lineOutbox)
      .where(and(due,eq(lineOutbox.organizationId,organizationId)))
      .orderBy(lineOutbox.createdAt).for("update",{skipLocked:true}).limit(1);
     if(!candidate)continue;
     const [claimed]=await tx.update(lineOutbox).set({
      status:"SENDING",attempts:candidate.attempts+1,
      leaseUntil:new Date(now.getTime()+60_000)
     }).where(eq(lineOutbox.id,candidate.id)).returning();
     await tx.insert(lineDispatchReservations).values({
      outboxId:claimed.id,organizationId:claimed.organizationId,reservedAt:now
     });
     return claimed;
    }
    return null;
   }
   const [candidate]=await tx.select().from(lineOutbox).where(due)
    .orderBy(lineOutbox.createdAt).for("update",{skipLocked:true}).limit(1);
   if(!candidate)return null;
   const [claimed]=await tx.update(lineOutbox).set({
    status:"SENDING",attempts:candidate.attempts+1,
    leaseUntil:new Date(now.getTime()+60_000)
   }).where(eq(lineOutbox.id,candidate.id)).returning();
   return claimed;
  });
  if(!item)break;
  result.attempted++;
  const [[oa],[consent],[lease]]=await Promise.all([
   db.select().from(lineOaBindings).where(and(eq(lineOaBindings.id,item.bindingId),
    eq(lineOaBindings.organizationId,item.organizationId),eq(lineOaBindings.enabled,true))).limit(1),
   db.select().from(lineNotificationConsents).where(and(
    eq(lineNotificationConsents.id,item.consentId),
    eq(lineNotificationConsents.bindingId,item.bindingId),
    eq(lineNotificationConsents.organizationId,item.organizationId),
    eq(lineNotificationConsents.leaseId,item.leaseId),
    eq(lineNotificationConsents.recipientLineUserId,item.recipientLineUserId),
    isNull(lineNotificationConsents.revokedAt))).limit(1),
   db.select().from(leases).where(and(eq(leases.id,item.leaseId),
    eq(leases.organizationId,item.organizationId),eq(leases.status,"ACTIVE"),
    eq(leases.tenantLineSubject,item.recipientLineUserId))).limit(1)
  ]);
  let outcome:OutboxSendResult={status:"DEAD",httpStatus:0,requestId:null};
  let code="CONSENT_OR_SCOPE_REVOKED";
  if(oa&&consent&&lease&&(!config.LINE_OA_BOT_USER_ID||oa.botUserId===config.LINE_OA_BOT_USER_ID)){
   if(mode==="simulate"){code="SIMULATED_NO_MESSAGE_SENT";}
   else{
    // LINE retry-key guarantee lasts at most 24 h; stale uncertain sends go to manual DLQ.
    if(now.getTime()-item.createdAt.getTime()>23*3600000){code="RETRY_KEY_WINDOW_EXPIRED";}
    else{
     try{
      // A LINE push cannot be recalled once it has reached the provider.
      // Block any NEW dispatch from starting after consent revocation commits:
      // hold lease -> OA -> consent share locks for the bounded provider call.
      // Revoke takes the lease and consent row FOR UPDATE in the same order.
      // A revoke requested during an already-started provider call waits for it;
      // this does NOT promise to cancel a message already in flight.
      const guarded=await db.transaction(async tx=>{
       const [liveLease]=await tx.select({id:leases.id}).from(leases).where(and(
        eq(leases.id,item.leaseId),eq(leases.organizationId,item.organizationId),
        eq(leases.status,"ACTIVE"),
        eq(leases.tenantLineSubject,item.recipientLineUserId)
       )).for("share").limit(1);
       if(!liveLease)return null;
       const [liveOa]=await tx.select({id:lineOaBindings.id}).from(lineOaBindings)
        .where(and(eq(lineOaBindings.id,item.bindingId),
         eq(lineOaBindings.organizationId,item.organizationId),
         eq(lineOaBindings.enabled,true),
         ...(!config.LINE_OA_BOT_USER_ID?[]:[
          eq(lineOaBindings.botUserId,config.LINE_OA_BOT_USER_ID)
         ])))
        .for("share").limit(1);
       if(!liveOa)return null;
       const [liveConsent]=await tx.select({id:lineNotificationConsents.id})
        .from(lineNotificationConsents).where(and(
         eq(lineNotificationConsents.id,item.consentId),
         eq(lineNotificationConsents.bindingId,item.bindingId),
         eq(lineNotificationConsents.organizationId,item.organizationId),
         eq(lineNotificationConsents.leaseId,item.leaseId),
         eq(lineNotificationConsents.recipientLineUserId,item.recipientLineUserId),
         isNull(lineNotificationConsents.revokedAt)
        )).for("share").limit(1);
       if(!liveConsent)return null;
       return sender({to:item.recipientLineUserId,text:item.messageText,
        retryKey:item.retryKey,createdAt:item.createdAt});
      });
      if(guarded){
       outcome=guarded;
       code=outcome.httpStatus?"HTTP_"+outcome.httpStatus:"NETWORK_FAILURE";
      }else{
       code="CONSENT_OR_SCOPE_REVOKED";
      }
     }catch{outcome={status:"RETRY",httpStatus:0,requestId:null};code="NETWORK_FAILURE";}
    }
   }
  }
  let nextStatus:"ACCEPTED"|"SIMULATED"|"RETRY"|"DEAD";
  if(!oa||!consent||!lease)nextStatus="DEAD";
  else if(config.LINE_OA_BOT_USER_ID&&oa.botUserId!==config.LINE_OA_BOT_USER_ID)nextStatus="DEAD";
  else if(mode==="simulate")nextStatus="SIMULATED";
  else if(outcome.status==="ACCEPTED")nextStatus="ACCEPTED";
  else if(outcome.status==="RETRY"&&item.attempts<5 &&
    now.getTime()-item.createdAt.getTime()<23*3600000)nextStatus="RETRY";
  else nextStatus="DEAD";
  const [updated]=await db.update(lineOutbox).set({
   status:nextStatus,leaseUntil:null,
   nextAttemptAt:nextStatus==="RETRY"?new Date(deliveryPlan(item.attempts,now.getTime())):item.nextAttemptAt,
   lastErrorCode:nextStatus==="ACCEPTED"?null:code,
   providerRequestId:nextStatus==="ACCEPTED"?(outcome.requestId?.slice(0,128)??null):null,
   processedAt:nextStatus==="RETRY"?null:now
  }).where(and(eq(lineOutbox.id,item.id),eq(lineOutbox.status,"SENDING"),
   eq(lineOutbox.attempts,item.attempts))).returning({id:lineOutbox.id});
  if(updated){
   if(nextStatus==="ACCEPTED")result.accepted++;
   else if(nextStatus==="SIMULATED")result.simulated++;
   else if(nextStatus==="RETRY")result.retried++;
   else result.dead++;
  }
 }
 return result;
}
