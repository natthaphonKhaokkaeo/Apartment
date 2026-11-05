import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import sharp from "sharp";
import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs";
import {strict as assert} from "node:assert";
import {eq} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {users,sessions,organizations,memberships,properties,rooms,leases,meterReadings,invoices,invoiceLines,auditLogs,leaseInvitations,paymentClaims,paymentLedger,paymentInstructions} from "../src/db/schema.js";
import {newSessionToken,tokenHash} from "../src/security.js";
import {bangkokToday} from "../src/services/property-rates.js";
import {meterReplacements} from "../src/db/schema.js";
import {deletePrivateEvidence} from "../src/services/evidence.js";

const ids:{users:string[];sessions:string[];orgs:string[];props:string[];rooms:string[];leases:string[];readings:string[];invoices:string[];claims:string[]}={
 users:[],sessions:[],orgs:[],props:[],rooms:[],leases:[],readings:[],invoices:[],claims:[]
};
const tag=randomUUID().slice(0,8),base="http://127.0.0.1:8088";
const child=spawn("node",["--import","tsx","src/index.ts"],{cwd:process.cwd(),stdio:"ignore",env:process.env});
async function request(path:string,token:string,options:RequestInit={}){
 const r=await fetch(base+path,{...options,headers:{...(options.body instanceof FormData?{}:{"content-type":"application/json"}),cookie:"apartment_session="+token,...options.headers}});
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
 const financial=await request("/v1/properties/"+pa.id+"/financial-report?from=2026-11-01&to=2026-11-30",token);
 assert.equal(financial.status,200,JSON.stringify(financial.body));
 assert.equal(financial.body.totals.totalBilledSatang,413000);
 assert.equal(financial.body.totals.outstandingSatang,413000);
 assert.equal(financial.body.bankVerified,false);
 const replay=await request("/v1/properties/"+pa.id+"/bills/issue",token,{method:"POST",body:payload,headers:{"idempotency-key":idempotencyKey}});
 assert.equal(replay.status,200);assert.equal(replay.body.invoice.id,issue.body.invoice.id);
 const duplicate=await request("/v1/properties/"+pa.id+"/bills/issue",token,{method:"POST",body:payload,headers:{"idempotency-key":"other-"+randomUUID()}});
 assert.equal(duplicate.status,409);
 const invoice=await request("/v1/properties/"+pa.id+"/invoices/"+issue.body.invoice.id,token);
 assert.equal(invoice.status,200);assert.equal(invoice.body.lines.length,3);
 assert.equal(invoice.body.lines.reduce((n:number,l:any)=>n+l.amountSatang,0),413000);
 console.log("PASS HTTP: owner scope (200/403), admin denial, bill preview, transactional issue (201), replay (200), duplicate (409), immutable 3 lines");
 // P1-02: historical property master rates, future period-only schedule and snapshots.
 const ratePath="/v1/properties/"+pa.id+"/rates";
 const initial=await request(ratePath,token);
 assert.equal(initial.status,200);
 assert.equal(initial.body.length,1);
 assert.equal(initial.body[0].effectiveFrom,"1900-01-01");
 assert.equal(initial.body[0].rentSatang,400000);
 assert.equal((await request("/v1/properties/"+pb.id+"/rates",token)).status,403);
 const [rateManager]=await db.insert(users).values({
  lineSubject:"http-manager-"+tag,displayName:"Manager"
 }).returning();ids.users.push(rateManager.id);
 await db.insert(memberships).values({
  organizationId:oa.id,userId:rateManager.id,role:"MANAGER"
 });
 const rateManagerToken=newSessionToken();
 const [rateManagerSession]=await db.insert(sessions).values({
  userId:rateManager.id,tokenHash:tokenHash(rateManagerToken),
  expiresAt:new Date(Date.now()+180000)
 }).returning();ids.sessions.push(rateManagerSession.id);
 const [yy,mm]=bangkokToday().split("-").map(Number);
 const rateStart=new Date(Date.UTC(yy,mm,1)).toISOString().slice(0,10);
 const rateEnd=new Date(Date.UTC(yy,mm+1,1)).toISOString().slice(0,10);
 const newRate={
  effectiveFrom:rateStart,rentSatang:450000,
  waterSatangPerUnit:1850,electricSatangPerUnit:450,
  reason:"Updated audited master rate for a future full billing period"
 };
 assert.equal((await request(ratePath,rateManagerToken,{method:"POST",
  body:JSON.stringify(newRate)})).status,403);
 assert.equal((await request("/v1/properties/"+pb.id+"/rates",token,{method:"POST",
  body:JSON.stringify(newRate)})).status,403);
 assert.equal((await request(ratePath,token,{method:"POST",
  body:JSON.stringify({...newRate,effectiveFrom:"2020-01-01"})})).status,422);
 const badMidcycle=rateStart.slice(0,8)+"15";
 assert.equal((await request(ratePath,token,{method:"POST",
  body:JSON.stringify({...newRate,effectiveFrom:badMidcycle})})).status,422);
 assert.equal((await request(ratePath,token,{method:"POST",
  body:JSON.stringify({...newRate,waterSatangPerUnit:2001})})).status,422);
 const scheduled=await request(ratePath,token,{method:"POST",body:JSON.stringify(newRate)});
 assert.equal(scheduled.status,201,JSON.stringify(scheduled.body));
 assert.equal(scheduled.body.effectiveFrom,rateStart);
 assert.equal((await request(ratePath,token,{method:"POST",
  body:JSON.stringify(newRate)})).status,409);
 const history=await request(ratePath,token);
 assert.equal(history.status,200);assert.equal(history.body.length,2);
 assert.equal(history.body[0].id,scheduled.body.id);
 const oldStill=await request("/v1/properties/"+pa.id+"/invoices/"+issue.body.invoice.id,token);
 assert.equal(oldStill.body.lines.reduce((sum:number,l:any)=>sum+l.amountSatang,0),413000);
 assert.equal(oldStill.body.lines[0].snapshot.masterRateVersionId,initial.body[0].id);
 const futureReadings=[];
 for(const kind of ["WATER","ELECTRIC"] as const)
  for(const [day,value] of [[rateStart,kind==="WATER"?"105.000":"210.000"],
   [rateEnd,kind==="WATER"?"110.000":"220.000"]] as const)
   futureReadings.push({organizationId:oa.id,propertyId:pa.id,roomId:room.id,
    kind,readAt:day,value,createdBy:u.id});
 const futureRows=await db.insert(meterReadings).values(futureReadings)
  .onConflictDoNothing().returning({id:meterReadings.id});
 ids.readings.push(...futureRows.map(row=>row.id));
 const futurePreview=await request("/v1/properties/"+pa.id+"/bills/preview",token,{
  method:"POST",body:JSON.stringify({roomId:room.id,
   start:rateStart,endExclusive:rateEnd})
 });
 assert.equal(futurePreview.status,200,JSON.stringify(futurePreview.body));
 assert.equal(futurePreview.body.totalSatang,463750);
 assert.ok(futurePreview.body.lines.every((line:any)=>
  line.snapshot.masterRateVersionId===scheduled.body.id));
 assert.ok((await db.select().from(auditLogs).where(eq(auditLogs.actorId,u.id)))
  .some(a=>a.action==="PROPERTY_RATE_SCHEDULED"&&a.targetId===scheduled.body.id));
 console.log("PASS P1-02: baseline trigger, owner scope, future full-period version, upper legal cap, audit, old immutable bill and new tariff preview");
 const roomPath="/v1/properties/"+pa.id+"/rooms/"+room.id+"/rates";
 const baseRoom=await request(roomPath,token);
 assert.equal(baseRoom.status,200);assert.equal(baseRoom.body.length,1);
 assert.equal(baseRoom.body[0].rentOverrideSatang,null);
 assert.equal(oldStill.body.lines[0].snapshot.roomRateVersionId,baseRoom.body[0].id);
 assert.equal((await request("/v1/properties/"+pa.id+"/rooms/"+room.id,token,{
  method:"PATCH",body:JSON.stringify({rentOverrideSatang:500000})
 })).status,409);
 const overrideNext={effectiveFrom:rateStart,rentOverrideSatang:500000,
  waterOverrideSatang:null,electricOverrideSatang:350,
  reason:"New tenant rent and verified electricity unit price"};
 assert.equal((await request(roomPath,rateManagerToken,{
  method:"POST",body:JSON.stringify(overrideNext)
 })).status,403);
 assert.equal((await request(roomPath,token,{method:"POST",
  body:JSON.stringify({...overrideNext,effectiveFrom:"2020-01-01"})
 })).status,422);
 assert.equal((await request(roomPath,token,{method:"POST",
  body:JSON.stringify({...overrideNext,waterOverrideSatang:999999})
 })).status,422);
 const changedRoom=await request(roomPath,token,{
  method:"POST",body:JSON.stringify(overrideNext)
 });
 assert.equal(changedRoom.status,201,JSON.stringify(changedRoom.body));
 assert.equal((await request(roomPath,token,{
  method:"POST",body:JSON.stringify(overrideNext)
 })).status,409);
 const newPreview=await request("/v1/properties/"+pa.id+"/bills/preview",token,{
  method:"POST",body:JSON.stringify({roomId:room.id,
   start:rateStart,endExclusive:rateEnd})
 });
 assert.equal(newPreview.status,200,JSON.stringify(newPreview.body));
 assert.equal(newPreview.body.totalSatang,512750);
 assert.ok(newPreview.body.lines.every((v:any)=>
  v.snapshot.roomRateVersionId===changedRoom.body.id));
 const oldInvoice=await request("/v1/properties/"+pa.id+"/invoices/"+issue.body.invoice.id,token);
 assert.equal(oldInvoice.body.lines.reduce((n:number,l:any)=>n+l.amountSatang,0),413000);
 assert.equal(oldInvoice.body.lines[0].snapshot.roomRateVersionId,baseRoom.body[0].id);
 assert.ok((await db.select().from(auditLogs).where(eq(auditLogs.actorId,u.id)))
  .some(v=>v.action==="ROOM_RATE_SCHEDULED"&&v.targetId===changedRoom.body.id));
 console.log("PASS P1-03a: future room rates, immutable invoice, owner scope, audit");
 const [shortRoom]=await db.insert(rooms).values({
  organizationId:oa.id,propertyId:pa.id,number:"P103",status:"OCCUPIED"
 }).returning();ids.rooms.push(shortRoom.id);
 const [shortLease]=await db.insert(leases).values({
  organizationId:oa.id,propertyId:pa.id,roomId:shortRoom.id,
  tenantName:"Move In Fixture",startDate:"2026-11-10"
 }).returning();ids.leases.push(shortLease.id);
 const shortReadings=[];
 for(const kind of ["WATER","ELECTRIC"] as const)
  for(const [readingDate,value] of [
   ["2026-11-10",kind==="WATER"?"100.000":"200.000"],
   ["2026-12-01",kind==="WATER"?"105.000":"210.000"]
  ] as const)shortReadings.push({
   organizationId:oa.id,propertyId:pa.id,roomId:shortRoom.id,
   readAt:readingDate,kind,value,createdBy:u.id
  });
 const insertedReadings=await db.insert(meterReadings).values(shortReadings).returning();
 ids.readings.push(...insertedReadings.map(x=>x.id));
 const moveInBody={roomId:shortRoom.id,start:"2026-11-10",
  endExclusive:"2026-12-01",partialMode:"MOVE_IN"};
 const moveInPath="/v1/properties/"+pa.id+"/bills/";
 assert.equal((await request(moveInPath+"preview",token,{
  method:"POST",body:JSON.stringify({...moveInBody,partialMode:undefined})
 })).status,422);
 assert.equal((await request(moveInPath+"preview",token,{
  method:"POST",body:JSON.stringify({...moveInBody,endExclusive:"2026-11-25"})
 })).status,422);
 const partialPreview=await request(moveInPath+"preview",token,{
  method:"POST",body:JSON.stringify(moveInBody)
 });
 assert.equal(partialPreview.status,200,JSON.stringify(partialPreview.body));
 assert.equal(partialPreview.body.totalSatang,293000);
 const partialIssue=await request(moveInPath+"issue",token,{
  method:"POST",body:JSON.stringify(moveInBody),
  headers:{"idempotency-key":"partial-"+randomUUID()}
 });
 assert.equal(partialIssue.status,201,JSON.stringify(partialIssue.body));
 ids.invoices.push(partialIssue.body.invoice.id);
 assert.equal((await request(moveInPath+"issue",token,{
  method:"POST",body:JSON.stringify(moveInBody),
  headers:{"idempotency-key":"partial-duplicate-"+randomUUID()}
 })).status,409);
 const partialDocument=await request("/v1/properties/"+pa.id+"/invoices/"+partialIssue.body.invoice.id,token);
 assert.equal(partialDocument.body.lines[0].snapshot.partialMode,"MOVE_IN");
 console.log("PASS P1-03b: exact lease-start move-in proration, partial rent, utility boundaries and no double bill");
 const [swapRoom]=await db.insert(rooms).values({
  organizationId:oa.id,propertyId:pa.id,number:"P103C",status:"OCCUPIED"
 }).returning();ids.rooms.push(swapRoom.id);
 const [swapLease]=await db.insert(leases).values({
  organizationId:oa.id,propertyId:pa.id,roomId:swapRoom.id,
  tenantName:"Meter Swap Fixture",startDate:"2026-11-01"
 }).returning();ids.leases.push(swapLease.id);
 const meterInitial=await db.insert(meterReadings).values([
  {organizationId:oa.id,propertyId:pa.id,roomId:swapRoom.id,kind:"WATER",
   readAt:"2026-11-01",value:"100.000",createdBy:u.id},
  {organizationId:oa.id,propertyId:pa.id,roomId:swapRoom.id,kind:"ELECTRIC",
   readAt:"2026-11-01",value:"200.000",createdBy:u.id}
 ]).returning();ids.readings.push(...meterInitial.map(x=>x.id));
 const swapPath="/v1/properties/"+pa.id+"/rooms/"+swapRoom.id+"/meter-replacements";
 const swapInfo={roomId:swapRoom.id,kind:"WATER",
  replacedAt:"2026-11-02",oldSerial:"WATER-OLD-001",newSerial:"WATER-NEW-002",
  oldClosingValue:"125.000",newOpeningValue:"3.000",
  evidenceRef:"DEV_TEST_PHOTO_REF_"+tag,
  reason:"Damaged meter replaced with handover readings"};
 assert.equal((await request(swapPath,rateManagerToken,{
  method:"POST",body:JSON.stringify(swapInfo)
 })).status,403);
 assert.equal((await request(swapPath,token,{
  method:"POST",body:JSON.stringify({...swapInfo,oldClosingValue:"99.000"})
 })).status,422);
 const changed=await request(swapPath,token,{
  method:"POST",body:JSON.stringify(swapInfo)
 });
 assert.equal(changed.status,201,JSON.stringify(changed.body));
 ids.readings.push(changed.body.openingReading.id);
 assert.equal((await request(swapPath,token,{
  method:"POST",body:JSON.stringify(swapInfo)
 })).status,409);
 const readingPath="/v1/properties/"+pa.id+"/readings";
 const newReading=await request(readingPath,token,{
  method:"POST",body:JSON.stringify({roomId:swapRoom.id,
   kind:"WATER",readAt:"2026-11-03",value:"4.000"})
 });
 assert.equal(newReading.status,201,JSON.stringify(newReading.body));
 ids.readings.push(newReading.body.id);
 const newLast=await db.insert(meterReadings).values([
  {organizationId:oa.id,propertyId:pa.id,roomId:swapRoom.id,kind:"WATER",
   readAt:"2026-12-01",value:"8.000",createdBy:u.id},
  {organizationId:oa.id,propertyId:pa.id,roomId:swapRoom.id,kind:"ELECTRIC",
   readAt:"2026-12-01",value:"210.000",createdBy:u.id}
 ]).returning();ids.readings.push(...newLast.map(x=>x.id));
 const swapPreview=await request("/v1/properties/"+pa.id+"/bills/preview",token,{
  method:"POST",body:JSON.stringify({roomId:swapRoom.id,
   start:"2026-11-01",endExclusive:"2026-12-01"})
 });
 assert.equal(swapPreview.status,200,JSON.stringify(swapPreview.body));
 const waterLine=swapPreview.body.lines.find((l:any)=>l.type==="WATER");
 assert.equal(waterLine.unitsMilli,30000);
 assert.deepEqual(waterLine.snapshot.meterReplacementIds,[changed.body.replacement.id]);
 assert.equal(waterLine.amountSatang,54000);
 assert.equal((await request("/v1/properties/"+pb.id+"/rooms/"+swapRoom.id+"/meter-replacements",token)).status,403);
 console.log("PASS P1-03c meter swap: owner-only, closing/opening readings, actual 30 unit billing and immutable replacement evidence");
 // Final move-out invoice spans Nov 1 -> physical Nov 3 handover only.
 const electricityAtExit=await request(readingPath,token,{
  method:"POST",body:JSON.stringify({roomId:swapRoom.id,
   kind:"ELECTRIC",readAt:"2026-11-03",value:"202.000"})
 });
 assert.equal(electricityAtExit.status,201,JSON.stringify(electricityAtExit.body));
 ids.readings.push(electricityAtExit.body.id);
 const finalBody={roomId:swapRoom.id,start:"2026-11-01",
  endExclusive:"2026-11-03",partialMode:"MOVE_OUT"};
 assert.equal((await request("/v1/properties/"+pa.id+"/bills/preview",token,{
  method:"POST",body:JSON.stringify({...finalBody,endExclusive:"2026-11-05"})
 })).status,422);
 const finalPreview=await request("/v1/properties/"+pa.id+"/bills/preview",token,{
  method:"POST",body:JSON.stringify(finalBody)
 });
 assert.equal(finalPreview.status,200,JSON.stringify(finalPreview.body));
 assert.equal(finalPreview.body.lines.find((l:any)=>l.type==="WATER").unitsMilli,26000);
 assert.equal(finalPreview.body.lines[0].snapshot.partialMode,"MOVE_OUT");
 const finalIssue=await request("/v1/properties/"+pa.id+"/bills/issue",token,{
  method:"POST",body:JSON.stringify(finalBody),
  headers:{"idempotency-key":"final-moveout-"+randomUUID()}
 });
 assert.equal(finalIssue.status,201,JSON.stringify(finalIssue.body));
 ids.invoices.push(finalIssue.body.invoice.id);
 const exitPath="/v1/properties/"+pa.id+"/leases/"+swapLease.id+"/move-out";
 const exitBody={endExclusive:"2026-11-03",
  roomDisposition:"MAINTENANCE",confirmedHandover:true};
 const unpaidExit=await request(exitPath,token,{
  method:"POST",body:JSON.stringify(exitBody)
 });
 assert.equal(unpaidExit.status,409,JSON.stringify(unpaidExit.body));
 assert.equal(unpaidExit.body.error,"MOVE_OUT_UNSETTLED_INVOICES");
 const [paidClaim]=await db.insert(paymentClaims).values({
  organizationId:oa.id,propertyId:pa.id,invoiceId:finalIssue.body.invoice.id,
  leaseId:swapLease.id,submittedBy:u.id,
  amountSatang:finalIssue.body.invoice.amountSatang,
  paidAt:new Date(),transferReference:"FINAL-P103C-"+tag,
  evidenceKey:randomUUID(),evidenceSha256:"e".repeat(64),
  idempotencyKey:"p103c-payment-"+randomUUID(),status:"APPROVED"
 }).returning();
 ids.claims.push(paidClaim.id);
 await db.insert(paymentLedger).values({
  organizationId:oa.id,propertyId:pa.id,invoiceId:finalIssue.body.invoice.id,
  claimId:paidClaim.id,amountSatang:finalIssue.body.invoice.amountSatang,
  createdBy:u.id
 });
 const closed=await request(exitPath,token,{
  method:"POST",body:JSON.stringify(exitBody)
 });
 assert.equal(closed.status,200,JSON.stringify(closed.body));
 assert.equal(closed.body.status,"ENDED");
 assert.equal(closed.body.roomStatus,"MAINTENANCE");
 assert.equal((await request(exitPath,token,{
  method:"POST",body:JSON.stringify(exitBody)
 })).status,409);
 console.log("PASS P1-03c final bill: partial MOVE_OUT, swapped meter continuity, unpaid closure denied, settled lease ends and room maintenance");






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
 // P3 local payment configuration, evidence submission, approval and balance smoke.
 const settingsPath="/v1/properties/"+pa.id+"/payment-instructions";
 assert.equal((await request(settingsPath,token)).body,null);
 const noSettings=await request("/v1/tenant/invoices/"+issue.body.invoice.id+"/payment-instructions",tenantTokenA);
 assert.equal(noSettings.status,404);
 const ownerBank=await request(settingsPath,token,{method:"PUT",body:JSON.stringify({
  bankName:"Demo Bank (test only)",accountName:"Demo Account",accountNumber:"1234567890",promptPayId:null,
  active:true,expectedVersion:null
 })});
 assert.equal(ownerBank.status,200,JSON.stringify(ownerBank.body));assert.equal(ownerBank.body.version,1);
 assert.equal(ownerBank.body.accountNumberMasked,"••••••7890");
 const bankTenant=await request("/v1/tenant/invoices/"+issue.body.invoice.id+"/payment-instructions",tenantTokenA);
 assert.equal(bankTenant.status,200);
 assert.equal(bankTenant.body.accountNumber,"1234567890");
 assert.equal((await request("/v1/tenant/invoices/"+issue.body.invoice.id+"/payment-instructions",tenantTokenB)).status,404);
 assert.equal((await request(settingsPath,token,{method:"PUT",body:JSON.stringify({
  bankName:"Demo Bank",accountName:"Demo Account",accountNumber:"1234567890",promptPayId:null,
  active:true,expectedVersion:null
 })})).status,409);
 // P3-01b: PromptPay display-only QR is scoped to the approved tenant and the issued invoice.
 const tenantQR="/v1/tenant/invoices/"+issue.body.invoice.id+"/promptpay-qr";
 const ownerQR="/v1/properties/"+pa.id+"/invoices/"+issue.body.invoice.id+"/promptpay-qr";
 assert.equal((await request(tenantQR,tenantTokenA)).status,404); // no PromptPay destination set yet
 const invalidPP=await request(settingsPath,token,{method:"PUT",body:JSON.stringify({
  bankName:"Demo Bank (test only)",accountName:"Demo Account",accountNumber:"1234567890",
  promptPayId:"08123456789",active:true,expectedVersion:1
 })});
 assert.equal(invalidPP.status,400,JSON.stringify(invalidPP.body));
 const configuredPP=await request(settingsPath,token,{method:"PUT",body:JSON.stringify({
  bankName:"Demo Bank (test only)",accountName:"Demo Account",accountNumber:"1234567890",
  promptPayId:"0812345678",active:true,expectedVersion:1
 })});
 assert.equal(configuredPP.status,200,JSON.stringify(configuredPP.body));
 const qr1=await request(tenantQR,tenantTokenA);
 assert.equal(qr1.status,200,JSON.stringify(qr1.body));
 assert.equal(qr1.body.amountSatang,413000);
 assert.equal(qr1.body.recipientName,"Demo Account");
 assert.equal(qr1.body.promptPayIdMasked,"******5678");
 assert.equal(qr1.body.recipientVerifiedByBank,false);
 assert.equal(qr1.body.paymentVerifiedByBank,false);
 assert.equal(qr1.body.status,"DISPLAY_ONLY_MANUAL_REVIEW");
 assert.ok(qr1.body.payload.includes("01130066812345678"));
 assert.ok(qr1.body.payload.includes("54074130.00"));
 const qrOwner=await request(ownerQR,token);
 assert.equal(qrOwner.status,200);assert.equal(qrOwner.body.payload,qr1.body.payload);
 assert.equal((await request(tenantQR,tenantTokenB)).status,404);
 assert.equal((await request(tenantQR,"invalid-session")).status,401);
 assert.equal((await request("/v1/properties/"+pb.id+"/invoices/"+issue.body.invoice.id+"/promptpay-qr",token)).status,403);
 // Disabling property payment settings must disable QR immediately.
 await db.update(paymentInstructions).set({active:"NO"}).where(eq(paymentInstructions.propertyId,pa.id));
 assert.equal((await request(tenantQR,tenantTokenA)).status,404);
 await db.update(paymentInstructions).set({active:"YES"}).where(eq(paymentInstructions.propertyId,pa.id));
 console.log("PASS P3 PromptPay: 10-digit mobile payload, amount, masked recipient, owner/tenant scope, invalid ID 400, outsider 404, disabled settings 404, no bank verification");

 // Manager at org A can view property but cannot edit bank details or approve claims.
 await db.insert(memberships).values({organizationId:oa.id,userId:v.id,role:"MANAGER"});
 const managerToken=newSessionToken();
 const [managerSession]=await db.insert(sessions).values({userId:v.id,tokenHash:tokenHash(managerToken),expiresAt:new Date(Date.now()+60000)}).returning();
 ids.sessions.push(managerSession.id);
 assert.equal((await request(settingsPath,managerToken,{method:"PUT",body:JSON.stringify({
  bankName:"Malicious Bank",accountName:"Hacker",accountNumber:"9876543210",promptPayId:null,
  active:true,expectedVersion:1
 })})).status,403);
 const samplePng=await sharp({create:{width:4,height:4,channels:3,background:{r:250,g:250,b:245}}}).png().toBuffer();
 const claimURL="/v1/tenant/invoices/"+issue.body.invoice.id+"/payment-claims";
 async function submitPayment(amount:number,reference:string,key:string,buffer:Buffer=samplePng,mime="image/png",url=claimURL){
  const form=new FormData();
  form.append("amountSatang",String(amount));
  form.append("paidAt",new Date().toISOString());
  form.append("transferReference",reference);
  form.append("evidence",new File([new Uint8Array(buffer)],"demo.png",{type:mime}));
  return request(url,tenantTokenA,{method:"POST",body:form,headers:{"idempotency-key":key}});
 }
 const firstKey="dev-first-"+randomUUID();
 const first=await submitPayment(120000,"DEV-AAAA01",firstKey);
 assert.equal(first.status,201,JSON.stringify(first.body));ids.claims.push(first.body.claim.id);
 assert.equal((await request(tenantQR,tenantTokenA)).status,409); // hide QR during pending claim to avoid duplicate transfers
 assert.equal(first.body.claim.evidenceKey,undefined);
 const evidenceReq=async(path:string,cookie:string)=>fetch(base+path,{headers:{cookie:"apartment_session="+cookie}});
 const ownerSlip="/v1/properties/"+pa.id+"/payment-claims/"+first.body.claim.id+"/evidence";
 const evidenceOwner=await evidenceReq(ownerSlip,token);
 assert.equal(evidenceOwner.status,200);
 assert.equal(evidenceOwner.headers.get("content-type"),"image/webp");
 assert.equal(evidenceOwner.headers.get("cache-control"),"no-store");
 assert.equal((await evidenceReq(ownerSlip,managerToken)).status,403);
 assert.equal((await evidenceReq("/v1/tenant/payment-claims/"+first.body.claim.id+"/evidence",tenantTokenB)).status,404);
 assert.equal((await evidenceReq("/v1/tenant/payment-claims/"+first.body.claim.id+"/evidence",tenantTokenA)).status,200);
 const duplicateClaim=await submitPayment(120000,"DEV-AAAA01",firstKey);
 assert.equal(duplicateClaim.status,200);
 assert.equal(duplicateClaim.body.claim.id,first.body.claim.id);
 const badMime=await submitPayment(120000,"DEV-BAD001","badmime-"+randomUUID(),Buffer.from("not an image"),"text/plain");
 assert.equal(badMime.status,415,JSON.stringify(badMime.body));
 let summary=await request("/v1/tenant/invoices/"+issue.body.invoice.id+"/payment-summary",tenantTokenA);
 assert.equal(summary.status,200);assert.equal(summary.body.manuallyApprovedSatang,0);
 assert.equal(summary.body.outstandingSatang,413000);
 const decisionURL="/v1/properties/"+pa.id+"/payment-claims/"+first.body.claim.id+"/decision";
 assert.equal((await request(decisionURL,managerToken,{method:"POST",body:'{"action":"APPROVE"}'})).status,403);
 const approvedPart=await request(decisionURL,token,{method:"POST",body:'{"action":"APPROVE"}'});
 assert.equal(approvedPart.status,200,JSON.stringify(approvedPart.body));assert.equal(approvedPart.body.outstandingSatang,293000);
 assert.equal((await request(decisionURL,token,{method:"POST",body:'{"action":"APPROVE"}'})).status,409);
 const qrAfterPartial=await request(tenantQR,tenantTokenA);
 assert.equal(qrAfterPartial.status,200,JSON.stringify(qrAfterPartial.body));
 assert.equal(qrAfterPartial.body.amountSatang,293000);
 assert.ok(qrAfterPartial.body.payload.includes("54072930.00"));
 assert.notEqual(qrAfterPartial.body.payload,qr1.body.payload);

 const second=await submitPayment(150000,"DEV-BBBB02","dev-second-"+randomUUID());
 assert.equal(second.status,201,JSON.stringify(second.body));ids.claims.push(second.body.claim.id);
 const rejection=await request("/v1/properties/"+pa.id+"/payment-claims/"+second.body.claim.id+"/decision",
  token,{method:"POST",body:'{"action":"REJECT","reason":"Payment not confirmed in bank records"}'});
 assert.equal(rejection.status,200);assert.equal(rejection.body.outstandingSatang,293000);
 const finalClaim=await submitPayment(293000,"DEV-CCCC03","dev-final-"+randomUUID());
 assert.equal(finalClaim.status,201,JSON.stringify(finalClaim.body));ids.claims.push(finalClaim.body.claim.id);
 const full=await request("/v1/properties/"+pa.id+"/payment-claims/"+finalClaim.body.claim.id+"/decision",token,{method:"POST",body:'{"action":"APPROVE"}'});
 assert.equal(full.status,200,JSON.stringify(full.body));assert.equal(full.body.outstandingSatang,0);
 assert.equal((await request(tenantQR,tenantTokenA)).status,409); // manually recorded full balance, no active QR

 const overpay=await submitPayment(1,"DEV-DDDD04","dev-overpay-"+randomUUID());
 assert.equal(overpay.status,422,JSON.stringify(overpay.body));
 summary=await request("/v1/tenant/invoices/"+issue.body.invoice.id+"/payment-summary",tenantTokenA);
 assert.equal(summary.body.manuallyApprovedSatang,413000);
 assert.equal(summary.body.settlementState,"FULLY_RECORDED");
 const list=await request("/v1/properties/"+pa.id+"/payment-claims",token);
 assert.equal(list.status,200);assert.equal(list.body.filter((c:any)=>c.invoiceId===issue.body.invoice.id).length,3);
 assert.equal((await request("/v1/properties/"+pb.id+"/payment-claims",token)).status,403);
 const savedInvoice=await request("/v1/properties/"+pa.id+"/invoices/"+issue.body.invoice.id,token);
 assert.equal(savedInvoice.body.status,"ISSUED");
 console.log("PASS P3 HTTP: bank version CAS, tenant IDOR 404, manager cannot edit/approve, image sanitized, approval/rejection/partial/full, no overpay/replay");
 // P3-05b: owner and linked tenant can download the same informational PDF;
 // an unrelated tenant and unauthenticated visitor cannot.
 const pdfPath="/v1/properties/"+pa.id+"/invoices/"+issue.body.invoice.id+"/billing-notice.pdf";
 const tenantPdfPath="/v1/tenant/invoices/"+issue.body.invoice.id+"/billing-notice.pdf";
 const raw=async(path:string,session:string)=>{
  return fetch(base+path,{headers:{cookie:"apartment_session="+session}});
 };
 const ownerPdf=await raw(pdfPath,token);
 assert.equal(ownerPdf.status,200,await ownerPdf.clone().text());
 assert.match(ownerPdf.headers.get("content-type")||"",/application\/pdf/);
 assert.match(ownerPdf.headers.get("cache-control")||"",/no-store/);
 assert.match(ownerPdf.headers.get("content-disposition")||"",/attachment/);
 const ownerBytes=Buffer.from(await ownerPdf.arrayBuffer());
 assert.equal(ownerBytes.subarray(0,5).toString(),"%PDF-");
 const pdfDoc=await getDocument({data:new Uint8Array(ownerBytes),useSystemFonts:false}).promise;
 assert.ok(pdfDoc.numPages>=1);
 const page=await pdfDoc.getPage(1);
 const content=await page.getTextContent();
 const docText=content.items.map(i=>"str" in i?i.str:"").join(" ");
 assert.ok(docText.includes("ใบแจ้งหนี้"),docText);
 assert.ok(docText.includes("API Property A"),docText);
 assert.ok(docText.includes("S101"),docText);
 assert.ok(docText.includes("Sample Only"),docText);
 assert.ok(docText.includes("4,130.00"),docText);
 assert.ok(docText.includes("ไม่ใช่ใบเสร็จรับเงิน"),docText);
 const tenantPdf=await raw(tenantPdfPath,tenantTokenA);
 assert.equal(tenantPdf.status,200);
 assert.equal((await raw(tenantPdfPath,tenantTokenB)).status,404);
 assert.equal((await raw(tenantPdfPath,"not-a-valid-session")).status,401);
 assert.equal((await raw("/v1/properties/"+pb.id+"/invoices/"+issue.body.invoice.id+"/billing-notice.pdf",token)).status,403);
 // Mutate current labels after issuance: the immutable snapshot must NOT change.
 const originalSnapshot=(await db.select().from(invoices).where(eq(invoices.id,issue.body.invoice.id)))[0].documentSnapshot;
 assert.ok(originalSnapshot,"new invoices must capture document snapshot on issuance");
 await db.update(properties).set({name:"Changed Property Name"}).where(eq(properties.id,pa.id));
 await db.update(rooms).set({number:"CHANGED-ROOM"}).where(eq(rooms.id,room.id));
 await db.update(leases).set({tenantName:"Changed Tenant"}).where(eq(leases.id,lease.id));
 const changedPdf=await raw(pdfPath,token);assert.equal(changedPdf.status,200);
 const changedDoc=await getDocument({data:new Uint8Array(await changedPdf.arrayBuffer()),useSystemFonts:false}).promise;
 const changedText=(await (await changedDoc.getPage(1)).getTextContent()).items.map(i=>"str"in i?i.str:"").join(" ");
 assert.ok(changedText.includes("API Property A"));
 assert.ok(changedText.includes("S101"));
 assert.ok(changedText.includes("Sample Only"));
 assert.ok(!changedText.includes("Changed Property Name"));
 assert.ok(!changedText.includes("CHANGED-ROOM"));
 // Legacy invoices issued before P3-05b still download but show explicit current-record disclaimer.
 await db.update(invoices).set({documentSnapshot:null}).where(eq(invoices.id,issue.body.invoice.id));
 const legacyPdf=await raw(pdfPath,token);assert.equal(legacyPdf.status,200);
 const legacyDoc=await getDocument({data:new Uint8Array(await legacyPdf.arrayBuffer()),useSystemFonts:false}).promise;
 const legacyText=(await (await legacyDoc.getPage(1)).getTextContent()).items.map(i=>"str"in i?i.str:"").join(" ");
 assert.ok(legacyText.includes("ข้อมูลปัจจุบัน"),legacyText);
 assert.ok(legacyText.includes("Changed Property Name"));
 await db.update(invoices).set({documentSnapshot:originalSnapshot}).where(eq(invoices.id,issue.body.invoice.id));
 console.log("PASS PDF HTTP: scoped owner/tenant 200, outsider 404, unauthenticated 401, cross-org 403; immutable issued labels and explicit legacy warning");





}
try{await main();}
finally{
 child.kill("SIGTERM");
 const savedClaims=ids.claims.length?await db.select({id:paymentClaims.id,evidenceKey:paymentClaims.evidenceKey}).from(paymentClaims):[];
 for(const claim of savedClaims.filter(r=>ids.claims.includes(r.id))) await deletePrivateEvidence(claim.evidenceKey);
 for(const id of ids.claims)await db.delete(paymentLedger).where(eq(paymentLedger.claimId,id));
 for(const id of ids.claims)await db.delete(paymentClaims).where(eq(paymentClaims.id,id));
 for(const id of ids.props)await db.delete(paymentInstructions).where(eq(paymentInstructions.propertyId,id));
 for(const id of ids.invoices)await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId,id));
 for(const id of ids.invoices)await db.delete(invoices).where(eq(invoices.id,id));
 for(const id of ids.readings)await db.delete(meterReadings).where(eq(meterReadings.id,id));
 for(const id of ids.leases)await db.delete(leaseInvitations).where(eq(leaseInvitations.leaseId,id));
 for(const id of ids.leases)await db.delete(leases).where(eq(leases.id,id));
 for(const id of ids.rooms)await db.delete(meterReplacements).where(eq(meterReplacements.roomId,id));
 for(const id of ids.rooms)await db.delete(rooms).where(eq(rooms.id,id));
 for(const id of ids.props)await db.delete(properties).where(eq(properties.id,id));
 for(const id of ids.orgs)await db.delete(memberships).where(eq(memberships.organizationId,id));
 for(const id of ids.orgs)await db.delete(organizations).where(eq(organizations.id,id));
 for(const id of ids.sessions)await db.delete(sessions).where(eq(sessions.id,id));
 for(const id of ids.users)await db.delete(auditLogs).where(eq(auditLogs.actorId,id));
 for(const id of ids.users)await db.delete(users).where(eq(users.id,id));
 await sqlClient.end();
}
