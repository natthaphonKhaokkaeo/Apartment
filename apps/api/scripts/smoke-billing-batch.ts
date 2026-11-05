import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {strict as assert} from "node:assert";
import {and,eq,inArray} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {auditLogs,billingBatchRuns,invoiceLines,invoices,leases,memberships,meterReadings,organizations,properties,rooms,sessions,users} from "../src/db/schema.js";
import {newSessionToken,tokenHash} from "../src/security.js";

const base="http://127.0.0.1:8088",tag=randomUUID().slice(0,8);
const ids={users:[] as string[],sessions:[] as string[],orgs:[] as string[],properties:[] as string[],
 rooms:[] as string[],leases:[] as string[],readings:[] as string[],runs:[] as string[],invoices:[] as string[]};
const child=spawn("node",["--import","tsx","src/index.ts"],{cwd:process.cwd(),stdio:"ignore",env:process.env});
type Reply={status:number;body:any};
async function request(path:string,token:string,method="GET",body?:unknown,key?:string):Promise<Reply>{
 const response=await fetch(base+path,{method,headers:{cookie:"apartment_session="+token,
  ...(body===undefined?{}:{"content-type":"application/json"}),...(key?{"idempotency-key":key}:{})},
  ...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:response.status,body:await response.json()};
}
async function createSession(userId:string){
 const token=newSessionToken();const [row]=await db.insert(sessions).values({userId,
  tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+300000)}).returning();
 ids.sessions.push(row.id);return token;
}
async function main(){
 const deadline=Date.now()+15000;let ready=false;
 while(Date.now()<deadline){try{if((await fetch(base+"/readyz")).ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,200));}
 assert.equal(ready,true,"DEV API not ready");
 const [owner,manager,tenant,outsider]=await db.insert(users).values([
  {lineSubject:"batch-owner-"+tag,displayName:"Synthetic batch owner"},
  {lineSubject:"batch-manager-"+tag,displayName:"Synthetic batch manager"},
  {lineSubject:"batch-tenant-"+tag,displayName:"Synthetic batch tenant"},
  {lineSubject:"batch-outsider-"+tag,displayName:"Synthetic batch outsider"}
 ]).returning();ids.users.push(owner.id,manager.id,tenant.id,outsider.id);
 const ownerToken=await createSession(owner.id),managerToken=await createSession(manager.id),
  tenantToken=await createSession(tenant.id),outsiderToken=await createSession(outsider.id);
 const [org,foreignOrg]=await db.insert(organizations).values([
  {name:"Billing batch smoke "+tag},{name:"Billing batch foreign "+tag}
 ]).returning();ids.orgs.push(org.id,foreignOrg.id);
 await db.insert(memberships).values([
  {organizationId:org.id,userId:owner.id,role:"OWNER"},
  {organizationId:org.id,userId:manager.id,role:"MANAGER"}
 ]);
 const common={complianceReviewedAt:new Date(),complianceEvidenceRef:"SYNTHETIC_BILLING_BATCH_NOT_LEGAL",
  waterAllowedMax:100,electricAllowedMax:100};
 const [property,foreignProperty]=await db.insert(properties).values([
  {organizationId:org.id,name:"Batch smoke "+tag,rentSatang:1000,waterSatangPerUnit:100,
   electricSatangPerUnit:100,...common},
  {organizationId:foreignOrg.id,name:"Foreign batch "+tag,rentSatang:1000,
   waterSatangPerUnit:100,electricSatangPerUnit:100,...common}
 ]).returning();ids.properties.push(property.id,foreignProperty.id);
 const [validRoom,secondRoom,missingRoom,availableRoom]=await db.insert(rooms).values([
  {organizationId:org.id,propertyId:property.id,number:"B1-"+tag,status:"OCCUPIED"},
  {organizationId:org.id,propertyId:property.id,number:"B2-"+tag,status:"OCCUPIED"},
  {organizationId:org.id,propertyId:property.id,number:"B3-"+tag,status:"OCCUPIED"},
  {organizationId:org.id,propertyId:property.id,number:"B4-"+tag,status:"AVAILABLE"}
 ]).returning();ids.rooms.push(validRoom.id,secondRoom.id,missingRoom.id,availableRoom.id);
 const [lease1,lease2,lease3]=await db.insert(leases).values([
  {organizationId:org.id,propertyId:property.id,roomId:validRoom.id,tenantName:"Synthetic batch tenant 1",startDate:"2026-01-01"},
  {organizationId:org.id,propertyId:property.id,roomId:secondRoom.id,tenantName:"Synthetic batch tenant 2",startDate:"2026-01-01"},
  {organizationId:org.id,propertyId:property.id,roomId:missingRoom.id,tenantName:"Synthetic batch tenant 3",startDate:"2026-01-01"}
 ]).returning();ids.leases.push(lease1.id,lease2.id,lease3.id);
 const readingRows=[] as (typeof meterReadings.$inferInsert)[];
 for(const room of [validRoom,secondRoom])for(const kind of ["WATER","ELECTRIC"] as const){
  readingRows.push({organizationId:org.id,propertyId:property.id,roomId:room.id,kind,
   readAt:"2026-02-01",value:"1.000",createdBy:owner.id});
  readingRows.push({organizationId:org.id,propertyId:property.id,roomId:room.id,kind,
   readAt:"2026-03-01",value:"2.000",createdBy:owner.id});
 }
 const inserted=await db.insert(meterReadings).values(readingRows).returning({id:meterReadings.id});
 ids.readings.push(...inserted.map(r=>r.id));
 const path="/v1/properties/"+property.id+"/billing-batch-runs";
 const period={start:"2026-02-01",endExclusive:"2026-03-01"};
 assert.equal((await request(path+"/preview",managerToken,"POST",period,"batch-manager-"+tag)).status,403);
 assert.equal((await request(path+"/preview",tenantToken,"POST",period,"batch-tenant-"+tag)).status,403);
 assert.equal((await request("/v1/properties/"+foreignProperty.id+
  "/billing-batch-runs/preview",ownerToken,"POST",period,"batch-foreign-"+tag)).status,403);
 assert.equal((await request(path+"/preview",outsiderToken,"POST",period,"batch-outsider-"+tag)).status,403);
 const key="batch-preview-"+tag;
 const preview=await request(path+"/preview",ownerToken,"POST",period,key);
 assert.equal(preview.status,201,JSON.stringify(preview.body));
 assert.equal(preview.body.replayed,false);
 ids.runs.push(preview.body.id);
 assert.equal(preview.body.status,"PREVIEWED");
 const snapshot=preview.body.previewSnapshot;
 assert.equal(snapshot.rooms.length,3,"only occupied rooms belong in the preview");
 assert.equal(snapshot.rooms.filter((r:any)=>r.status==="READY").length,2);
 assert.equal(snapshot.rooms.filter((r:any)=>r.status==="SKIPPED").length,1);
 assert.equal(snapshot.rooms.find((r:any)=>r.roomId===missingRoom.id)?.reason,"METER_BOUNDARY_READING_REQUIRED");
 assert.ok(snapshot.rooms.filter((r:any)=>r.status==="READY").every((r:any)=>r.amountSatang===1200));
 const repeated=await request(path+"/preview",ownerToken,"POST",period,key);
 assert.equal(repeated.status,200);assert.equal(repeated.body.replayed,true);
 assert.equal(repeated.body.id,preview.body.id,"same key returns the same preview run");
 const reused=await request(path+"/preview",ownerToken,"POST",{start:"2026-03-01",endExclusive:"2026-04-01"},key);
 assert.equal(reused.status,409,"key cannot be reused for another period");
 const approvePath=path+"/"+preview.body.id+"/approve";
 assert.equal((await request(approvePath,ownerToken,"POST",{confirmed:true,previewHash:"0".repeat(64)})).status,409);

 // Change a metered amount after preview; approval must mark the run stale and issue nothing.
 await db.update(meterReadings).set({value:"3.000"}).where(eq(meterReadings.id,inserted[1]!.id));
 const stale=await request(approvePath,ownerToken,"POST",{confirmed:true,previewHash:preview.body.previewHash});
 assert.equal(stale.status,409,JSON.stringify(stale.body));
 assert.equal(stale.body.run.status,"STALE");
 const staleInvoices=await db.select({id:invoices.id}).from(invoices)
  .where(eq(invoices.billingBatchRunId,preview.body.id));
 assert.equal(staleInvoices.length,0,"stale run must create no partial invoices");
 console.log("PASS billing batch: owner-only preview, room eligibility, key replay/reuse, hash guard and stale-preview all-or-nothing");

 const fresh=await request(path+"/preview",ownerToken,"POST",period,"batch-fresh-"+tag);
 assert.equal(fresh.status,201,JSON.stringify(fresh.body));ids.runs.push(fresh.body.id);
 assert.equal(fresh.body.replayed,false);
 assert.equal(fresh.body.previewSnapshot.rooms.filter((r:any)=>r.status==="READY").length,2);
 const approve=await request(path+"/"+fresh.body.id+"/approve",ownerToken,"POST",{
  confirmed:true,previewHash:fresh.body.previewHash});
 assert.equal(approve.status,201,JSON.stringify(approve.body));
 assert.equal(approve.body.run.status,"COMPLETED");assert.equal(approve.body.run.issuedCount,2);
 const issued=await db.select({id:invoices.id,amountSatang:invoices.amountSatang,
  runId:invoices.billingBatchRunId}).from(invoices).where(eq(invoices.billingBatchRunId,fresh.body.id));
 const expectedAmounts=fresh.body.previewSnapshot.rooms
  .filter((r:any)=>r.status==="READY").map((r:any)=>r.amountSatang).sort((a:number,b:number)=>a-b);
 assert.deepEqual(expectedAmounts,[1200,1300],"meter change must alter exactly one invoice amount");
 assert.equal(issued.length,2);
 assert.ok(issued.every(i=>i.runId===fresh.body.id));
 assert.deepEqual(issued.map(i=>i.amountSatang).sort((a,b)=>a-b),expectedAmounts);
 ids.invoices.push(...issued.map(i=>i.id));
 const replay=await request(path+"/"+fresh.body.id+"/approve",ownerToken,"POST",{
  confirmed:true,previewHash:fresh.body.previewHash});
 assert.equal(replay.status,200);assert.equal(replay.body.replayed,true);
 const concurrent=await Promise.all(Array.from({length:5},()=>request(
  path+"/"+fresh.body.id+"/approve",ownerToken,"POST",
  {confirmed:true,previewHash:fresh.body.previewHash})));
 assert.ok(concurrent.every(r=>r.status===200&&r.body.replayed===true),
  "concurrent approval replay must remain idempotent");
 const afterReplay=await db.select({id:invoices.id}).from(invoices)
  .where(eq(invoices.billingBatchRunId,fresh.body.id));
 assert.equal(afterReplay.length,2,"approval replay must not create invoices twice");
 const lines=await db.select({invoiceId:invoiceLines.invoiceId,amountSatang:invoiceLines.amountSatang})
  .from(invoiceLines).where(inArray(invoiceLines.invoiceId,afterReplay.map(i=>i.id)));
 assert.equal(lines.length,6);
 assert.equal(lines.reduce((sum,l)=>sum+l.amountSatang,0),2500,
  "meter edit must be included in final immutable invoice line total");
 const audit=await db.select({action:auditLogs.action}).from(auditLogs)
  .where(and(eq(auditLogs.organizationId,org.id),eq(auditLogs.targetId,fresh.body.id)));
 assert.ok(audit.some(r=>r.action==="BILLING_BATCH_COMPLETED"));
 console.log("PASS billing batch: approved preview issues all eligible invoices atomically, records run linkage/audit and replay creates no duplicates");
 let inFlight:Promise<Reply>[]=[];
 await sqlClient.begin(async transaction=>{
  await transaction`UPDATE memberships SET status='DISABLED' WHERE user_id=${owner.id} AND organization_id=${org.id}`;
  inFlight=Array.from({length:3},()=>request(path+"/"+fresh.body.id+"/approve",ownerToken,"POST",{confirmed:true,previewHash:fresh.body.previewHash}));
  await new Promise(resolve=>setTimeout(resolve,250));
 });
 const revoked=await Promise.all(inFlight);
 assert.ok(revoked.every(r=>r.status===403),"owner revoke must serialize with batch approval, including completed replay");
 console.log("PASS billing batch: concurrent owner membership revocation denies all approval/replay attempts");

}
async function cleanup(){
 child.kill("SIGTERM");
 const runInvoices=ids.runs.length?await db.select({id:invoices.id}).from(invoices)
  .where(inArray(invoices.billingBatchRunId,ids.runs)):[];
 const invoiceIds=[...new Set([...ids.invoices,...runInvoices.map(i=>i.id)])];
 if(invoiceIds.length)await db.delete(invoiceLines).where(inArray(invoiceLines.invoiceId,invoiceIds));
 if(ids.orgs.length)await db.delete(auditLogs).where(inArray(auditLogs.organizationId,ids.orgs));
 if(invoiceIds.length)await db.delete(invoices).where(inArray(invoices.id,invoiceIds));
 if(ids.runs.length)await db.delete(billingBatchRuns).where(inArray(billingBatchRuns.id,ids.runs));
 if(ids.readings.length)await db.delete(meterReadings).where(inArray(meterReadings.id,ids.readings));
 if(ids.leases.length)await db.delete(leases).where(inArray(leases.id,ids.leases));
 if(ids.rooms.length)await db.delete(rooms).where(inArray(rooms.id,ids.rooms));
 if(ids.properties.length)await db.delete(properties).where(inArray(properties.id,ids.properties));
 if(ids.orgs.length){await db.delete(memberships).where(inArray(memberships.organizationId,ids.orgs));
  await db.delete(organizations).where(inArray(organizations.id,ids.orgs));}
 if(ids.sessions.length)await db.delete(sessions).where(inArray(sessions.id,ids.sessions));
 if(ids.users.length)await db.delete(users).where(inArray(users.id,ids.users));
 await sqlClient.end();
}
try{await main();}finally{await cleanup();}
