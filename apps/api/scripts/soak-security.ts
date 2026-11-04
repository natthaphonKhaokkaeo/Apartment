/**
 * P1-05 bounded authorization soak, isolated local API + synthetic DEV rows.
 * Never use against public/production endpoints; no real messages or payments.
 * Defaults: 45 seconds, 1 request/sec; rate remains below 90/min per IP.
 */
import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {createServer} from "node:net";
import {strict as assert} from "node:assert";
import {eq,inArray} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {auditLogs,memberships,organizations,properties,propertyStaffGrants,rooms,sessions,users}
 from "../src/db/schema.js";
import {newSessionToken,tokenHash} from "../src/security.js";

function boundedEnv(name:string,defaultValue:number,min:number,max:number){
 const raw=process.env[name];
 const n=raw===undefined?defaultValue:Number(raw);
 if(!Number.isInteger(n)||n<min||n>max)throw new Error("INVALID_"+name);
 return n;
}
const durationSeconds=boundedEnv("P105_SOAK_SECONDS",45,10,120);
const intervalMs=1000; // Intentional 1 request/sec, below the global 90/minute guard.
const tag=randomUUID().slice(0,8);
const tracked={users:[] as string[],sessions:[] as string[],orgs:[] as string[],
 properties:[] as string[],rooms:[] as string[]};
async function getPort(){
 const server=createServer();
 return new Promise<number>((resolve,reject)=>{
  server.once("error",reject);
  server.listen(0,"127.0.0.1",()=>{
   const addr=server.address();
   if(!addr||typeof addr==="string"){server.close();reject(new Error("INVALID_ADDRESS"));return;}
   server.close(e=>e?reject(e):resolve(addr.port));
  });
 });
}
const port=await getPort(),base="http://127.0.0.1:"+port;
const child=spawn("node",["--import","tsx","src/index.ts"],{
 cwd:process.cwd(),stdio:"ignore",
 env:{...process.env,NODE_ENV:"development",HOST:"127.0.0.1",PORT:String(port),
  LINE_OUTBOUND_MODE:"disabled",LINE_WORKER_MODE:"observe",LINE_WORKER_APPROVED:"false"}
});
const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function ready(){
 const until=Date.now()+12000;
 while(Date.now()<until){
  if(child.exitCode!==null)throw new Error("API_EXITED");
  try{if((await fetch(base+"/readyz",{signal:AbortSignal.timeout(1000)})).ok)return;}catch{}
  await wait(150);
 }
 throw new Error("API_NOT_READY");
}
async function createActor(label:string){
 const [user]=await db.insert(users).values({
  lineSubject:"p105-soak-"+tag+"-"+label,displayName:"Synthetic QA "+label}).returning();
 tracked.users.push(user.id);
 const token=newSessionToken();
 const [session]=await db.insert(sessions).values({userId:user.id,
  tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+(durationSeconds+60)*1000)}).returning();
 tracked.sessions.push(session.id);
 return {id:user.id,token};
}
function percentile(xs:number[],p:number){
 const sorted=[...xs].sort((a,b)=>a-b);
 return Math.round(sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]??0);
}
async function rssKb(pid:number|undefined){
 if(!pid)return null;
 try{
  const m=(await readFile("/proc/"+pid+"/status","utf8")).match(/^VmRSS:\s+(\d+) kB/m);
  return m?Number(m[1]):null;
 }catch{return null;}
}
async function request(path:string,token:string){
 const started=performance.now();
 const res=await fetch(base+path,{headers:{cookie:"apartment_session="+token},
  signal:AbortSignal.timeout(8000)});
 const body=await res.json() as unknown;
 return {status:res.status,body,ms:performance.now()-started};
}
async function main(){
 await ready();
 const owner=await createActor("owner"),staff=await createActor("staff");
 const [orgA,orgB]=await db.insert(organizations).values([
  {name:"P105 soak org A "+tag},{name:"P105 soak org B "+tag}]).returning();
 tracked.orgs.push(orgA.id,orgB.id);
 await db.insert(memberships).values({organizationId:orgA.id,userId:staff.id,role:"STAFF"});
 const tariff={rentSatang:10000,waterSatangPerUnit:100,electricSatangPerUnit:200};
 const [allowed,foreign]=await db.insert(properties).values([
  {organizationId:orgA.id,name:"soak allowed "+tag,...tariff},
  {organizationId:orgB.id,name:"soak foreign "+tag,...tariff}]).returning();
 tracked.properties.push(allowed.id,foreign.id);
 const [room]=await db.insert(rooms).values({organizationId:orgA.id,propertyId:allowed.id,
  number:"QA01"}).returning();
 tracked.rooms.push(room.id);
 await db.insert(propertyStaffGrants).values({organizationId:orgA.id,propertyId:allowed.id,
  userId:staff.id,level:"VIEWER",updatedBy:owner.id});
 const yes="/v1/properties/"+allowed.id+"/rooms",no="/v1/properties/"+foreign.id+"/rooms";
 const responses:number[]=[],latencies:number[]=[];
 const started=Date.now(),initialRss=await rssKb(child.pid);
 let peakRss=initialRss??0,maxDbConnections=0;
 for(let i=0;i<durationSeconds;i++){
  const path=i%3===0?no:yes;
  const expected=path===yes?200:403;
  const reply=await request(path,staff.token);
  responses.push(reply.status);latencies.push(reply.ms);
  assert.equal(reply.status,expected,"AUTH_SCOPE_FAILED index="+i);
  if(expected===200){
   assert.ok(Array.isArray(reply.body)&&reply.body.length===1,"assigned rooms must be visible");
   assert.equal("rentOverrideSatang" in reply.body[0],false,"price leakage");
  }
  if(i%10===0){
   const currentRss=await rssKb(child.pid);
   if(currentRss!==null)peakRss=Math.max(peakRss,currentRss);
   const counts=await sqlClient.unsafe<{n:number}[]>(
    "SELECT count(*)::integer AS n FROM pg_stat_activity WHERE datname=current_database()");
   maxDbConnections=Math.max(maxDbConnections,counts[0]?.n??0);
  }
  const nextAt=started+(i+1)*intervalMs;
  await wait(Math.max(0,nextAt-Date.now()));
 }
 const totalMs=Date.now()-started,finalRss=await rssKb(child.pid);
 assert.equal(responses.length,durationSeconds);
 assert.ok(responses.every(s=>s===200||s===403),"unexpected 4xx/5xx");
 console.log(JSON.stringify({result:"PASS",suite:"P1-05 controlled scope soak",
  durationSeconds:Math.round(totalMs/1000),sampleCount:responses.length,
  authorized200:responses.filter(s=>s===200).length,
  expectedDenied403:responses.filter(s=>s===403).length,
  unexpectedResponses:responses.filter(s=>s!==200&&s!==403).length,
  p50Ms:percentile(latencies,.5),p95Ms:percentile(latencies,.95),
  p99Ms:percentile(latencies,.99),
  apiRssInitialMb:initialRss===null?null:Math.round(initialRss/1024),
  apiRssFinalMb:finalRss===null?null:Math.round(finalRss/1024),
  apiRssPeakSampledMb:Math.round(peakRss/1024),
  maxObservedDbConnections:maxDbConnections,
  nominalRps:1,scope:"isolated loopback API and synthetic DEV DB",
  lineMessagesSent:0}));
}
async function cleanup(){
 child.kill("SIGTERM");
 if(tracked.orgs.length){
  await db.delete(propertyStaffGrants).where(inArray(propertyStaffGrants.organizationId,tracked.orgs));
  await db.delete(auditLogs).where(inArray(auditLogs.organizationId,tracked.orgs));
 }
 if(tracked.rooms.length)await db.delete(rooms).where(inArray(rooms.id,tracked.rooms));
 if(tracked.properties.length)await db.delete(properties).where(inArray(properties.id,tracked.properties));
 if(tracked.orgs.length){
  await db.delete(memberships).where(inArray(memberships.organizationId,tracked.orgs));
  await db.delete(organizations).where(inArray(organizations.id,tracked.orgs));
 }
 if(tracked.sessions.length)await db.delete(sessions).where(inArray(sessions.id,tracked.sessions));
 if(tracked.users.length)await db.delete(users).where(inArray(users.id,tracked.users));
 await sqlClient.end();
}
try{await main();}finally{await cleanup();}
