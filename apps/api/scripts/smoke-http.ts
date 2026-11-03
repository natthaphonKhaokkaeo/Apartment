import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {strict as assert} from "node:assert";
import {eq} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {users,sessions,organizations,memberships,properties,rooms,leases,meterReadings,invoices,invoiceLines,auditLogs} from "../src/db/schema.js";
import {newSessionToken,tokenHash} from "../src/security.js";

const ids:{users:string[];sessions:string[];orgs:string[];props:string[];rooms:string[];leases:string[];readings:string[];invoices:string[]}={
 users:[],sessions:[],orgs:[],props:[],rooms:[],leases:[],readings:[],invoices:[]
};
const tag=randomUUID().slice(0,8),base="http://127.0.0.1:8088";
const child=spawn("node",["--import","tsx","src/index.ts"],{cwd:process.cwd(),stdio:"ignore",env:process.env});
async function request(path:string,token:string,options:RequestInit={}){
 const r=await fetch(base+path,{...options,headers:{"content-type":"application/json",cookie:"apartment_session="+token,...options.headers}});
 return {status:r.status,body:await r.json() as any};
}
async function main(){
 const deadline=Date.now()+15000;
 while(Date.now()<deadline){
  try{const r=await fetch(base+"/readyz");if(r.ok)break;}catch{}
  await new Promise(r=>setTimeout(r,200));
 }
 const [u,v]=await db.insert(users).values([{lineSubject:"http-alice-"+tag,displayName:"Owner A"},{lineSubject:"http-bob-"+tag,displayName:"Owner B"}]).returning();
 ids.users.push(u.id,v.id);
 const token=newSessionToken();
 const [sess]=await db.insert(sessions).values({userId:u.id,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+60000)}).returning();ids.sessions.push(sess.id);
 const [oa,ob]=await db.insert(organizations).values([{name:"API A "+tag},{name:"API B "+tag}]).returning();ids.orgs.push(oa.id,ob.id);
 await db.insert(memberships).values([{organizationId:oa.id,userId:u.id,role:"OWNER"},{organizationId:ob.id,userId:v.id,role:"OWNER"}]);
 const defaults={rentSatang:400000,waterSatangPerUnit:1800,electricSatangPerUnit:400,
  complianceReviewedAt:new Date(),complianceEvidenceRef:"SMOKE_ONLY_NOT_LEGAL",waterAllowedMax:2000,electricAllowedMax:500};
 const [pa,pb]=await db.insert(properties).values([{organizationId:oa.id,name:"API Property A",...defaults},{organizationId:ob.id,name:"API Property B",...defaults}]).returning();ids.props.push(pa.id,pb.id);
 const [room]=await db.insert(rooms).values({organizationId:oa.id,propertyId:pa.id,number:"S101",status:"OCCUPIED"}).returning();ids.rooms.push(room.id);
 const [lease]=await db.insert(leases).values({organizationId:oa.id,propertyId:pa.id,roomId:room.id,startDate:"2026-10-01",tenantName:"Sample Only"}).returning();ids.leases.push(lease.id);
 const readings=[];
 for(const kind of ["WATER","ELECTRIC"] as const)
  for(const [readAt,value] of [["2026-11-01",kind==="WATER"?"100.000":"200.000"],["2026-12-01",kind==="WATER"?"105.000":"210.000"]] as const)
   readings.push({organizationId:oa.id,propertyId:pa.id,roomId:room.id,readAt,kind,value,createdBy:u.id});
 const rows=await db.insert(meterReadings).values(readings).returning();ids.readings.push(...rows.map(r=>r.id));
 assert.equal((await request("/v1/properties/"+pa.id+"/rooms",token)).status,200);
 assert.equal((await request("/v1/properties/"+pb.id+"/rooms",token)).status,403);
 assert.equal((await request("/v1/admin/overview",token)).status,403);
 const payload=JSON.stringify({roomId:room.id,start:"2026-11-01",endExclusive:"2026-12-01"});
 const preview=await request("/v1/properties/"+pa.id+"/bills/preview",token,{method:"POST",body:payload});
 assert.equal(preview.status,200);assert.equal(preview.body.totalSatang,413000);
 const idempotencyKey="http-smoke-"+randomUUID();
 const issue=await request("/v1/properties/"+pa.id+"/bills/issue",token,{method:"POST",body:payload,headers:{"idempotency-key":idempotencyKey}});
 assert.equal(issue.status,201,JSON.stringify(issue.body));ids.invoices.push(issue.body.invoice.id);
 const replay=await request("/v1/properties/"+pa.id+"/bills/issue",token,{method:"POST",body:payload,headers:{"idempotency-key":idempotencyKey}});
 assert.equal(replay.status,200);assert.equal(replay.body.invoice.id,issue.body.invoice.id);
 const duplicate=await request("/v1/properties/"+pa.id+"/bills/issue",token,{method:"POST",body:payload,headers:{"idempotency-key":"other-"+randomUUID()}});
 assert.equal(duplicate.status,409);
 const invoice=await request("/v1/properties/"+pa.id+"/invoices/"+issue.body.invoice.id,token);
 assert.equal(invoice.status,200);assert.equal(invoice.body.lines.length,3);
 assert.equal(invoice.body.lines.reduce((n:number,l:any)=>n+l.amountSatang,0),413000);
 console.log("PASS HTTP: owner scope (200/403), admin denial, bill preview, transactional issue (201), replay (200), duplicate (409), immutable 3 lines");
}
try{await main();}
finally{
 child.kill("SIGTERM");
 for(const id of ids.invoices)await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId,id));
 for(const id of ids.invoices)await db.delete(invoices).where(eq(invoices.id,id));
 for(const id of ids.readings)await db.delete(meterReadings).where(eq(meterReadings.id,id));
 for(const id of ids.leases)await db.delete(leases).where(eq(leases.id,id));
 for(const id of ids.rooms)await db.delete(rooms).where(eq(rooms.id,id));
 for(const id of ids.props)await db.delete(properties).where(eq(properties.id,id));
 for(const id of ids.orgs)await db.delete(memberships).where(eq(memberships.organizationId,id));
 for(const id of ids.orgs)await db.delete(organizations).where(eq(organizations.id,id));
 for(const id of ids.sessions)await db.delete(sessions).where(eq(sessions.id,id));
 for(const id of ids.users)await db.delete(auditLogs).where(eq(auditLogs.actorId,id));
 for(const id of ids.users)await db.delete(users).where(eq(users.id,id));
 await sqlClient.end();
}
