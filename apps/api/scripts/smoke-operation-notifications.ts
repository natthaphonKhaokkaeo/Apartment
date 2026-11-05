import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {strict as assert} from "node:assert";
import {eq} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {users,sessions,organizations,memberships,properties,rooms,leases,lineOaBindings,lineOutbox} from "../src/db/schema.js";
import {newSessionToken,tokenHash} from "../src/security.js";
import {queueLeaseNotificationTx} from "../src/services/line-notifications.js";
if(!process.env.APARTMENT_COVERAGE_ROOT||!process.env.DATABASE_URL?.includes("isolated_coverage_only@127.0.0.1:"))throw Error("DISPOSABLE_DATABASE_REQUIRED");
const bot="U"+randomUUID().replace(/-/g,""),tenantSubject="U"+randomUUID().replace(/-/g,"");
const child=spawn("node",["--import","tsx","src/index.ts"],{cwd:process.cwd(),env:{...process.env,LINE_OA_BOT_USER_ID:bot,LINE_OUTBOUND_MODE:"disabled"},stdio:"ignore"});
const base="http://127.0.0.1:8088";let leaseId="";
async function request(path:string,token:string,method="GET",body?:unknown){
 const r=await fetch(base+path,{method,headers:{cookie:"apartment_session="+token,...(body===undefined?{}:{"content-type":"application/json"})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json() as any};
}
try{
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+"/readyz")).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 const [owner,tenant]=await db.insert(users).values([{lineSubject:"ops-owner-"+randomUUID(),displayName:"Owner"},{lineSubject:tenantSubject,displayName:"Tenant"}]).returning();
 const tokens:string[]=[];for(const u of [owner,tenant]){const token=newSessionToken();await db.insert(sessions).values({userId:u.id,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+300000)});tokens.push(token);}
 const [org]=await db.insert(organizations).values({name:"Operation notifications "+randomUUID()}).returning();
 await db.insert(memberships).values({organizationId:org.id,userId:owner.id,role:"OWNER"});
 const [p]=await db.insert(properties).values({organizationId:org.id,name:"Ops",rentSatang:100,waterSatangPerUnit:100,electricSatangPerUnit:100}).returning();
 const [room]=await db.insert(rooms).values({organizationId:org.id,propertyId:p.id,number:"N101",status:"OCCUPIED"}).returning();
 const [lease]=await db.insert(leases).values({organizationId:org.id,propertyId:p.id,roomId:room.id,tenantName:"Tenant",tenantLineSubject:tenantSubject,startDate:"2026-11-01"}).returning();leaseId=lease.id;
 await db.insert(lineOaBindings).values({organizationId:org.id,botUserId:bot,enabled:true});
 const consent="/v1/tenant/leases/"+lease.id+"/notification-consent";
 assert.equal((await request(consent,tokens[1],"PUT",{enabled:true,policyVersion:"2026-11-v1",acknowledgedPurpose:true})).status,200);
 const created=await request("/v1/tenant/leases/"+lease.id+"/maintenance-tickets",tokens[1],"POST",{title:"SENSITIVE_FIXTURE_PLUMBING",description:"Synthetic private repair description never included in LINE messages",category:"PLUMBING"});assert.equal(created.status,201);
 const path="/v1/properties/"+p.id+"/maintenance-tickets/"+created.body.id;
 assert.equal((await request(path,tokens[0],"PATCH",{status:"ACKNOWLEDGED"})).status,200);
 let queued=await db.select().from(lineOutbox).where(eq(lineOutbox.leaseId,lease.id));assert.equal(queued.length,1);
 assert.equal(queued[0].templateKey,"MAINTENANCE_UPDATED");assert.equal(queued[0].recipientLineUserId,tenantSubject);assert.ok(!queued[0].messageText.includes("SENSITIVE_FIXTURE"));assert.ok(!queued[0].messageText.includes("description"));
 assert.equal((await request(path,tokens[0],"PATCH",{status:"ACKNOWLEDGED"})).status,200);
 assert.equal((await db.select().from(lineOutbox).where(eq(lineOutbox.leaseId,lease.id))).length,1);
 assert.equal((await request(path,tokens[0],"PATCH",{status:"CLOSED"})).status,409);
 assert.equal((await request(consent,tokens[1],"PUT",{enabled:false})).status,200);
 assert.equal((await request(path,tokens[0],"PATCH",{status:"IN_PROGRESS"})).status,200);
 queued=await db.select().from(lineOutbox).where(eq(lineOutbox.leaseId,lease.id));assert.equal(queued.length,1);assert.equal(queued[0].status,"DEAD");
 assert.equal((await request(consent,tokens[1],"PUT",{enabled:true,policyVersion:"2026-11-v1",acknowledgedPurpose:true})).status,200);
 const transitions=await Promise.all(Array.from({length:3},()=>request(path,tokens[0],"PATCH",{status:"RESOLVED"})));assert.ok(transitions.every(r=>r.status===200));
 queued=await db.select().from(lineOutbox).where(eq(lineOutbox.leaseId,lease.id));assert.equal(queued.length,2);assert.equal(queued.filter(x=>x.status==="QUEUED").length,1);
 assert.equal(await db.transaction(tx=>queueLeaseNotificationTx(tx,{id:randomUUID(),leaseId:lease.id,organizationId:org.id,propertyId:p.id},"TENANT_LINK_APPROVED")),"INELIGIBLE");
 assert.equal((await db.select().from(lineOutbox).where(eq(lineOutbox.leaseId,lease.id))).length,2);
 console.log("PASS operation notifications: transactional repair status producer, generic no-PII text, repeated/concurrent transitions dedupe, invalid transition no event, revoke suppression, regrant new event, invitation purpose fail-closed, no provider dispatch");
}finally{
 child.kill("SIGTERM");await new Promise(r=>setTimeout(r,200));
 if(leaseId)await db.delete(lineOutbox).where(eq(lineOutbox.leaseId,leaseId));
 await sqlClient.end();
}
