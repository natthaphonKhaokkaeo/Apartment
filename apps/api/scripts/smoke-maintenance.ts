import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {strict as assert} from "node:assert";
import {eq,inArray} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {
 auditLogs,leases,maintenanceTickets,memberships,organizations,properties,
 rooms,sessions,users
} from "../src/db/schema.js";
import {newSessionToken,tokenHash} from "../src/security.js";

const base="http://127.0.0.1:8088",tag=randomUUID().slice(0,8);
const ids={users:[] as string[],sessions:[] as string[],orgs:[] as string[],
 properties:[] as string[],rooms:[] as string[],leases:[] as string[],
 tickets:[] as string[]};
const child=spawn("node",["--import","tsx","src/index.ts"],{
 cwd:process.cwd(),stdio:"ignore",env:process.env
});
type Reply={status:number;body:any};
async function request(path:string,token:string,method="GET",body?:unknown):Promise<Reply>{
 const response=await fetch(base+path,{method,headers:{
  cookie:"apartment_session="+token,
  ...(body===undefined?{}:{"content-type":"application/json"})
 },...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:response.status,body:await response.json()};
}
async function session(userId:string){
 const token=newSessionToken();
 const [row]=await db.insert(sessions).values({userId,tokenHash:tokenHash(token),
  expiresAt:new Date(Date.now()+300000)}).returning();
 ids.sessions.push(row.id);return token;
}
async function main(){
 const deadline=Date.now()+15000;let ready=false;
 while(Date.now()<deadline){
  try{if((await fetch(base+"/readyz")).ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,200));
 }
 assert.equal(ready,true,"DEV API not ready");
 const [owner,tenant,outsider]=await db.insert(users).values([
  {lineSubject:"maint-owner-"+tag,displayName:"Synthetic owner"},
  {lineSubject:"maint-tenant-"+tag,displayName:"Synthetic tenant"},
  {lineSubject:"maint-outsider-"+tag,displayName:"Synthetic outsider"}
 ]).returning();ids.users.push(owner.id,tenant.id,outsider.id);
 const ownerToken=await session(owner.id),tenantToken=await session(tenant.id),
  outsiderToken=await session(outsider.id);
 const [org,foreignOrg]=await db.insert(organizations).values([
  {name:"Maintenance test "+tag},{name:"Maintenance foreign "+tag}
 ]).returning();ids.orgs.push(org.id,foreignOrg.id);
 await db.insert(memberships).values({
  organizationId:org.id,userId:owner.id,role:"OWNER"
 });
 const [property,foreignProperty]=await db.insert(properties).values([
  {organizationId:org.id,name:"Maintenance "+tag,rentSatang:1000,
   waterSatangPerUnit:100,electricSatangPerUnit:100},
  {organizationId:foreignOrg.id,name:"Foreign "+tag,rentSatang:1000,
   waterSatangPerUnit:100,electricSatangPerUnit:100}
 ]).returning();ids.properties.push(property.id,foreignProperty.id);
 const [occupied,available]=await db.insert(rooms).values([
  {organizationId:org.id,propertyId:property.id,number:"M-O-"+tag,
   status:"OCCUPIED"},
  {organizationId:org.id,propertyId:property.id,number:"M-A-"+tag,
   status:"AVAILABLE"}
 ]).returning();ids.rooms.push(occupied.id,available.id);
 const [lease]=await db.insert(leases).values({
  organizationId:org.id,propertyId:property.id,roomId:occupied.id,
  tenantName:"Synthetic tenant",tenantLineSubject:tenant.lineSubject,
  startDate:"2026-01-01"
 }).returning();ids.leases.push(lease.id);
 const tenantPath="/v1/tenant/leases/"+lease.id+"/maintenance-tickets";
 const created=await request(tenantPath,tenantToken,"POST",{
  title:"Leaking sink",description:"Water leaks below the sink after use",
  category:"PLUMBING"
 });
 assert.equal(created.status,201,JSON.stringify(created.body));ids.tickets.push(created.body.id);
 assert.equal(created.body.reporterType,"TENANT");
 assert.equal((await request(tenantPath,outsiderToken,"POST",{
  title:"Other room issue",description:"This user is not linked to the lease",
  category:"OTHER"
 })).status,404);
 const own=await request("/v1/tenant/maintenance-tickets",tenantToken);
 assert.equal(own.status,200);assert.equal(own.body.length,1);
 assert.equal(own.body[0].id,created.body.id);
 assert.equal((await request("/v1/tenant/maintenance-tickets",outsiderToken)).body.length,0);
 assert.equal((await request("/v1/properties/"+property.id+"/maintenance-tickets",
  tenantToken)).status,403);
 const list=await request("/v1/properties/"+property.id+"/maintenance-tickets",ownerToken);
 assert.equal(list.status,200);assert.ok(list.body.some((r:any)=>r.id===created.body.id));
 assert.equal((await request("/v1/properties/"+foreignProperty.id+"/maintenance-tickets",
  ownerToken)).status,403);
 console.log("PASS maintenance: owner/tenant scope, approved lease binding and tenant-only history");

 const path="/v1/properties/"+property.id+"/maintenance-tickets";
 const ownerTicket=await request(path,ownerToken,"POST",{
  roomId:available.id,title:"Replace room lock",
  description:"The front door lock needs replacement",
  category:"STRUCTURE",priority:"HIGH"
 });
 assert.equal(ownerTicket.status,201,JSON.stringify(ownerTicket.body));
 ids.tickets.push(ownerTicket.body.id);
 const roomPath="/v1/properties/"+property.id+"/rooms/"+available.id+"/maintenance";
 assert.equal((await request(roomPath+"/enter",ownerToken,"POST",{
  reason:"Repair work scheduled"
 })).status,200);
 assert.equal((await request(roomPath+"/return",ownerToken,"POST",{
  confirmed:true
 })).body.error,"ROOM_MAINTENANCE_TICKETS_OPEN");
 const ticketPath=path+"/"+ownerTicket.body.id;
 for(const status of ["ACKNOWLEDGED","IN_PROGRESS","RESOLVED","CLOSED"]){
  const response=await request(ticketPath,ownerToken,"PATCH",{status});
  assert.equal(response.status,200,JSON.stringify(response.body));
 }
 assert.equal((await request(roomPath+"/return",ownerToken,"POST",{
  confirmed:true
 })).status,200);
 const roomsNow=await db.select({status:rooms.status}).from(rooms)
  .where(eq(rooms.id,available.id));
 assert.equal(roomsNow[0]?.status,"AVAILABLE");
 assert.equal((await request(ticketPath,ownerToken,"PATCH",{
  status:"IN_PROGRESS"
 })).body.error,"MAINTENANCE_TRANSITION_INVALID");
 assert.equal((await request("/v1/properties/"+property.id+
  "/maintenance-tickets",outsiderToken)).status,403);
 console.log("PASS maintenance: ordered status transitions, audit route and return-from-maintenance gate");
}
async function cleanup(){
 child.kill("SIGTERM");
 if(ids.tickets.length)await db.delete(maintenanceTickets)
  .where(inArray(maintenanceTickets.id,ids.tickets));
 if(ids.orgs.length)await db.delete(auditLogs)
  .where(inArray(auditLogs.organizationId,ids.orgs));
 if(ids.leases.length)await db.delete(leases).where(inArray(leases.id,ids.leases));
 if(ids.rooms.length)await db.delete(rooms).where(inArray(rooms.id,ids.rooms));
 if(ids.properties.length)await db.delete(properties)
  .where(inArray(properties.id,ids.properties));
 if(ids.orgs.length)await db.delete(memberships)
  .where(inArray(memberships.organizationId,ids.orgs));
 if(ids.orgs.length)await db.delete(organizations).where(inArray(organizations.id,ids.orgs));
 if(ids.sessions.length)await db.delete(sessions).where(inArray(sessions.id,ids.sessions));
 if(ids.users.length)await db.delete(users).where(inArray(users.id,ids.users));
 await sqlClient.end();
}
try{await main();}finally{await cleanup();}
