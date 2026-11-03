import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {strict as assert} from "node:assert";
import {eq} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {users,sessions,organizations,memberships,properties,rooms,leases,meterReadings,invoices,invoiceLines,auditLogs,leaseInvitations} from "../src/db/schema.js";
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
 // P2 — claimed invite must not grant invoice access until owner approval.
 const [tenantA,tenantB]=await db.insert(users).values([
  {lineSubject:"http-tenantA-"+tag,displayName:"Tenant A"},
  {lineSubject:"http-tenantB-"+tag,displayName:"Tenant B"}
 ]).returning();
 ids.users.push(tenantA.id,tenantB.id);
 const [tenantTokenA,tenantTokenB]=[newSessionToken(),newSessionToken()];
 const newSessions=await db.insert(sessions).values([
  {userId:tenantA.id,tokenHash:tokenHash(tenantTokenA),expiresAt:new Date(Date.now()+60000)},
  {userId:tenantB.id,tokenHash:tokenHash(tenantTokenB),expiresAt:new Date(Date.now()+60000)}
 ]).returning();ids.sessions.push(...newSessions.map(s=>s.id));
 const invitePath="/v1/properties/"+pa.id+"/leases/"+lease.id+"/invitations";
 assert.equal((await request("/v1/tenant/invoices",tenantTokenA)).body.length,0);
 assert.equal((await request("/v1/tenant/invoices/"+issue.body.invoice.id,tenantTokenB)).status,404);
 const invited=await request(invitePath,token,{method:"POST",body:"{}"});
 assert.equal(invited.status,201,JSON.stringify(invited.body));
 assert.match(invited.body.token,/^[A-Za-z0-9_-]{43}$/);
 const claimPath="/v1/tenant/invitations/claim";
 const claimant=await request(claimPath,tenantTokenA,{method:"POST",body:JSON.stringify({token:invited.body.token})});
 assert.equal(claimant.status,202,JSON.stringify(claimant.body));
 assert.equal(claimant.body.status,"PENDING_OWNER_APPROVAL");
 assert.equal((await request("/v1/tenant/invoices",tenantTokenA)).body.length,0);
 assert.equal((await request("/v1/tenant/leases",tenantTokenA)).body.length,0);
 assert.equal((await request(claimPath,tenantTokenB,{method:"POST",body:JSON.stringify({token:invited.body.token})})).status,404);
 const approvePath=invitePath+"/"+invited.body.id+"/approve";
 assert.equal((await request(approvePath,tenantTokenB,{method:"POST",body:"{}"})).status,403);
 const approved=await request(approvePath,token,{method:"POST",body:"{}"});
 assert.equal(approved.status,200,JSON.stringify(approved.body));
 assert.equal(approved.body.linked,true);
 assert.equal((await request(approvePath,token,{method:"POST",body:"{}"})).status,409);
 const tenantBills=await request("/v1/tenant/invoices",tenantTokenA);
 assert.equal(tenantBills.status,200);
 assert.deepEqual(tenantBills.body.map((b:any)=>b.id),[issue.body.invoice.id]);
 const tenantDetails=await request("/v1/tenant/invoices/"+issue.body.invoice.id,tenantTokenA);
 assert.equal(tenantDetails.status,200);
 assert.equal(tenantDetails.body.amountSatang,413000);
 assert.equal(tenantDetails.body.lines.length,3);
 const tenantLease=await request("/v1/tenant/leases",tenantTokenA);
 assert.equal(tenantLease.body.length,1);
 assert.equal(tenantLease.body[0].roomNumber,"S101");
 assert.equal((await request("/v1/tenant/invoices/"+issue.body.invoice.id,tenantTokenB)).status,404);
 assert.equal((await request("/v1/tenant/invoices",tenantTokenB)).body.length,0);
 // Invite the second unbound room, then invalidate first code via regeneration.
 const [otherRoom]=await db.insert(rooms).values({organizationId:oa.id,propertyId:pa.id,number:"S102",status:"OCCUPIED"}).returning();
 ids.rooms.push(otherRoom.id);
 const [otherLease]=await db.insert(leases).values({organizationId:oa.id,propertyId:pa.id,roomId:otherRoom.id,startDate:"2026-10-01",tenantName:"Sample B"}).returning();
 ids.leases.push(otherLease.id);
 const secondInvitePath="/v1/properties/"+pa.id+"/leases/"+otherLease.id+"/invitations";
 const oldInvite=await request(secondInvitePath,token,{method:"POST",body:"{}"});
 assert.equal(oldInvite.status,201);
 const currentInvite=await request(secondInvitePath,token,{method:"POST",body:"{}"});
 assert.equal(currentInvite.status,201);
 assert.equal((await request(claimPath,tenantTokenB,{method:"POST",body:JSON.stringify({token:oldInvite.body.token})})).status,404);
 await db.update(leaseInvitations).set({expiresAt:new Date(Date.now()-60000)}).where(eq(leaseInvitations.id,currentInvite.body.id));
 assert.equal((await request(claimPath,tenantTokenB,{method:"POST",body:JSON.stringify({token:currentInvite.body.token})})).status,404);
 assert.equal((await request("/v1/tenant/invoices",tenantTokenB)).body.length,0);
 console.log("PASS P2 HTTP: 201 invite, 202 claim, owner-only approve, one-time/replay/expired/replaced reject, tenant bill IDOR 404, read-only own invoice");
 // P2 hardening: the previous owner invitation must be revoked/expired, and concurrent claims are one-use.
 const refreshed=await request(secondInvitePath,token,{method:"POST",body:"{}"});
 assert.equal(refreshed.status,201);
 const contenders=await Promise.all([
  request(claimPath,tenantTokenA,{method:"POST",body:JSON.stringify({token:refreshed.body.token})}),
  request(claimPath,tenantTokenB,{method:"POST",body:JSON.stringify({token:refreshed.body.token})})
 ]);
 assert.deepEqual(contenders.map(x=>x.status).sort(),[202,404]);
 const otherPending=await request("/v1/tenant/invoices",tenantTokenB);
 assert.equal(otherPending.status,200);
 assert.equal(otherPending.body.length,0);
 // Disabled subject/session and disabled organization must block visibility.
 await db.update(users).set({status:"DISABLED"}).where(eq(users.id,tenantA.id));
 assert.equal((await request("/v1/tenant/invoices",tenantTokenA)).status,401);
 await db.update(users).set({status:"ACTIVE"}).where(eq(users.id,tenantA.id));
 await db.update(sessions).set({revokedAt:new Date()}).where(eq(sessions.userId,tenantA.id));
 assert.equal((await request("/v1/tenant/invoices",tenantTokenA)).status,401);
 await db.update(sessions).set({revokedAt:null}).where(eq(sessions.userId,tenantA.id));
 await db.update(organizations).set({status:"DISABLED"}).where(eq(organizations.id,oa.id));
 const suspended=await request("/v1/tenant/invoices",tenantTokenA);
 assert.equal(suspended.status,200);
 assert.equal(suspended.body.length,0);
 await db.update(organizations).set({status:"ACTIVE"}).where(eq(organizations.id,oa.id));
 assert.equal((await request("/v1/tenant/invoices",tenantTokenA)).body.length,1);
 console.log("PASS P2 hardening: one winner on concurrent claim, expired/replaced reject, disabled identity 401, disabled org hides tenant bills");


}
try{await main();}
finally{
 child.kill("SIGTERM");
 for(const id of ids.invoices)await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId,id));
 for(const id of ids.invoices)await db.delete(invoices).where(eq(invoices.id,id));
 for(const id of ids.readings)await db.delete(meterReadings).where(eq(meterReadings.id,id));
 for(const id of ids.leases)await db.delete(leaseInvitations).where(eq(leaseInvitations.leaseId,id));
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
