import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {strict as assert} from "node:assert";
import {eq,inArray} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {auditLogs,memberships,organizations,properties,propertyStaffGrants,rooms,
 sessions,staffInvitations,users,meterReadings} from "../src/db/schema.js";
import {newSessionToken,tokenHash} from "../src/security.js";

const tag=randomUUID().slice(0,8),base="http://127.0.0.1:8088";
const created={users:[] as string[],sessions:[] as string[],orgs:[] as string[],
 props:[] as string[],rooms:[] as string[],readings:[] as string[]};
const child=spawn("node",["--import","tsx","src/index.ts"],{
 cwd:process.cwd(),stdio:"ignore",env:process.env
});
type Reply={status:number;body:any};
async function request(path:string,token:string,method="GET",body?:unknown):Promise<Reply>{
 const response=await fetch(base+path,{method,headers:{
  cookie:"apartment_session="+token,...(body===undefined?{}:{"content-type":"application/json"})
 },...(body===undefined?{}:{body:JSON.stringify(body)})});
 const content=await response.json();
 return {status:response.status,body:content};
}
async function createUser(label:string,role="USER"){
 const [u]=await db.insert(users).values({
  lineSubject:"p104-"+label+"-"+tag,displayName:"P104 "+label,platformRole:role
 }).returning();
 created.users.push(u.id);
 const token=newSessionToken();
 const [session]=await db.insert(sessions).values({userId:u.id,tokenHash:tokenHash(token),
  expiresAt:new Date(Date.now()+300000)}).returning();
 created.sessions.push(session.id);
 return {id:u.id,token};
}
async function main(){
 const deadline=Date.now()+15000;
 let healthy=false;
 while(Date.now()<deadline){
  try{const r=await fetch(base+"/readyz");if(r.ok){healthy=true;break}}catch{}
  await new Promise(r=>setTimeout(r,200));
 }
 assert.equal(healthy,true,"isolated API did not start");
 const owner=await createUser("owner"),otherOwner=await createUser("other-owner"),
  viewer=await createUser("viewer"),reader=await createUser("reader"),
  manager=await createUser("manager"),outsider=await createUser("outsider"),
  root=await createUser("root","SUPER_ADMIN");
 const [orgA,orgB]=await db.insert(organizations).values([{name:"Staff smoke A "+tag},
  {name:"Staff smoke B "+tag}]).returning();
 created.orgs.push(orgA.id,orgB.id);
 await db.insert(memberships).values([
  {organizationId:orgA.id,userId:owner.id,role:"OWNER"},
  {organizationId:orgB.id,userId:otherOwner.id,role:"OWNER"},
  {organizationId:orgA.id,userId:manager.id,role:"MANAGER"}
 ]);
 const tariff={rentSatang:400000,waterSatangPerUnit:1800,electricSatangPerUnit:400};
 const [p1,p2,p3]=await db.insert(properties).values([
  {organizationId:orgA.id,name:"Building A",...tariff},
  {organizationId:orgA.id,name:"Building A2",...tariff},
  {organizationId:orgB.id,name:"Building B",...tariff}
 ]).returning();
 created.props.push(p1.id,p2.id,p3.id);
 const [room]=await db.insert(rooms).values({organizationId:orgA.id,
  propertyId:p1.id,number:"R1"}).returning();
 created.rooms.push(room.id);
 const staff="/v1/organizations/"+orgA.id+"/staff";
 const createInvitation=(token:string,body:unknown)=>request(staff+"/invitations",token,"POST",body);
 const approve=(id:string,token=owner.token)=>request(staff+"/invitations/"+id+"/approve",token,"POST");
 const claim=(key:string,token:string)=>request("/v1/staff/invitations/claim",token,"POST",{token:key});
 assert.equal((await request(staff+"/members",outsider.token)).status,403);
 assert.equal((await request(staff+"/members",manager.token)).status,403);
 assert.equal((await createInvitation(manager.token,{role:"STAFF",propertyId:p1.id,level:"VIEWER"})).status,403);
 assert.equal((await createInvitation(root.token,{role:"MANAGER"})).status,403);
 assert.equal((await createInvitation(owner.token,{role:"STAFF",propertyId:p3.id,level:"VIEWER"})).status,404);
 assert.equal((await createInvitation(owner.token,{role:"STAFF",level:"VIEWER"})).status,400);
 assert.equal((await createInvitation(owner.token,{role:"MANAGER",propertyId:p1.id})).status,400);
 const pending=await createInvitation(owner.token,{role:"STAFF",propertyId:p1.id,level:"VIEWER"});
 assert.equal(pending.status,201,JSON.stringify(pending.body));
 assert.equal((await request("/v1/properties/"+p1.id+"/rooms",viewer.token)).status,403);
 assert.equal((await claim(pending.body.token,viewer.token)).status,200);
 assert.equal((await claim(pending.body.token,viewer.token)).status,409);
 assert.equal((await approve(pending.body.id,otherOwner.token)).status,403);
 const approval=await approve(pending.body.id);
 assert.equal(approval.status,200,JSON.stringify(approval.body));
 assert.equal((await approve(pending.body.id)).status,409);
 const meViewer=await request("/v1/me",viewer.token);
 assert.equal(meViewer.status,200);
 assert.equal(meViewer.body.memberships.find((m:any)=>m.organizationId===orgA.id)?.role,"STAFF");
 assert.deepEqual(meViewer.body.propertyGrants,[{propertyId:p1.id,level:"VIEWER"}]);
 const list=await request("/v1/organizations/"+orgA.id+"/properties",viewer.token);
 assert.equal(list.status,200,JSON.stringify(list.body));
 assert.deepEqual(list.body.map((p:any)=>p.id),[p1.id]);
 assert.equal("rentSatang" in list.body[0],false,"staff property list must omit prices");
 assert.equal("waterAllowedMax" in list.body[0],false);
 const roomsReply=await request("/v1/properties/"+p1.id+"/rooms",viewer.token);
 assert.equal(roomsReply.status,200);
 assert.equal(roomsReply.body.length,1);
 assert.equal("rentOverrideSatang" in roomsReply.body[0],false);
 assert.equal((await request("/v1/properties/"+p1.id+"/readings",viewer.token)).status,200);
 const noWrite={roomId:room.id,kind:"WATER",readAt:"2026-10-01",value:"10.000"};
 assert.equal((await request("/v1/properties/"+p1.id+"/readings",viewer.token,"POST",noWrite)).status,403);
 for(const url of ["/v1/properties/"+p1.id+"/leases",
  "/v1/properties/"+p1.id+"/overview",
  "/v1/properties/"+p1.id+"/rates",
  "/v1/properties/"+p1.id+"/invoices",
  "/v1/properties/"+p2.id+"/rooms",
  "/v1/properties/"+p3.id+"/rooms"]){
  const rejected=await request(url,viewer.token);
  assert.equal(rejected.status,403,url+" "+JSON.stringify(rejected.body));
 }
 assert.equal((await request("/v1/organizations/"+orgB.id+"/properties",viewer.token)).status,403);
 assert.equal((await request("/v1/properties/"+p1.id+"/bills/preview",viewer.token,"POST",{})).status,403);
 const meterInvite=await createInvitation(owner.token,{role:"STAFF",propertyId:p1.id,level:"METER_READER"});
 assert.equal(meterInvite.status,201);
 assert.equal((await claim(meterInvite.body.token,reader.token)).status,200);
 const [approved1,approved2]=await Promise.all([approve(meterInvite.body.id),approve(meterInvite.body.id)]);
 assert.deepEqual([approved1.status,approved2.status].sort(),[200,409]);
 const meterPath="/v1/properties/"+p1.id+"/readings";
 const reading=await request(meterPath,reader.token,"POST",noWrite);
 assert.equal(reading.status,201,JSON.stringify(reading.body));
 created.readings.push(reading.body.id);
 assert.equal((await request("/v1/properties/"+p2.id+"/readings",reader.token)).status,403);
 assert.equal((await request("/v1/properties/"+p1.id+"/leases",reader.token)).status,403);
 assert.equal((await request("/v1/properties/"+p1.id+"/rooms",manager.token)).status,200);
 const invites=await request(staff+"/invitations",owner.token);
 assert.equal(invites.status,200);
 assert.equal(invites.body.some((v:any)=>"tokenHash" in v||"token" in v),false);
 const members=await request(staff+"/members",owner.token);
 assert.equal(members.status,200);
 assert.ok(members.body.some((v:any)=>v.userId===viewer.id&&v.role==="STAFF"));
 assert.equal((await request(staff+"/members/"+owner.id+"/revoke",owner.token,"POST",{})).status,409);
 const revokedViewer=await request(staff+"/members/"+viewer.id+"/revoke",owner.token,"POST",{propertyId:p1.id});
 assert.equal(revokedViewer.status,200,JSON.stringify(revokedViewer.body));
 assert.equal((await request("/v1/properties/"+p1.id+"/rooms",viewer.token)).status,403);
 assert.deepEqual((await request("/v1/me",viewer.token)).body.propertyGrants,[]);
 assert.equal((await request("/v1/organizations/"+orgA.id+"/properties",viewer.token)).status,403);
 assert.equal((await request(staff+"/members/"+reader.id+"/revoke",owner.token,"POST",{propertyId:p1.id})).status,200);
 assert.equal((await request(meterPath,reader.token,"POST",{...noWrite,readAt:"2026-10-02"})).status,403);
 const revokedInvite=await createInvitation(owner.token,{role:"MANAGER"});
 assert.equal(revokedInvite.status,201);
 assert.equal((await request(staff+"/invitations/"+revokedInvite.body.id+"/revoke",owner.token,"POST")).status,200);
 assert.equal((await claim(revokedInvite.body.token,outsider.token)).status,409);
 assert.equal((await request(staff+"/members/"+manager.id+"/revoke",owner.token,"POST",{})).status,200);
 assert.equal((await request("/v1/properties/"+p2.id+"/rooms",manager.token)).status,403);
 const audit=await db.select({action:auditLogs.action}).from(auditLogs).where(eq(auditLogs.organizationId,orgA.id));
 assert.ok(audit.some(e=>e.action==="STAFF_ACCESS_REVOKED"));
 console.log("PASS P1-04: pending approval, role and org isolation, property filtering, finances denied, meter-only write, invite replay/race, revoke, audit");
}
try{await main();}
finally{
 child.kill("SIGTERM");
 // Cleanup only synthetic rows identified by this test run.
 if(created.orgs.length){
  await db.delete(propertyStaffGrants).where(inArray(propertyStaffGrants.organizationId,created.orgs));
  await db.delete(staffInvitations).where(inArray(staffInvitations.organizationId,created.orgs));
  await db.delete(auditLogs).where(inArray(auditLogs.organizationId,created.orgs));
 }
 if(created.readings.length)await db.delete(meterReadings).where(inArray(meterReadings.id,created.readings));
 if(created.rooms.length)await db.delete(rooms).where(inArray(rooms.id,created.rooms));
 if(created.props.length)await db.delete(properties).where(inArray(properties.id,created.props));
 if(created.orgs.length)await db.delete(memberships).where(inArray(memberships.organizationId,created.orgs));
 if(created.orgs.length)await db.delete(organizations).where(inArray(organizations.id,created.orgs));
 if(created.sessions.length)await db.delete(sessions).where(inArray(sessions.id,created.sessions));
 if(created.users.length)await db.delete(users).where(inArray(users.id,created.users));
 await sqlClient.end();
}
