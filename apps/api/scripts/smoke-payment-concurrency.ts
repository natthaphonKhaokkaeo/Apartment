import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {strict as assert} from "node:assert";
import {eq} from "drizzle-orm";
import sharp from "sharp";
import {db,sqlClient} from "../src/db/client.js";
import {users,sessions,organizations,memberships,properties,rooms,leases,invoices,
 invoiceLines,meterReadings,paymentInstructions,paymentClaims,paymentLedger,auditLogs} from "../src/db/schema.js";
import {newSessionToken,tokenHash} from "../src/security.js";
import {deletePrivateEvidence} from "../src/services/evidence.js";

const id=randomUUID().slice(0,8),url="http://127.0.0.1:8088";
const child=spawn("node",["--import","tsx","src/index.ts"],{cwd:process.cwd(),stdio:"ignore",env:process.env});
const records={users:[] as string[],sessions:[] as string[],org:"",property:"",room:"",lease:"",invoice:"",claims:[] as string[]};
async function api(path:string,token:string,opts:RequestInit={}){
 const r=await fetch(url+path,{...opts,headers:{...(opts.body instanceof FormData?{}:{"content-type":"application/json"}),
 cookie:"apartment_session="+token,...opts.headers}});
 return {status:r.status,body:await r.json() as any};
}
async function run(){
 let ready=false;
 for(let i=0;i<65;i++){
  try{if((await fetch(url+"/readyz")).ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,180));
 }
 assert.equal(ready,true);
 const [owner,tenant]=await db.insert(users).values([
  {displayName:"Race Owner",lineSubject:"race-owner-"+id},
  {displayName:"Race Tenant",lineSubject:"race-tenant-"+id}
 ]).returning();records.users.push(owner.id,tenant.id);
 const ownerToken=newSessionToken(),tenantToken=newSessionToken();
 const rows=await db.insert(sessions).values([
  {userId:owner.id,tokenHash:tokenHash(ownerToken),expiresAt:new Date(Date.now()+180000)},
  {userId:tenant.id,tokenHash:tokenHash(tenantToken),expiresAt:new Date(Date.now()+180000)}
 ]).returning();records.sessions.push(...rows.map(r=>r.id));
 const [org]=await db.insert(organizations).values({name:"Finance race "+id}).returning();records.org=org.id;
 await db.insert(memberships).values({organizationId:org.id,userId:owner.id,role:"OWNER"});
 const [prop]=await db.insert(properties).values({name:"Finance Room",organizationId:org.id,
  rentSatang:400000,waterSatangPerUnit:100,electricSatangPerUnit:100}).returning();records.property=prop.id;
 const [room]=await db.insert(rooms).values({organizationId:org.id,propertyId:prop.id,number:"R101",status:"OCCUPIED"}).returning();records.room=room.id;
 const [lease]=await db.insert(leases).values({organizationId:org.id,propertyId:prop.id,roomId:room.id,
  startDate:"2026-10-01",tenantName:"Race Tenant",tenantLineSubject:tenant.lineSubject}).returning();records.lease=lease.id;
 const [invoice]=await db.insert(invoices).values({organizationId:org.id,propertyId:prop.id,roomId:room.id,leaseId:lease.id,
  periodStart:"2026-11-01",periodEnd:"2026-12-01",dueDate:"2026-12-07",amountSatang:400000,
  idempotencyKey:"race-"+id,issuedBy:owner.id}).returning();records.invoice=invoice.id;
 const ppath="/v1/properties/"+prop.id+"/payment-instructions";
 assert.equal((await api(ppath,ownerToken,{method:"PUT",body:JSON.stringify({bankName:"Demo Bank",accountName:"Demo Org",
  accountNumber:"1234567890",promptPayId:null,active:true,expectedVersion:null})})).status,200);
 const png=await sharp({create:{width:2,height:2,channels:3,background:{r:0,g:130,b:200}}}).png().toBuffer();
 const make=()=>{const f=new FormData();f.append("amountSatang","300000");f.append("paidAt",new Date().toISOString());
  f.append("evidence",new File([new Uint8Array(png)],"test.png",{type:"image/png"}));return f;};
 const pclaims="/v1/tenant/invoices/"+invoice.id+"/payment-claims";
 const [a,b]=await Promise.all([
  api(pclaims,tenantToken,{method:"POST",body:make(),headers:{"idempotency-key":"raceA-"+randomUUID()}}),
  api(pclaims,tenantToken,{method:"POST",body:make(),headers:{"idempotency-key":"raceB-"+randomUUID()}})
 ]);
 assert.equal(a.status,201,JSON.stringify(a.body));assert.equal(b.status,201,JSON.stringify(b.body));
 records.claims.push(a.body.claim.id,b.body.claim.id);
 const decision=(cid:string)=>api("/v1/properties/"+prop.id+"/payment-claims/"+cid+"/decision",ownerToken,{
  method:"POST",body:'{"action":"APPROVE"}'});
 const [d1,d2]=await Promise.all([decision(a.body.claim.id),decision(b.body.claim.id)]);
 assert.deepEqual([d1.status,d2.status].sort((x,y)=>x-y),[200,422],JSON.stringify([d1.body,d2.body]));
 const ledger=await db.select().from(paymentLedger).where(eq(paymentLedger.invoiceId,invoice.id));
 assert.equal(ledger.length,1);assert.equal(ledger[0].amountSatang,300000);
 const s=await api("/v1/tenant/invoices/"+invoice.id+"/payment-summary",tenantToken);
 assert.equal(s.status,200);assert.equal(s.body.outstandingSatang,100000);
 // File-size violation is 413, and the rate-limit response is 429 (not an internal 500).
 const oversized=new FormData();
 oversized.append("amountSatang","1");oversized.append("paidAt",new Date().toISOString());
 oversized.append("evidence",new File([new Uint8Array(4_000_100)],"too-big.png",{type:"image/png"}));
 const tooBig=await api(pclaims,tenantToken,{method:"POST",body:oversized,headers:{"idempotency-key":"big-"+randomUUID()}});
 assert.equal(tooBig.status,413,JSON.stringify(tooBig.body));
 for(let i=0;i<3;i++){
  const bad=await api(pclaims,tenantToken,{method:"POST",body:"{}",headers:{"idempotency-key":"bad-"+randomUUID()}});
  assert.equal(bad.status,415);
 }
 const tooMany=await api(pclaims,tenantToken,{method:"POST",body:"{}",headers:{"idempotency-key":"bad-"+randomUUID()}});
 assert.equal(tooMany.status,429,JSON.stringify(tooMany.body));
 console.log("PASS P3 concurrency: 2 claims, 2 concurrent owner approvals -> one 200, one 422, one ledger posting and correct outstanding; rate limit returns 429");
}
try{await run();}
finally{
 child.kill("SIGTERM");
 const list=records.claims.length?await db.select({id:paymentClaims.id,evidenceKey:paymentClaims.evidenceKey}).from(paymentClaims):[];
 for(const r of list.filter(x=>records.claims.includes(x.id)))await deletePrivateEvidence(r.evidenceKey);
 for(const cid of records.claims)await db.delete(paymentLedger).where(eq(paymentLedger.claimId,cid));
 for(const cid of records.claims)await db.delete(paymentClaims).where(eq(paymentClaims.id,cid));
 if(records.invoice){await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId,records.invoice));await db.delete(invoices).where(eq(invoices.id,records.invoice));}
 if(records.lease)await db.delete(leases).where(eq(leases.id,records.lease));
 if(records.room)await db.delete(rooms).where(eq(rooms.id,records.room));
 if(records.property)await db.delete(paymentInstructions).where(eq(paymentInstructions.propertyId,records.property));
 if(records.property)await db.delete(properties).where(eq(properties.id,records.property));
 if(records.org)await db.delete(memberships).where(eq(memberships.organizationId,records.org));
 for(const uid of records.users)await db.delete(auditLogs).where(eq(auditLogs.actorId,uid));
 if(records.org)await db.delete(organizations).where(eq(organizations.id,records.org));
 for(const sid of records.sessions)await db.delete(sessions).where(eq(sessions.id,sid));
 for(const uid of records.users)await db.delete(users).where(eq(users.id,uid));
 await sqlClient.end();
}
