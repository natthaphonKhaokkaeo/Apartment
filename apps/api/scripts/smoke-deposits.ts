import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {strict as assert} from "node:assert";
import {eq} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {users,sessions,organizations,memberships,properties,rooms,leases,depositEntries,depositReviews} from "../src/db/schema.js";
import {newSessionToken,tokenHash} from "../src/security.js";
if(!process.env.APARTMENT_COVERAGE_ROOT||!process.env.DATABASE_URL?.includes("isolated_coverage_only@127.0.0.1:"))throw Error("DISPOSABLE_COVERAGE_DATABASE_REQUIRED");
const child=spawn("node",["--import","tsx","src/index.ts"],{cwd:process.cwd(),env:process.env,stdio:"ignore"});
const base="http://127.0.0.1:8088",tag=randomUUID();
async function request(path:string,token:string,method="GET",body?:unknown,key?:string){
 const r=await fetch(base+path,{method,headers:{cookie:"apartment_session="+token,...(body===undefined?{}:{"content-type":"application/json"}),...(key?{"idempotency-key":key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:r.status,body:await r.json() as any};
}
try{
 let ready=false;
 for(let i=0;i<80;i++){try{if((await fetch(base+"/readyz")).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready);
 const [a,b,manager,foreign,admin]=await db.insert(users).values(["a","b","manager","foreign","admin"].map((name,i)=>({lineSubject:"deposit-"+tag+"-"+name,displayName:name,platformRole:i===4?"SUPER_ADMIN" as const:"USER" as const}))).returning();
 const tokens:string[]=[];
 for(const u of [a,b,manager,foreign,admin]){
  const token=newSessionToken();await db.insert(sessions).values({userId:u.id,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+300000)});tokens.push(token);
 }
 const [org]=await db.insert(organizations).values({name:"Isolated deposit "+tag}).returning();
 await db.insert(memberships).values([{organizationId:org.id,userId:a.id,role:"OWNER"},{organizationId:org.id,userId:b.id,role:"OWNER"},{organizationId:org.id,userId:manager.id,role:"MANAGER"}]);
 const [p]=await db.insert(properties).values({organizationId:org.id,name:"Deposit test",rentSatang:10000,waterSatangPerUnit:100,electricSatangPerUnit:100}).returning();
 const [room]=await db.insert(rooms).values({organizationId:org.id,propertyId:p.id,number:"D101"}).returning();
 const [lease]=await db.insert(leases).values({organizationId:org.id,propertyId:p.id,roomId:room.id,tenantName:"Synthetic",startDate:"2026-11-01"}).returning();
 const path="/v1/properties/"+p.id+"/leases/"+lease.id+"/deposits";
 const receipt={amountSatang:10000,reference:"manual-"+tag,reason:"Synthetic manual deposit receipt"};
 const results=await Promise.all(Array.from({length:3},()=>request(path+"/receipts",tokens[0],"POST",receipt,"receive-"+tag)));
 assert.deepEqual(results.map(x=>x.status).sort(),[200,200,201]);
 const entryId=results[0].body.entry.id;
 assert.equal((await db.select().from(depositEntries).where(eq(depositEntries.leaseId,lease.id))).length,1);
 assert.equal((await request(path+"/receipts",tokens[0],"POST",{...receipt,amountSatang:10001},"receive-"+tag)).status,409);
 assert.equal((await request(path+"/receipts",tokens[0],"POST",receipt,"duplicate-"+tag)).status,409);
 for(const n of [-1,0.5,2147483648])assert.equal((await request(path+"/receipts",tokens[0],"POST",{...receipt,amountSatang:n},"invalid-"+randomUUID())).status,400);
 for(const token of [tokens[2],tokens[3],tokens[4]])assert.equal((await request(path,token)).status,403);
 assert.equal((await request(path+"/receipts",tokens[0],"POST",{...receipt,organizationId:org.id},"forged-"+tag)).status,400);
 const deduction={kind:"DEDUCTION",amountSatang:2000,reason:"Synthetic documented repair deduction"};
 const proposed=await request(path+"/reviews",tokens[0],"POST",deduction,"deduct-"+tag);assert.equal(proposed.status,201);
 const reviewId=proposed.body.review.id,decision=path+"/reviews/"+reviewId+"/decision";
 assert.equal((await request(path+"/reviews",tokens[0],"POST",deduction,"deduct-"+tag)).status,200);
 assert.equal((await request(decision,tokens[0],"POST",{action:"APPROVE",reason:"Original owner must not self approve"})).status,403);
 assert.equal((await request(decision,tokens[2],"POST",{action:"APPROVE",reason:"Manager must not approve finance"})).status,403);
 const decisions=await Promise.all(Array.from({length:3},()=>request(decision,tokens[1],"POST",{action:"APPROVE",reason:"Second owner checked documented deduction"})));
 assert.deepEqual(decisions.map(x=>x.status).sort(),[200,409,409]);
 assert.equal((await db.select().from(depositEntries).where(eq(depositEntries.reviewId,reviewId))).length,1);
 let context=await request(path,tokens[0]);
 assert.deepEqual(context.body.position,{receivedSatang:10000,deductedSatang:2000,balanceSatang:8000,reservedSatang:0,availableSatang:8000,bankVerified:false,payoutEnabled:false});
 const refunds=await Promise.all([6000,6000].map(amountSatang=>request(path+"/reviews",tokens[0],"POST",{kind:"REFUND_REVIEW",amountSatang,reason:"Synthetic review only no bank transfer"},"refund-"+randomUUID())));
 assert.deepEqual(refunds.map(x=>x.status).sort(),[201,422]);
 const refund=refunds.find(x=>x.status===201)!.body.review;
 assert.equal((await request(path+"/reviews/"+refund.id+"/decision",tokens[1],"POST",{action:"APPROVE",reason:"Review accepted only no actual payout"})).status,200);
 context=await request(path,tokens[0]);assert.equal(context.body.position.reservedSatang,6000);assert.equal(context.body.position.balanceSatang,8000);assert.equal(context.body.position.payoutEnabled,false);
 const dispute=await request(path+"/reviews",tokens[0],"POST",{kind:"DISPUTE_REVIEW",amountSatang:1000,reason:"Synthetic unresolved dispute reservation"},"dispute-"+tag);assert.equal(dispute.status,201);
 assert.equal((await request(path+"/reviews/"+dispute.body.review.id+"/decision",tokens[1],"POST",{action:"REJECT",reason:"Second owner rejected after investigation"})).status,200);
 assert.equal((await request(path,tokens[0])).body.position.availableSatang,2000);
 assert.equal((await request(path.replace(lease.id,randomUUID()),tokens[0])).status,404);
 assert.equal((await request(path+"/reviews/"+randomUUID()+"/decision",tokens[1],"POST",{action:"REJECT",reason:"Foreign request must not be accessible"})).status,404);
 await assert.rejects(sqlClient`update deposit_entries set amount_satang=1 where id=${entryId}`,/DEPOSIT_ENTRY_IMMUTABLE/);
 await assert.rejects(sqlClient`delete from deposit_entries where id=${entryId}`,/DEPOSIT_ENTRY_IMMUTABLE/);
 await db.update(memberships).set({status:"DISABLED"}).where(eq(memberships.userId,b.id));
 assert.equal((await request(path,tokens[1])).status,403);
 assert.equal((await db.select().from(depositReviews).where(eq(depositReviews.id,refund.id)))[0].status,"APPROVED");
 console.log("PASS deposits: scoped active owner only, no admin/manager bypass, 3-way receipt replay, duplicate reference, strict amounts, two-owner review, 3-way one debit, concurrent over-reservation denied, refund review never pays, rejected dispute release, IDOR, revoked owner denial, immutable DB ledger");
}finally{
 child.kill("SIGTERM");await new Promise(r=>setTimeout(r,200));await sqlClient.end();
}
