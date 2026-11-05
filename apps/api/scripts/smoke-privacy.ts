import {spawn,type ChildProcess} from "node:child_process";
import {randomUUID} from "node:crypto";
import {strict as assert} from "node:assert";
import {eq,and} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {users,sessions,organizations,memberships,properties,rooms,leases,invoices,paymentClaims,privacyRequests,auditLogs} from "../src/db/schema.js";
import {newSessionToken,tokenHash} from "../src/security.js";
if(!process.env.APARTMENT_COVERAGE_ROOT||!process.env.DATABASE_URL?.includes("isolated_coverage_only@127.0.0.1:"))throw Error("DISPOSABLE_DATABASE_REQUIRED");
const base="http://127.0.0.1:8088";let child:ChildProcess|undefined;
async function start(approved:boolean){
 child=spawn("node",["--import","tsx","src/index.ts"],{cwd:process.cwd(),env:{...process.env,PRIVACY_PROFILE_ANONYMIZATION_APPROVED:String(approved),PRIVACY_PROFILE_RETENTION_DAYS:"30",PRIVACY_POLICY_EVIDENCE_REF:"TEST_ONLY_NOT_LEGAL_APPROVAL"},stdio:"ignore"});
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+"/readyz")).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,"isolated privacy API ready");
}
async function stop(){if(child&&child.exitCode===null){const done=new Promise(r=>child!.once("exit",r));child.kill("SIGTERM");await done;}child=undefined;}
async function request(path:string,token:string,method="GET",body?:unknown,key?:string){const r=await fetch(base+path,{method,headers:{cookie:"apartment_session="+token,...(body===undefined?{}:{"content-type":"application/json"}),...(key?{"idempotency-key":key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json() as any};}
async function fixture(role:"USER"|"SUPER_ADMIN"="USER"){
 const [user]=await db.insert(users).values({lineSubject:"privacy-fixture-"+randomUUID(),displayName:"Synthetic private profile",platformRole:role}).returning();const token=newSessionToken();await db.insert(sessions).values({userId:user.id,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+600000)});return {user,token};
}
const own="/v1/tenant/privacy/requests",admin="/v1/admin/privacy/requests",body={reason:"Synthetic profile management request",acknowledgedProfileOnly:true};
try{
 const root=await fixture("SUPER_ADMIN"),a=await fixture(),b=await fixture();
 await start(false);
 assert.equal((await request(admin,a.token)).status,403);
 assert.equal((await request(own,root.token,"POST",body,randomUUID())).status,409);
 const key=randomUUID();const created=await request(own,a.token,"POST",body,key);assert.equal(created.status,201);const id=created.body.request.id;
 assert.equal((await request(own,a.token,"POST",body,key)).body.replayed,true);
 assert.equal((await request(own,a.token,"POST",{...body,reason:"Different synthetic request reason"},key)).status,409);
 assert.equal((await request(own,b.token)).body.requests.length,0);
 assert.equal((await request(own+"/"+id+"/cancel",b.token,"POST",{})).status,404);
 assert.equal((await request(admin+"/"+id+"/decision",root.token,"POST",{action:"APPROVE",reason:"Synthetic review only, no legal approval"})).status,200);
 assert.equal((await request(admin+"/"+id+"/preview",root.token)).body.blocker,"PRIVACY_POLICY_NOT_APPROVED");
 assert.equal((await request(admin+"/"+id+"/execute",root.token,"POST",{confirmedProfileOnly:true})).status,409);
 assert.equal((await db.select().from(users).where(eq(users.id,a.user.id)))[0].status,"ACTIVE");
 assert.equal((await request(own+"/"+id+"/cancel",a.token,"POST",{})).status,200);
 assert.equal((await request(own+"/"+id+"/cancel",a.token,"POST",{})).body.replayed,true);
 await stop();await start(true);
 const [org]=await db.insert(organizations).values({name:"Privacy isolated "+randomUUID()}).returning();
 const [p]=await db.insert(properties).values({organizationId:org.id,name:"Privacy",rentSatang:100,waterSatangPerUnit:100,electricSatangPerUnit:100}).returning();
 const createApproved=async(f:Awaited<ReturnType<typeof fixture>>)=>{const [r]=await db.insert(privacyRequests).values({userId:f.user.id,reason:body.reason,idempotencyKey:randomUUID(),requestHash:"a".repeat(64),status:"APPROVED",reviewedBy:root.user.id}).returning();return r.id;};
 const owner=await fixture();await db.insert(memberships).values({organizationId:org.id,userId:owner.user.id,role:"OWNER"});const ownerCase=await createApproved(owner);
 assert.equal((await request(admin+"/"+ownerCase+"/preview",root.token)).body.blocker,"PRIVACY_OWNER_HANDOFF_REQUIRED");
 assert.equal((await request(admin+"/"+ownerCase+"/execute",root.token,"POST",{confirmedProfileOnly:true})).status,409);
 const tenant=await fixture();const [room]=await db.insert(rooms).values({organizationId:org.id,propertyId:p.id,number:randomUUID().slice(0,8)}).returning();
 const [lease]=await db.insert(leases).values({organizationId:org.id,propertyId:p.id,roomId:room.id,tenantName:"Synthetic tenant",tenantLineSubject:tenant.user.lineSubject,startDate:"2025-01-01"}).returning();const tenantCase=await createApproved(tenant);
 assert.equal((await request(admin+"/"+tenantCase+"/preview",root.token)).body.blocker,"PRIVACY_ACTIVE_LEASE");
 await db.update(leases).set({status:"ENDED",endDate:new Date().toISOString().slice(0,10)}).where(eq(leases.id,lease.id));
 assert.equal((await request(admin+"/"+tenantCase+"/preview",root.token)).body.blocker,"PRIVACY_RETENTION_NOT_ELAPSED");
 await db.update(leases).set({endDate:"2025-02-01"}).where(eq(leases.id,lease.id));
 const [invoice]=await db.insert(invoices).values({organizationId:org.id,propertyId:p.id,roomId:room.id,leaseId:lease.id,periodStart:"2025-01-01",periodEnd:"2025-02-01",dueDate:"2025-02-05",amountSatang:100,idempotencyKey:randomUUID(),issuedBy:root.user.id}).returning();
 const [claim]=await db.insert(paymentClaims).values({organizationId:org.id,propertyId:p.id,invoiceId:invoice.id,leaseId:lease.id,submittedBy:tenant.user.id,amountSatang:100,paidAt:new Date(),evidenceKey:randomUUID(),evidenceSha256:"b".repeat(64),idempotencyKey:randomUUID()}).returning();
 assert.equal((await request(admin+"/"+tenantCase+"/preview",root.token)).body.blocker,"PRIVACY_PAYMENT_REVIEW_PENDING");
 await db.update(paymentClaims).set({status:"REJECTED",decidedAt:new Date(),decidedBy:root.user.id,rejectionReason:"Synthetic rejection"}).where(eq(paymentClaims.id,claim.id));
 assert.equal((await request(admin+"/"+tenantCase+"/preview",root.token)).body.canExecute,true);
 const results=await Promise.all([0,1,2].map(()=>request(admin+"/"+tenantCase+"/execute",root.token,"POST",{confirmedProfileOnly:true})));
 assert.ok(results.every(r=>r.status===200),JSON.stringify(results));assert.equal(results.filter(r=>!r.body.replayed).length,1);
 const [updated]=await db.select().from(users).where(eq(users.id,tenant.user.id));assert.equal(updated.status,"DISABLED");assert.ok(updated.lineSubject.startsWith("erased:"));assert.equal(updated.displayName,"Deleted account");
 assert.equal((await request(own,tenant.token)).status,401);
 assert.equal((await db.select().from(leases).where(eq(leases.id,lease.id)))[0].tenantLineSubject,null);
 assert.deepEqual((await db.select().from(invoices).where(eq(invoices.id,invoice.id)))[0],invoice);
 assert.equal((await db.select().from(auditLogs).where(and(eq(auditLogs.action,"PRIVACY_PROFILE_ANONYMIZED"),eq(auditLogs.targetId,tenantCase)))).length,1);
 const [done]=await db.select().from(privacyRequests).where(eq(privacyRequests.id,tenantCase));assert.equal(done.policyRetentionDays,30);assert.equal(done.policyEvidenceRef,"TEST_ONLY_NOT_LEGAL_APPROVAL");
 console.log("PASS privacy: default policy gate, trusted admin, cross-user 404, idempotency, cancellation, owner/lease/pending-payment/retention guards, concurrent exactly-once profile anonymization, session revocation, unchanged immutable invoice; synthetic disposable data only");
}finally{await stop();await sqlClient.end();}
