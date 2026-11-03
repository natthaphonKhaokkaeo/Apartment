import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {strict as assert} from "node:assert";
import {and,eq,inArray} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {auditLogs,invoiceLines,invoices,leases,memberships,meterReadings,organizations,properties,rooms,sessions,users} from "../src/db/schema.js";
import {newSessionToken,tokenHash} from "../src/security.js";

const base="http://127.0.0.1:8088",tag=randomUUID().slice(0,8);
const tracked={userIds:[] as string[],sessionIds:[] as string[],orgIds:[] as string[],propertyIds:[] as string[],
 roomIds:[] as string[],leaseIds:[] as string[],readingIds:[] as string[]};
const child=spawn("node",["--import","tsx","src/index.ts"],{
 cwd:process.cwd(),stdio:"ignore",env:process.env
});
type Reply={status:number;body:any;elapsedMs:number};
async function request(path:string,token:string,method="GET",body?:unknown,key?:string):Promise<Reply>{
 const began=performance.now();
 const response=await fetch(base+path,{method,headers:{
  cookie:"apartment_session="+token,
  ...(body===undefined?{}:{"content-type":"application/json"}),
  ...(key?{"idempotency-key":key}:{})
 },...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:response.status,body:await response.json(),elapsedMs:performance.now()-began};
}
function p95(times:number[]){
 const sorted=[...times].sort((a,b)=>a-b);
 return Math.round(sorted[Math.ceil(sorted.length*0.95)-1]??0);
}
async function main(){
 const deadline=Date.now()+15000;
 let ready=false;
 while(Date.now()<deadline){
  try{if((await fetch(base+"/readyz")).ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,200));
 }
 assert.equal(ready,true,"DEV API not ready");
 const [user]=await db.insert(users).values({
  lineSubject:"p105-"+tag,displayName:"P105 isolated synthetic owner"
 }).returning();tracked.userIds.push(user.id);
 const token=newSessionToken();
 const [session]=await db.insert(sessions).values({
  userId:user.id,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+300000)
 }).returning();tracked.sessionIds.push(session.id);
 const [org,otherOrg]=await db.insert(organizations).values([
  {name:"P105 isolated A "+tag},{name:"P105 isolated B "+tag}
 ]).returning();tracked.orgIds.push(org.id,otherOrg.id);
 await db.insert(memberships).values({organizationId:org.id,userId:user.id,role:"OWNER"});
 const common={complianceReviewedAt:new Date(),complianceEvidenceRef:"P105_SYNTHETIC_NOT_LEGAL"};
 const [property,overflowProperty,foreignProperty]=await db.insert(properties).values([
  {organizationId:org.id,name:"P105 normal "+tag,rentSatang:1000,waterSatangPerUnit:100,
   electricSatangPerUnit:100,waterAllowedMax:100,electricAllowedMax:100,...common},
  {organizationId:org.id,name:"P105 zero tariff "+tag,rentSatang:0,waterSatangPerUnit:0,
   electricSatangPerUnit:0,waterAllowedMax:0,electricAllowedMax:0,...common},
  {organizationId:otherOrg.id,name:"P105 foreign "+tag,rentSatang:1000,
   waterSatangPerUnit:100,electricSatangPerUnit:100,...common}
 ]).returning();tracked.propertyIds.push(property.id,overflowProperty.id,foreignProperty.id);
 const [room,overflowRoom]=await db.insert(rooms).values([
  {organizationId:org.id,propertyId:property.id,number:"P105A",status:"OCCUPIED"},
  {organizationId:org.id,propertyId:overflowProperty.id,number:"P105X",status:"OCCUPIED"}
 ]).returning();tracked.roomIds.push(room.id,overflowRoom.id);
 const newLeases=await db.insert(leases).values([
  {organizationId:org.id,propertyId:property.id,roomId:room.id,tenantName:"Synthetic P105",
   startDate:"2026-01-01"},
  {organizationId:org.id,propertyId:overflowProperty.id,roomId:overflowRoom.id,
   tenantName:"Synthetic P105 over",startDate:"2026-01-01"}
 ]).returning();tracked.leaseIds.push(...newLeases.map(r=>r.id));
 const readings=[] as (typeof meterReadings.$inferInsert)[];
 for(const kind of ["WATER","ELECTRIC"] as const){
  for(const [readAt,v] of [["2026-01-01","1.000"],["2026-02-01","2.000"],
   ["2026-03-01","3.000"]] as const){
   readings.push({organizationId:org.id,propertyId:property.id,roomId:room.id,
    kind,readAt,value:v,createdBy:user.id});
  }
  for(const [readAt,v] of [["2026-01-01","0.000"],
   ["2026-02-01",kind==="WATER"?"2147483.648":"0.000"]] as const){
   readings.push({organizationId:org.id,propertyId:overflowProperty.id,roomId:overflowRoom.id,
    kind,readAt,value:v,createdBy:user.id});
  }
 }
 const inserted=await db.insert(meterReadings).values(readings).returning({id:meterReadings.id});
 tracked.readingIds.push(...inserted.map(r=>r.id));
 const root="/v1/properties/"+property.id, period1={roomId:room.id,
  start:"2026-01-01",endExclusive:"2026-02-01"},period2={
  roomId:room.id,start:"2026-02-01",endExclusive:"2026-03-01"};
 const newProperty="/v1/organizations/"+org.id+"/properties";
 const price={name:"invalid price",rentSatang:1000,waterSatangPerUnit:100,
  electricSatangPerUnit:100};
 for(const invalid of [-1,2_147_483_648,1.25,Number.MAX_SAFE_INTEGER]){
  const got=await request(newProperty,token,"POST",{...price,rentSatang:invalid});
  assert.equal(got.status,400,JSON.stringify(got));
 }
 const duplicate=await request(root+"/readings",token,"POST",{
  roomId:room.id,kind:"WATER",readAt:"2026-02-01",value:"2.000"});
 assert.equal(duplicate.status,409,JSON.stringify(duplicate));
 for(const value of ["-1.000","999999999999","1.0000"]){
  assert.equal((await request(root+"/readings",token,"POST",{
   roomId:room.id,kind:"WATER",readAt:"2026-04-01",value
  })).status,400);
 }
 assert.equal((await request("/v1/properties/"+foreignProperty.id+"/rooms",token)).status,403);
 const overflow={roomId:overflowRoom.id,start:"2026-01-01",endExclusive:"2026-02-01"};
 const overPath="/v1/properties/"+overflowProperty.id+"/bills";
 const high=await request(overPath+"/preview",token,"POST",overflow);
 assert.equal(high.status,422,JSON.stringify(high));
 assert.equal(high.body.error,"METER_USAGE_OUT_OF_RANGE");
 const highIssue=await request(overPath+"/issue",token,"POST",overflow,"p105-overflow-"+tag);
 assert.equal(highIssue.status,422,JSON.stringify(highIssue));
 assert.equal(highIssue.body.error,"METER_USAGE_OUT_OF_RANGE");
 console.log("PASS P1-05: 400 negative/fraction/overflow, 409 duplicate meter, 403 cross-org, 422 zero-tariff integer-bound meter preview/issue");

 const sameKey="p105-same-key-"+tag;
 const same=await Promise.all(Array.from({length:16},()=>request(root+"/bills/issue",
  token,"POST",period1,sameKey)));
 assert.equal(same.filter(v=>v.status===201).length,1,JSON.stringify(same.map(v=>v.status)));
 assert.equal(same.filter(v=>v.status===200).length,15,JSON.stringify(same.map(v=>v.status)));
 assert.equal(new Set(same.map(v=>v.body.invoice?.id)).size,1);
 assert.equal((await request(root+"/bills/issue",token,"POST",period2,sameKey)).status,409);
 const diverse=await Promise.all(Array.from({length:16},(_,i)=>request(root+"/bills/issue",
  token,"POST",period2,"p105-diverse-"+tag+"-"+i)));
 assert.equal(diverse.filter(v=>v.status===201).length,1,
  JSON.stringify(diverse.map(v=>v.status)));
 assert.equal(diverse.filter(v=>v.status===409).length,15,
  JSON.stringify(diverse.map(v=>v.status)));
 const rows=await db.select({id:invoices.id,amountSatang:invoices.amountSatang})
  .from(invoices).where(eq(invoices.organizationId,org.id));
 assert.equal(rows.length,2);
 assert.ok(rows.every(v=>v.amountSatang===1200));
 console.log("PASS P1-05: 16 same-key concurrent => 1 insert/15 replay; 16 distinct-key => 1 insert/15 conflict; exactly 2 immutable invoices");
 const previews=await Promise.all(Array.from({length:32},()=>request(root+"/bills/preview",
  token,"POST",period1)));
 assert.ok(previews.every(v=>v.status===200&&v.body.totalSatang===1200),
  JSON.stringify(previews.map(v=>v.status)));
 console.log("PASS P1-05: bounded 32-request parallel bill-preview burst returned 200 with stable totals");
 console.log(JSON.stringify({concurrentRequestsPerBurst:32,totalLoadRequests:76,
  sameKeyP95Ms:p95(same.map(v=>v.elapsedMs)),uniqueKeyP95Ms:p95(diverse.map(v=>v.elapsedMs)),
  previewP95Ms:p95(previews.map(v=>v.elapsedMs)),testScope:"isolated DEV",lineMessagesSent:0}));
}
async function cleanup(){
 child.kill("SIGTERM");
 if(tracked.orgIds.length){
  const inv=await db.select({id:invoices.id}).from(invoices)
   .where(inArray(invoices.organizationId,tracked.orgIds));
  if(inv.length){
   const ids=inv.map(v=>v.id);
   await db.delete(invoiceLines).where(inArray(invoiceLines.invoiceId,ids));
   await db.delete(invoices).where(inArray(invoices.id,ids));
  }
  await db.delete(auditLogs).where(inArray(auditLogs.organizationId,tracked.orgIds));
 }
 if(tracked.readingIds.length)await db.delete(meterReadings).where(inArray(meterReadings.id,tracked.readingIds));
 if(tracked.leaseIds.length)await db.delete(leases).where(inArray(leases.id,tracked.leaseIds));
 if(tracked.roomIds.length)await db.delete(rooms).where(inArray(rooms.id,tracked.roomIds));
 if(tracked.propertyIds.length)await db.delete(properties).where(inArray(properties.id,tracked.propertyIds));
 if(tracked.orgIds.length){
  await db.delete(memberships).where(inArray(memberships.organizationId,tracked.orgIds));
  await db.delete(organizations).where(inArray(organizations.id,tracked.orgIds));
 }
 if(tracked.sessionIds.length)await db.delete(sessions).where(inArray(sessions.id,tracked.sessionIds));
 if(tracked.userIds.length)await db.delete(users).where(inArray(users.id,tracked.userIds));
 await sqlClient.end();
}
try{await main();}finally{await cleanup();}
