import {randomUUID} from "node:crypto";
import {spawn} from "node:child_process";
import {strict as assert} from "node:assert";
import {eq} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {
 users,sessions,organizations,memberships,properties,rooms,leases,
 meterReadings,invoices,invoiceLines,paymentClaims,paymentLedger,lineOaBindings,lineNotificationConsents,
 lineOutbox,lineDispatchReservations,auditLogs
} from "../src/db/schema.js";
import {newSessionToken,tokenHash} from "../src/security.js";
import {runLineOutboxBatch} from "../src/services/line-outbox.js";
import {prepareDueReminders} from "../src/services/line-due-reminders.js";

const suffix=randomUUID().slice(0,8),base="http://127.0.0.1:8088";
const bot="U8e742f61d673b39c7fff3cecb7536ef0";
const id={users:[] as string[],sessions:[] as string[],org:"",prop:"",room:"",lease:"",
 invoices:[] as string[],claims:[] as string[],postings:[] as string[],binding:"",
 replacementLease:""};
const child=spawn("node",["--import","tsx","src/index.ts"],{
 cwd:process.cwd(),stdio:"ignore",
 env:{...process.env,LINE_OA_BOT_USER_ID:bot,LINE_OUTBOUND_MODE:"disabled"}
});
async function request(path:string,token:string,method="GET",body:unknown=null,idem?:string){
 const response=await fetch(base+path,{
  method,headers:{"content-type":"application/json",
   cookie:"apartment_session="+token,...(idem?{"idempotency-key":idem}:{})},
  ...(body!==null?{body:JSON.stringify(body)}:{})
 });
 return {status:response.status,body:await response.json() as any};
}
try{
 let ready=false;
 for(let n=0;n<100;n++){
  try{if((await fetch(base+"/readyz")).ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 assert.ok(ready,"API must be ready before consent smoke");
 const tenantSubject="U"+"b".repeat(32),outsiderSubject="U"+"c".repeat(32);
 const [owner,tenant,outsider,manager]=await db.insert(users).values([
  {lineSubject:"smoke-line-owner-"+suffix,displayName:"Smoke Owner"},
  {lineSubject:tenantSubject,displayName:"Smoke Tenant"},
  {lineSubject:outsiderSubject,displayName:"Smoke Outsider"},
  {lineSubject:"smoke-manager-"+suffix,displayName:"Smoke Manager"}
 ]).returning();
 id.users.push(owner.id,tenant.id,outsider.id,manager.id);
 const tokens=[newSessionToken(),newSessionToken(),newSessionToken(),newSessionToken()];
 const sessionsCreated=await db.insert(sessions).values(tokens.map((value,i)=>({
  userId:[owner.id,tenant.id,outsider.id,manager.id][i],tokenHash:tokenHash(value),
  expiresAt:new Date(Date.now()+120000)
 }))).returning();
 id.sessions.push(...sessionsCreated.map(v=>v.id));
 const [org]=await db.insert(organizations).values({name:"Consent Smoke "+suffix}).returning();id.org=org.id;
 await db.insert(memberships).values([
  {organizationId:org.id,userId:owner.id,role:"OWNER"},
  {organizationId:org.id,userId:manager.id,role:"MANAGER"}
 ]);
 const [prop]=await db.insert(properties).values({
  organizationId:org.id,name:"Consent Smoke Property",rentSatang:410000,
  waterSatangPerUnit:100,electricSatangPerUnit:100,complianceReviewedAt:new Date(),
  complianceEvidenceRef:"smoke-review-"+suffix,waterAllowedMax:200,electricAllowedMax:200
 }).returning();id.prop=prop.id;
 const [room]=await db.insert(rooms).values({organizationId:org.id,propertyId:prop.id,number:"C-07",status:"OCCUPIED"}).returning();id.room=room.id;
 const [lease]=await db.insert(leases).values({
  organizationId:org.id,propertyId:prop.id,roomId:room.id,
  tenantName:"Tenant Smoke",tenantLineSubject:tenantSubject,startDate:"2026-08-01"
 }).returning();id.lease=lease.id;
 for(const [kind,idx] of [["WATER",0],["ELECTRIC",1]] as const){
  await db.insert(meterReadings).values(["2026-08-01","2026-09-01","2026-10-01","2026-11-01"]
   .map((date,i)=>({organizationId:org.id,propertyId:prop.id,roomId:room.id,
    kind,readAt:date,value:String(1000+idx*500+i),createdBy:owner.id})));
 }
 const preferencePath="/v1/tenant/notification-consents";
 const changePath="/v1/tenant/leases/"+lease.id+"/notification-consent";
 const denied=await request(changePath,tokens[1],"PUT",{
  enabled:true,policyVersion:"2026-11-v1",acknowledgedPurpose:true
 });
 assert.equal(denied.status,409,JSON.stringify(denied.body));
 const absent=await request(preferencePath,tokens[1]);
 assert.equal(absent.status,200);
 assert.equal(absent.body.length,1);
 assert.equal(absent.body[0].available,false);
 assert.equal(absent.body[0].enabled,false);
 assert.deepEqual((await request(preferencePath,tokens[2])).body,[]);
 assert.equal((await request(changePath,tokens[2],"PUT",{enabled:false})).status,404);
 assert.equal((await request(changePath,tokens[0],"PUT",{enabled:false})).status,404);
 const [binding]=await db.insert(lineOaBindings).values({
  organizationId:org.id,botUserId:bot,enabled:true
 }).returning();id.binding=binding.id;
 const noAck=await request(changePath,tokens[1],"PUT",{enabled:true});
 assert.equal(noAck.status,400);
 const noPolicy=await request(changePath,tokens[1],"PUT",{enabled:true,acknowledgedPurpose:true,policyVersion:"wrong"});
 assert.equal(noPolicy.status,400);
 async function issue(start:string,endExclusive:string,key:string){
  return request("/v1/properties/"+prop.id+"/bills/issue",tokens[0],"POST",
   {roomId:room.id,start,endExclusive},key);
 }
 const pre=await issue("2026-08-01","2026-09-01","unconsented-"+suffix);
 assert.equal(pre.status,201,JSON.stringify(pre.body));
 id.invoices.push(pre.body.invoice.id);
 assert.equal(pre.body.notificationStatus,"INELIGIBLE");
 assert.equal((await db.select().from(lineOutbox).where(eq(lineOutbox.bindingId,binding.id))).length,0);
 const granted=await request(changePath,tokens[1],"PUT",{
  enabled:true,policyVersion:"2026-11-v1",acknowledgedPurpose:true
 });
 assert.equal(granted.status,200,JSON.stringify(granted.body));
 assert.equal(granted.body.enabled,true);
 const replay=await request(changePath,tokens[1],"PUT",{
  enabled:true,policyVersion:"2026-11-v1",acknowledgedPurpose:true
 });
 assert.equal(replay.status,200);
 assert.equal((await request(preferencePath,tokens[1])).body[0].enabled,true);
 const bill=await issue("2026-09-01","2026-10-01","consented-"+suffix);
 assert.equal(bill.status,201,JSON.stringify(bill.body));
 id.invoices.push(bill.body.invoice.id);
 assert.equal(bill.body.notificationStatus,"QUEUED");
 const retried=await issue("2026-09-01","2026-10-01","consented-"+suffix);
 assert.equal(retried.status,200);
 assert.equal(retried.body.replayed,true);
 let entries=await db.select().from(lineOutbox).where(eq(lineOutbox.bindingId,binding.id));
 assert.equal(entries.length,1);
 assert.equal(entries[0].status,"QUEUED");
 assert.equal(entries[0].eventKey,"BILL_ISSUED:"+bill.body.invoice.id);
 assert.ok(entries[0].messageText.includes("ใบแจ้งหนี้"));
 assert.equal(entries[0].messageText.includes("Tenant Smoke"),false);
 const revoked=await request(changePath,tokens[1],"PUT",{enabled:false});
 assert.equal(revoked.status,200,JSON.stringify(revoked.body));
 assert.equal(revoked.body.enabled,false);
 entries=await db.select().from(lineOutbox).where(eq(lineOutbox.bindingId,binding.id));
 assert.equal(entries[0].status,"DEAD");
 assert.equal(entries[0].lastErrorCode,"TENANT_CONSENT_REVOKED");
 assert.equal((await request(preferencePath,tokens[1])).body[0].enabled,false);
 assert.equal((await request(changePath,tokens[1],"PUT",{enabled:false})).status,200);
 const reg=await request(changePath,tokens[1],"PUT",{
  enabled:true,policyVersion:"2026-11-v1",acknowledgedPurpose:true
 });
 assert.equal(reg.status,200);
 // Re-grant must NEVER resurrect the old dead-letter notification.
 entries=await db.select().from(lineOutbox).where(eq(lineOutbox.bindingId,binding.id));
 assert.equal(entries[0].status,"DEAD");
 const next=await issue("2026-10-01","2026-11-01","reactivated-"+suffix);
 assert.equal(next.status,201,JSON.stringify(next.body));
 assert.equal(next.body.notificationStatus,"QUEUED");
 id.invoices.push(next.body.invoice.id);
 entries=await db.select().from(lineOutbox).where(eq(lineOutbox.bindingId,binding.id));
 assert.equal(entries.length,2);
 const dueOptions={date:"2026-11-08",organizationId:org.id,now:new Date("2026-11-08T03:00:00Z")};
 const dryDue=await prepareDueReminders(dueOptions);
 assert.equal(dryDue.mode,"DRY_RUN");assert.equal(dryDue.candidates,1);
 await assert.rejects(()=>prepareDueReminders({...dueOptions,apply:true,now:new Date("2026-11-03T03:00:00Z")}),
  {code:"DUE_REMINDER_MUST_RUN_ON_LOCAL_DUE_DATE"});
 assert.equal((await prepareDueReminders({...dueOptions,organizationId:randomUUID()})).candidates,0);
 const [pending]=await db.insert(paymentClaims).values({organizationId:org.id,
  propertyId:prop.id,invoiceId:next.body.invoice.id,leaseId:lease.id,submittedBy:tenant.id,
  amountSatang:1000,paidAt:new Date(),transferReference:"SMOKE-"+suffix,
  evidenceKey:randomUUID(),evidenceSha256:"a".repeat(64),idempotencyKey:"due-test-"+suffix
 }).returning();id.claims.push(pending.id);
 const skipped=await prepareDueReminders({...dueOptions,apply:true});
 assert.equal(skipped.queued,0);assert.equal(skipped.skipped,1); // pending claim guard
 await db.delete(paymentClaims).where(eq(paymentClaims.id,pending.id));id.claims=[];
 // Full manual payment already recorded: a reminder would encourage an overpayment.
 const [paid]=await db.insert(paymentClaims).values({organizationId:org.id,
  propertyId:prop.id,invoiceId:next.body.invoice.id,leaseId:lease.id,submittedBy:tenant.id,
  amountSatang:next.body.invoice.amountSatang,paidAt:new Date(),
  transferReference:"SMOKE-FULL-"+suffix,evidenceKey:randomUUID(),
  evidenceSha256:"b".repeat(64),idempotencyKey:"fully-paid-"+suffix,status:"APPROVED"
 }).returning();id.claims.push(paid.id);
 const [posting]=await db.insert(paymentLedger).values({organizationId:org.id,
  propertyId:prop.id,invoiceId:next.body.invoice.id,claimId:paid.id,
  amountSatang:next.body.invoice.amountSatang,createdBy:owner.id
 }).returning();id.postings.push(posting.id);
 const fullyPaid=await prepareDueReminders({...dueOptions,apply:true});
 assert.equal(fullyPaid.queued,0);assert.equal(fullyPaid.skipped,1);
 await db.delete(paymentLedger).where(eq(paymentLedger.id,posting.id));id.postings=[];
 await db.delete(paymentClaims).where(eq(paymentClaims.id,paid.id));id.claims=[];
 const firstDue=await prepareDueReminders({...dueOptions,apply:true});
 assert.equal(firstDue.queued,1);
 const replayDue=await prepareDueReminders({...dueOptions,apply:true});
 assert.equal(replayDue.alreadyQueued,1);
 entries=await db.select().from(lineOutbox).where(eq(lineOutbox.bindingId,binding.id));
 assert.equal(entries.length,3);
 assert.equal(entries.filter(x=>x.templateKey==="PAYMENT_DUE").length,1);
 assert.equal((await runLineOutboxBatch({mode:"disabled"})).attempted,0);
 const history=await db.select().from(auditLogs).where(eq(auditLogs.actorId,tenant.id));
 assert.equal(history.filter(x=>x.action==="LINE_NOTIFICATION_CONSENT_GRANTED").length,2);
 assert.equal(history.filter(x=>x.action==="LINE_NOTIFICATION_CONSENT_REVOKED").length,1);
 // P1-01 OWNER move-out: settlement is mandatory, original bills preserved.
 const movePath="/v1/properties/"+prop.id+"/leases/"+lease.id+"/move-out";
 const moveBody={endExclusive:"2026-11-01",roomDisposition:"AVAILABLE",confirmedHandover:true};
 assert.equal((await request(movePath,tokens[1],"POST",moveBody)).status,403);
 assert.equal((await request(movePath,tokens[2],"POST",moveBody)).status,403);
 assert.equal((await request(movePath,tokens[3],"POST",moveBody)).body.error,
  "LEASE_MOVE_OUT_OWNER_REQUIRED");
 const notSettled=await request(movePath,tokens[0],"POST",moveBody);
 assert.equal(notSettled.status,409,JSON.stringify(notSettled.body));
 assert.equal(notSettled.body.error,"MOVE_OUT_UNSETTLED_INVOICES");
 const badDate=await request(movePath,tokens[0],"POST",{...moveBody,endExclusive:"2027-01-01"});
 assert.equal(badDate.status,422);
 const bills=await db.select().from(invoices).where(eq(invoices.leaseId,lease.id));
 assert.equal(bills.length,3);
 // Create an unresolved claim; move-out must fail even if bills become paid.
 const [unresolved]=await db.insert(paymentClaims).values({
  organizationId:org.id,propertyId:prop.id,invoiceId:bills[0].id,
  leaseId:lease.id,submittedBy:tenant.id,amountSatang:100,paidAt:new Date(),
  transferReference:"P1-PENDING-"+suffix,evidenceKey:randomUUID(),
  evidenceSha256:"c".repeat(64),idempotencyKey:"move-pending-"+suffix
 }).returning();
 id.claims.push(unresolved.id);
 assert.equal((await request(movePath,tokens[0],"POST",moveBody)).body.error,
  "MOVE_OUT_PENDING_PAYMENT");
 await db.delete(paymentClaims).where(eq(paymentClaims.id,unresolved.id));
 id.claims=id.claims.filter(x=>x!==unresolved.id);
 for(const invoice of bills){
  const [claim]=await db.insert(paymentClaims).values({
   organizationId:org.id,propertyId:prop.id,invoiceId:invoice.id,
   leaseId:lease.id,submittedBy:tenant.id,amountSatang:invoice.amountSatang,
   paidAt:new Date(),transferReference:"P1-SETTLED-"+invoice.id,
   evidenceKey:randomUUID(),evidenceSha256:"d".repeat(64),
   idempotencyKey:"move-settled-"+invoice.id,status:"APPROVED"
  }).returning();
  id.claims.push(claim.id);
  const [ledger]=await db.insert(paymentLedger).values({
   organizationId:org.id,propertyId:prop.id,invoiceId:invoice.id,
   claimId:claim.id,amountSatang:invoice.amountSatang,createdBy:owner.id
  }).returning();
  id.postings.push(ledger.id);
 }
 const released=await request(movePath,tokens[0],"POST",moveBody);
 assert.equal(released.status,200,JSON.stringify(released.body));
 assert.equal(released.body.status,"ENDED");
 assert.equal(released.body.roomStatus,"AVAILABLE");
 assert.equal((await request(movePath,tokens[0],"POST",moveBody)).status,409);
 const [moved]=await db.select().from(leases).where(eq(leases.id,lease.id));
 assert.equal(moved.status,"ENDED");assert.equal(moved.endDate,"2026-11-01");
 const [availableRoom]=await db.select().from(rooms).where(eq(rooms.id,room.id));
 assert.equal(availableRoom.status,"AVAILABLE");
 const [oldConsent]=await db.select().from(lineNotificationConsents)
  .where(eq(lineNotificationConsents.leaseId,lease.id));
 assert.ok(oldConsent.revokedAt);
 const pendingOutbox=await db.select().from(lineOutbox)
  .where(eq(lineOutbox.leaseId,lease.id));
 assert.equal(pendingOutbox.filter(x=>["QUEUED","RETRY","SENDING"].includes(x.status)).length,0);
 assert.ok((await db.select().from(auditLogs).where(eq(auditLogs.actorId,owner.id)))
  .some(x=>x.action==="LEASE_MOVED_OUT"&&x.targetId===lease.id));
 assert.equal((await db.select().from(invoices).where(eq(invoices.leaseId,lease.id))).length,3);
 const replacement=await request("/v1/properties/"+prop.id+"/leases",tokens[0],"POST",
  {roomId:room.id,tenantName:"Replacement Fixture",startDate:"2026-11-01"});
 assert.equal(replacement.status,201,JSON.stringify(replacement.body));
 id.replacementLease=replacement.body.id;
 console.log("PASS P1-01 move-out: owner-only, unsettled/pending guard, final meters/bill, immutable history, room reuse, consent/outbox revoke, audit");
 console.log("PASS LINE tenant consent and reminders: IDOR 404, missing OA 409, explicit ack 400, no prior messages, atomic invoice/outbox, replay dedupe, revoke DEAD, regrant, pending/fully paid suppress due, Bangkok-date guard and idempotency, disabled worker no send");
}finally{
 child.kill("SIGTERM");
 for(const postId of id.postings)await db.delete(paymentLedger).where(eq(paymentLedger.id,postId));
 for(const claimId of id.claims)await db.delete(paymentClaims).where(eq(paymentClaims.id,claimId));
 if(id.org)await db.delete(lineDispatchReservations).where(eq(lineDispatchReservations.organizationId,id.org));
 if(id.binding)await db.delete(lineOutbox).where(eq(lineOutbox.bindingId,id.binding));
 if(id.binding)await db.delete(lineNotificationConsents).where(eq(lineNotificationConsents.bindingId,id.binding));
 if(id.binding)await db.delete(lineOaBindings).where(eq(lineOaBindings.id,id.binding));
 for(const invoiceId of id.invoices){
  await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId,invoiceId));
  await db.delete(invoices).where(eq(invoices.id,invoiceId));
 }
 if(id.room)await db.delete(meterReadings).where(eq(meterReadings.roomId,id.room));
 if(id.replacementLease)await db.delete(leases).where(eq(leases.id,id.replacementLease));
 if(id.lease)await db.delete(leases).where(eq(leases.id,id.lease));
 if(id.room)await db.delete(rooms).where(eq(rooms.id,id.room));
 if(id.prop)await db.delete(properties).where(eq(properties.id,id.prop));
 if(id.org)await db.delete(memberships).where(eq(memberships.organizationId,id.org));
 for(const uid of id.users)await db.delete(auditLogs).where(eq(auditLogs.actorId,uid));
 if(id.org)await db.delete(organizations).where(eq(organizations.id,id.org));
 for(const sessionId of id.sessions)await db.delete(sessions).where(eq(sessions.id,sessionId));
 for(const uid of id.users)await db.delete(users).where(eq(users.id,uid));
 await sqlClient.end();
}
