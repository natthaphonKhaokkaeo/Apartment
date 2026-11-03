import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {strict as assert} from "node:assert";
import {eq} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {
 users,sessions,organizations,memberships,properties,rooms,leases,invoices,
 paymentClaims,paymentLedger,financeAdjustmentEntries,financeAdjustmentRequests,auditLogs
} from "../src/db/schema.js";
import {newSessionToken,tokenHash} from "../src/security.js";

const tag=randomUUID().slice(0,8),base="http://127.0.0.1:8088";
const child=spawn("node",["--import","tsx","src/index.ts"],{
 cwd:process.cwd(),stdio:"ignore",env:process.env
});
const ids={users:[] as string[],sessions:[] as string[],org:"",property:"",room:"",lease:"",invoice:"",claim:"",ledger:""};
async function http(path:string,token:string,method="GET",body:unknown=null,idem?:string){
 const response=await fetch(base+path,{method,headers:{"content-type":"application/json",
  cookie:"apartment_session="+token,...(idem?{"idempotency-key":idem}:{})},
  ...(body!==null?{body:JSON.stringify(body)}:{})});
 return {status:response.status,body:await response.json() as any};
}
try{
 let running=false;
 for(let i=0;i<75;i++){
  try{if((await fetch(base+"/readyz")).ok){running=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,120));
 }
 assert.ok(running,"API must start");
 const [a,b,m,t]=await db.insert(users).values([
  {lineSubject:"finance-owner-a-"+tag,displayName:"Finance First Owner"},
  {lineSubject:"finance-owner-b-"+tag,displayName:"Finance Second Owner"},
  {lineSubject:"finance-manager-"+tag,displayName:"Finance Manager"},
  {lineSubject:"finance-tenant-"+tag,displayName:"Finance Tenant"}
 ]).returning();ids.users.push(a.id,b.id,m.id,t.id);
 const tokens=[newSessionToken(),newSessionToken(),newSessionToken(),newSessionToken()];
 const sess=await db.insert(sessions).values(tokens.map((token,i)=>({
  userId:[a.id,b.id,m.id,t.id][i],tokenHash:tokenHash(token),
  expiresAt:new Date(Date.now()+120000)
 }))).returning();ids.sessions.push(...sess.map(x=>x.id));
 const [org]=await db.insert(organizations).values({name:"Finance Adjustments "+tag}).returning();
 ids.org=org.id;
 await db.insert(memberships).values([
  {organizationId:org.id,userId:a.id,role:"OWNER"},
  {organizationId:org.id,userId:b.id,role:"OWNER"},
  {organizationId:org.id,userId:m.id,role:"MANAGER"}
 ]);
 const [p]=await db.insert(properties).values({organizationId:org.id,name:"Finance P",
  rentSatang:500000,waterSatangPerUnit:100,electricSatangPerUnit:100}).returning();
 ids.property=p.id;
 const [room]=await db.insert(rooms).values({organizationId:org.id,propertyId:p.id,
  number:"F01",status:"OCCUPIED"}).returning();ids.room=room.id;
 const [lease]=await db.insert(leases).values({organizationId:org.id,propertyId:p.id,
  roomId:room.id,tenantName:"Finance Tenant",tenantLineSubject:t.lineSubject,startDate:"2026-10-01"}).returning();ids.lease=lease.id;
 const [bill]=await db.insert(invoices).values({organizationId:org.id,propertyId:p.id,
  roomId:room.id,leaseId:lease.id,periodStart:"2026-10-01",periodEnd:"2026-11-01",
  dueDate:"2026-11-07",amountSatang:500000,idempotencyKey:"finance-"+tag,issuedBy:a.id}).returning();ids.invoice=bill.id;
 const [claim]=await db.insert(paymentClaims).values({organizationId:org.id,propertyId:p.id,
  invoiceId:bill.id,leaseId:lease.id,submittedBy:t.id,amountSatang:300000,paidAt:new Date(),
  evidenceKey:randomUUID(),evidenceSha256:"a".repeat(64),idempotencyKey:"fixture-"+tag,
  status:"APPROVED"}).returning();ids.claim=claim.id;
 const [posting]=await db.insert(paymentLedger).values({organizationId:org.id,propertyId:p.id,
  invoiceId:bill.id,claimId:claim.id,amountSatang:300000,createdBy:a.id}).returning();ids.ledger=posting.id;
 const route="/v1/properties/"+p.id+"/invoices/"+bill.id+"/finance-adjustments";
 const list="/v1/properties/"+p.id+"/finance-adjustments";
 const propose=async(token:string,kind:string,amountSatang:number,other:Record<string,unknown>={})=>
  http(route,token,"POST",{kind,amountSatang,reason:"Correction after manual verification "+tag,...other},"f-"+randomUUID());
 const decide=async(token:string,id:string,action="APPROVE")=>
  http("/v1/properties/"+p.id+"/finance-adjustments/"+id+"/decision",
  token,"POST",{action,reviewReason:"Independent review and audit completed "+tag});
 assert.equal((await http(list,tokens[2])).status,403,"manager must never approve finance");
 assert.equal((await http(list,"invalid-session")).status,401);
 const credit=await propose(tokens[0],"INTERNAL_CREDIT",100000);
 assert.equal(credit.status,201,JSON.stringify(credit.body));
 const sameOwner=await decide(tokens[0],credit.body.request.id);
 assert.equal(sameOwner.status,403,JSON.stringify(sameOwner.body));
 const managerDecision=await decide(tokens[2],credit.body.request.id);
 assert.equal(managerDecision.status,403,JSON.stringify(managerDecision.body));
 const creditDecision=await decide(tokens[1],credit.body.request.id);
 assert.equal(creditDecision.status,200,JSON.stringify(creditDecision.body));
 assert.equal(creditDecision.body.financialPosition.outstandingSatang,100000);
 assert.equal(creditDecision.body.financialPosition.internalCreditSatang,100000);
 assert.equal(creditDecision.body.transferExecuted,false);
 assert.equal((await decide(tokens[1],credit.body.request.id)).status,409);
 const tenantSummary=await http("/v1/tenant/invoices/"+bill.id+"/payment-summary",tokens[3]);
 assert.equal(tenantSummary.status,200);
 assert.equal(tenantSummary.body.outstandingSatang,100000);
 assert.equal(tenantSummary.body.manuallyApprovedSatang,300000);
 assert.equal(tenantSummary.body.internalCreditSatang,100000);
 const overCredit=await propose(tokens[0],"INTERNAL_CREDIT",100001);
 assert.equal(overCredit.status,422);
 const refund=await propose(tokens[0],"REFUND_REVIEW",120000);
 assert.equal(refund.status,201,JSON.stringify(refund.body));
 const refundDecision=await decide(tokens[1],refund.body.request.id);
 assert.equal(refundDecision.status,200,JSON.stringify(refundDecision.body));
 assert.equal(refundDecision.body.transferExecuted,false);
 assert.equal(refundDecision.body.financialPosition.outstandingSatang,100000);
 const source=await propose(tokens[0],"REVERSE_MANUAL_PAYMENT",300000,{originalLedgerId:posting.id});
 assert.equal(source.status,201,JSON.stringify(source.body));
 const sourceDecision=await decide(tokens[1],source.body.request.id);
 assert.equal(sourceDecision.status,200,JSON.stringify(sourceDecision.body));
 assert.equal(sourceDecision.body.financialPosition.outstandingSatang,400000);
 assert.equal(sourceDecision.body.financialPosition.netManualApprovedSatang,0);
 const again=await propose(tokens[0],"REVERSE_MANUAL_PAYMENT",300000,{originalLedgerId:posting.id});
 assert.equal(again.status,201);
 assert.equal((await decide(tokens[1],again.body.request.id)).status,409);
 const records=await db.select().from(financeAdjustmentEntries).where(eq(financeAdjustmentEntries.invoiceId,bill.id));
 assert.equal(records.length,2);
 assert.equal((await db.select().from(paymentLedger).where(eq(paymentLedger.id,posting.id)))[0].amountSatang,300000);
 // Two second-owner credit reviews race for the same remaining balance.
 // The invoice FOR UPDATE lock ensures that only one of them can be posted.
 const raceA=await propose(tokens[0],"INTERNAL_CREDIT",300000);
 const raceB=await propose(tokens[0],"INTERNAL_CREDIT",300000);
 assert.equal(raceA.status,201,JSON.stringify(raceA.body));
 assert.equal(raceB.status,201,JSON.stringify(raceB.body));
 const [approvedA,approvedB]=await Promise.all([
  decide(tokens[1],raceA.body.request.id),decide(tokens[1],raceB.body.request.id)
 ]);
 assert.deepEqual([approvedA.status,approvedB.status].sort((a,b)=>a-b),[200,422],JSON.stringify([approvedA.body,approvedB.body]));
 const final=await http("/v1/tenant/invoices/"+bill.id+"/payment-summary",tokens[3]);
 assert.equal(final.status,200);
 assert.equal(final.body.outstandingSatang,100000);
 assert.equal(final.body.manuallyApprovedSatang,0);
 assert.equal(final.body.internalCreditSatang,400000);
 console.log("PASS financial adjustments HTTP: dual-owner control, manager 403, original ledger immutable, credit/refund/reversal, concurrent approvals one-winner and tenant balances");
}finally{
 child.kill("SIGTERM");
 if(ids.invoice)await db.delete(financeAdjustmentEntries).where(eq(financeAdjustmentEntries.invoiceId,ids.invoice));
 if(ids.invoice)await db.delete(financeAdjustmentRequests).where(eq(financeAdjustmentRequests.invoiceId,ids.invoice));
 if(ids.ledger)await db.delete(paymentLedger).where(eq(paymentLedger.id,ids.ledger));
 if(ids.claim)await db.delete(paymentClaims).where(eq(paymentClaims.id,ids.claim));
 if(ids.invoice)await db.delete(invoices).where(eq(invoices.id,ids.invoice));
 if(ids.lease)await db.delete(leases).where(eq(leases.id,ids.lease));
 if(ids.room)await db.delete(rooms).where(eq(rooms.id,ids.room));
 if(ids.property)await db.delete(properties).where(eq(properties.id,ids.property));
 if(ids.org)await db.delete(memberships).where(eq(memberships.organizationId,ids.org));
 for(const uid of ids.users)await db.delete(auditLogs).where(eq(auditLogs.actorId,uid));
 if(ids.org)await db.delete(organizations).where(eq(organizations.id,ids.org));
 for(const sid of ids.sessions)await db.delete(sessions).where(eq(sessions.id,sid));
 for(const uid of ids.users)await db.delete(users).where(eq(users.id,uid));
 await sqlClient.end();
}
