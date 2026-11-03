import {createHmac,randomUUID} from "node:crypto";
import {spawn} from "node:child_process";
import {strict as assert} from "node:assert";
import {eq} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {users,organizations,properties,rooms,leases,invoiceLines,
 lineOaBindings,lineWebhookEvents,lineNotificationConsents,lineOutbox,
 memberships,financeAdjustmentRequests,auditLogs} from "../src/db/schema.js";
import {enqueueLineNotification,runLineOutboxBatch} from "../src/services/line-outbox.js";
const tag=randomUUID().slice(0,8),base="http://127.0.0.1:8088";
const bot="U8e742f61d673b39c7fff3cecb7536ef0";
const tenantLineId="U"+"a".repeat(32);
const secret="test-line-webhook-"+tag;
const child=spawn("node",["--import","tsx","src/index.ts"],{
 cwd:process.cwd(),stdio:"ignore",
 env:{...process.env,LINE_OA_BOT_USER_ID:bot,LINE_MESSAGING_CHANNEL_SECRET:secret,
  LINE_OUTBOUND_MODE:"disabled"}
});
const ids:{user?:string;org?:string;prop?:string;room?:string;lease?:string;binding?:string;consent?:string}={};
const sign=(s:string)=>createHmac("sha256",secret).update(s).digest("base64");
async function sendWebhook(body:string,signature=sign(body)){
 const r=await fetch(base+"/v1/line/oa/webhook",{
  method:"POST",headers:{"content-type":"application/json","x-line-signature":signature},
  body
 });
 return {status:r.status,body:await r.json() as any};
}
try{
 let started=false;
 for(let i=0;i<80;i++){
  try{if((await fetch(base+"/readyz")).ok){started=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 assert.ok(started,"child server must start");
 const [u]=await db.insert(users).values({lineSubject:tenantLineId,displayName:"LINE OA Fixture "+tag}).returning();ids.user=u.id;
 const [o]=await db.insert(organizations).values({name:"LINE OA Org "+tag}).returning();ids.org=o.id;
 const [p]=await db.insert(properties).values({organizationId:o.id,name:"LINE OA Property",
  rentSatang:500000,waterSatangPerUnit:10,electricSatangPerUnit:10}).returning();ids.prop=p.id;
 const [r]=await db.insert(rooms).values({organizationId:o.id,propertyId:p.id,
  number:"L01",status:"OCCUPIED"}).returning();ids.room=r.id;
 const [l]=await db.insert(leases).values({organizationId:o.id,propertyId:p.id,roomId:r.id,
  tenantName:"LINE Fixture",tenantLineSubject:tenantLineId,startDate:"2026-10-01"}).returning();ids.lease=l.id;
 const [binding]=await db.insert(lineOaBindings).values({
  organizationId:o.id,botUserId:bot,enabled:true
 }).returning();ids.binding=binding.id;
 const [consent]=await db.insert(lineNotificationConsents).values({
  bindingId:binding.id,organizationId:o.id,leaseId:l.id,recipientLineUserId:tenantLineId,
  evidenceRef:"Test fixture consent; not a real tenant"
 }).returning();ids.consent=consent.id;
 const eventId="E"+randomUUID();
 const webhookBody=JSON.stringify({destination:bot,events:[{
  webhookEventId:eventId,type:"message",deliveryContext:{isRedelivery:false},
  source:{type:"user",userId:tenantLineId},
  message:{type:"text",text:"Secret user message must never be stored"}
 }]});
 assert.equal((await sendWebhook(webhookBody,"invalid")).status,401);
 const accepted=await sendWebhook(webhookBody);
 assert.equal(accepted.status,200,JSON.stringify(accepted.body));
 assert.equal(accepted.body.accepted,1);
 assert.equal((await sendWebhook(webhookBody)).body.duplicates,1);
 const events=await db.select().from(lineWebhookEvents).where(eq(lineWebhookEvents.bindingId,binding.id));
 assert.equal(events.length,1);assert.equal(events[0].eventType,"message");
 assert.ok(!JSON.stringify(events).includes("Secret user message"));
 assert.equal((await sendWebhook("{invalid")).status,400);
 const invalidDestination=JSON.stringify({destination:"U"+"f".repeat(32),events:[]});
 assert.equal((await sendWebhook(invalidDestination)).status,404);
 const baseNotification={
  bindingId:binding.id,organizationId:o.id,leaseId:l.id,consentId:consent.id,
  recipientLineUserId:tenantLineId,templateKey:"BILL_ISSUED" as const,
  messageText:"Your invoice is available."
 };
 const out=await enqueueLineNotification({...baseNotification,eventKey:"bill:"+tag+":1"});
 assert.equal(out.replayed,false);
 assert.equal((await enqueueLineNotification({...baseNotification,eventKey:"bill:"+tag+":1"})).replayed,true);
 await assert.rejects(()=>enqueueLineNotification({
  ...baseNotification,eventKey:"bill:"+tag+":1",messageText:"A different message!"
 }),{code:"LINE_OUTBOX_IDEMPOTENCY_CONFLICT"});
 let sent=0;
 const simulated=await runLineOutboxBatch({mode:"simulate",limit:1,
  send:async()=>{sent++;throw Error("must not send");}});
 assert.equal(simulated.simulated,1);
 assert.equal(sent,0,"Simulate must never call sender");
 const [afterSim]=await db.select().from(lineOutbox).where(eq(lineOutbox.id,out.entry.id));
 assert.equal(afterSim.status,"SIMULATED");
 const retry=await enqueueLineNotification({...baseNotification,eventKey:"bill:"+tag+":2"});
 const retryKey=retry.entry.retryKey;
 const first=await runLineOutboxBatch({mode:"live",limit:1,
  send:async message=>{sent++;assert.equal(message.retryKey,retryKey);return {status:"RETRY",httpStatus:429,requestId:null};}
 });
 assert.equal(first.retried,1);
 const [postRetry]=await db.select().from(lineOutbox).where(eq(lineOutbox.id,retry.entry.id));
 assert.equal(postRetry.status,"RETRY");
 const second=await runLineOutboxBatch({mode:"live",limit:1,now:new Date(postRetry.nextAttemptAt.getTime()+100),
  send:async message=>{sent++;assert.equal(message.retryKey,retryKey);return {status:"ACCEPTED",httpStatus:200,requestId:"mock-req-1"};}
 });
 assert.equal(second.accepted,1);
 const [posted]=await db.select().from(lineOutbox).where(eq(lineOutbox.id,retry.entry.id));
 assert.equal(posted.status,"ACCEPTED");assert.equal(posted.retryKey,retryKey);
 const third=await enqueueLineNotification({...baseNotification,eventKey:"bill:"+tag+":3"});
 await db.update(lineNotificationConsents).set({revokedAt:new Date()}).where(eq(lineNotificationConsents.id,consent.id));
 const dead=await runLineOutboxBatch({mode:"live",limit:1,
  send:async()=>{sent++;throw Error("revoked consent must never send");}
 });
 assert.equal(dead.dead,1);
 const [last]=await db.select().from(lineOutbox).where(eq(lineOutbox.id,third.entry.id));
 assert.equal(last.status,"DEAD");
 assert.equal(sent,2);
 console.log("PASS LINE OA HTTP: raw signature/401, malformed/400, destination/404, DB event dedupe/no message PII; consent-bound outbox idempotency, SIMULATED no send, 429 retry stable key, ACCEPTED, consent revoked DEAD");
}finally{
 child.kill("SIGTERM");
 if(ids.binding)await db.delete(lineOutbox).where(eq(lineOutbox.bindingId,ids.binding));
 if(ids.binding)await db.delete(lineWebhookEvents).where(eq(lineWebhookEvents.bindingId,ids.binding));
 if(ids.binding)await db.delete(lineNotificationConsents).where(eq(lineNotificationConsents.bindingId,ids.binding));
 if(ids.binding)await db.delete(lineOaBindings).where(eq(lineOaBindings.id,ids.binding));
 if(ids.lease)await db.delete(leases).where(eq(leases.id,ids.lease));
 if(ids.room)await db.delete(rooms).where(eq(rooms.id,ids.room));
 if(ids.prop)await db.delete(properties).where(eq(properties.id,ids.prop));
 if(ids.org)await db.delete(organizations).where(eq(organizations.id,ids.org));
 if(ids.user)await db.delete(users).where(eq(users.id,ids.user));
 await sqlClient.end();
}
