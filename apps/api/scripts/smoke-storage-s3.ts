import {createHash,randomUUID} from "node:crypto";
import {createServer} from "node:http";
import {spawn} from "node:child_process";
import {strict as assert} from "node:assert";
import sharp from "sharp";
import {eq} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {users,sessions,organizations,memberships,properties,rooms,leases,invoices,
 paymentClaims,paymentInstructions,evidenceUploads,auditLogs} from "../src/db/schema.js";
import {newSessionToken,tokenHash} from "../src/security.js";

type ObjectEntry={data:Buffer;type:string};
const objects=new Map<string,ObjectEntry>();
const port=59000,apiPort=8088;
const minioLike=createServer(async(req,res)=>{
 const url=new URL(req.url??"/","http://localhost");
 const key=url.pathname;
 if(!key.startsWith("/apartment-e2e/")){res.writeHead(404).end();return;}
 if(req.method==="PUT"){
  // Simulated S3; verifies signed URL structure, NOT AWS IAM cryptographic signature.
  if(url.searchParams.has("X-Amz-Algorithm")&&!url.searchParams.has("X-Amz-Signature")){
   res.writeHead(403).end();return;
  }
  const chunks:Buffer[]=[];let bytes=0;
  for await(const chunk of req){const c=Buffer.from(chunk);bytes+=c.length;if(bytes>4_000_010){res.writeHead(413).end();return;}chunks.push(c);}
  const data=Buffer.concat(chunks);
  objects.set(key,{data,type:String(req.headers["content-type"]||"application/octet-stream")});
  res.setHeader("ETag",'"mock-s3-etag"');
  res.writeHead(200).end();return;
 }
 const object=objects.get(key);
 if(req.method==="DELETE"){objects.delete(key);res.writeHead(204).end();return;}
 if(!object){res.writeHead(404).end();return;}
 res.setHeader("content-length",object.data.length);res.setHeader("content-type",object.type);res.setHeader("etag",'"mock-s3-etag"');
 if(req.method==="HEAD"){res.writeHead(200).end();return;}
 if(req.method==="GET"){res.writeHead(200).end(object.data);return;}
 res.writeHead(405).end();
});
await new Promise<void>((resolve,reject)=>{
 minioLike.once("error",reject);minioLike.listen(port,"127.0.0.1",resolve);
});
const tag=randomUUID().slice(0,8);
const child=spawn("node",["--import","tsx","src/index.ts"],{
 cwd:process.cwd(),stdio:"ignore",
 env:{...process.env,EVIDENCE_STORAGE_DRIVER:"s3",
  EVIDENCE_S3_BUCKET:"apartment-e2e",EVIDENCE_S3_REGION:"us-east-1",
  EVIDENCE_S3_ENDPOINT:"http://127.0.0.1:"+port,EVIDENCE_S3_FORCE_PATH_STYLE:"true",
  EVIDENCE_S3_ACCESS_KEY_ID:"mock-test",EVIDENCE_S3_SECRET_ACCESS_KEY:"mock-secret"}
});
const ids={users:[] as string[],sessions:[] as string[],org:"",property:"",room:"",lease:"",invoice:"",claims:[] as string[],uploads:[] as string[]};
let ownerToken="",tenantToken="",outsiderToken="";
async function request(path:string,token:string,options:RequestInit={}){
 const r=await fetch("http://127.0.0.1:"+apiPort+path,{
  ...options,headers:{"content-type":"application/json",cookie:"apartment_session="+token,...options.headers}
 });
 return {status:r.status,body:await r.json() as any};
}
async function main(){
 let started=false;
 for(let i=0;i<50;i++){try{if((await fetch("http://127.0.0.1:"+apiPort+"/readyz")).ok){started=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,150));
 }
 assert.ok(started);
 const [owner,tenant,outsider]=await db.insert(users).values([
  {displayName:"S3 Owner",lineSubject:"s3-owner-"+tag},
  {displayName:"S3 Tenant",lineSubject:"s3-tenant-"+tag},
  {displayName:"S3 Outsider",lineSubject:"s3-outsider-"+tag}
 ]).returning();ids.users.push(owner.id,tenant.id,outsider.id);
 [ownerToken,tenantToken,outsiderToken]=[newSessionToken(),newSessionToken(),newSessionToken()];
 const ss=await db.insert(sessions).values([ownerToken,tenantToken,outsiderToken].map((t,i)=>({
  userId:[owner.id,tenant.id,outsider.id][i],tokenHash:tokenHash(t),expiresAt:new Date(Date.now()+120000)
 }))).returning();ids.sessions.push(...ss.map(x=>x.id));
 const [org]=await db.insert(organizations).values({name:"S3 Test Org "+tag}).returning();ids.org=org.id;
 await db.insert(memberships).values({organizationId:org.id,userId:owner.id,role:"OWNER"});
 const [property]=await db.insert(properties).values({
  organizationId:org.id,name:"S3 Test Property",rentSatang:350000,
  waterSatangPerUnit:250,electricSatangPerUnit:450
 }).returning();ids.property=property.id;
 const [room]=await db.insert(rooms).values({
  organizationId:org.id,propertyId:property.id,number:"S3-01",status:"OCCUPIED"
 }).returning();ids.room=room.id;
 const [lease]=await db.insert(leases).values({
  organizationId:org.id,propertyId:property.id,roomId:room.id,tenantName:"S3 Tenant",
  tenantLineSubject:tenant.lineSubject,startDate:"2026-09-01"
 }).returning();ids.lease=lease.id;
 const [invoice]=await db.insert(invoices).values({
  organizationId:org.id,propertyId:property.id,roomId:room.id,leaseId:lease.id,
  periodStart:"2026-11-01",periodEnd:"2026-12-01",dueDate:"2026-12-07",
  amountSatang:350000,idempotencyKey:"s3-"+tag,issuedBy:owner.id
 }).returning();ids.invoice=invoice.id;
 const bank=await request("/v1/properties/"+property.id+"/payment-instructions",ownerToken,{
  method:"PUT",body:JSON.stringify({bankName:"Test Only Bank",accountName:"Test Only Receiver",
   accountNumber:"1234567890",promptPayId:null,active:true,expectedVersion:null})
 });
 assert.equal(bank.status,200,JSON.stringify(bank.body));
 const path="/v1/tenant/invoices/"+invoice.id;
 assert.deepEqual((await request("/v1/evidence-upload-mode",tenantToken)).body,{mode:"DIRECT_S3"});
 assert.equal((await request("/v1/evidence-upload-mode","not-a-session")).status,401);
 assert.equal((await request("/v1/tenant/invoices/"+invoice.id+"/payment-uploads/initiate",outsiderToken,{
  method:"POST",body:JSON.stringify({contentType:"image/png",size:500,checksumSha256:Buffer.alloc(32,3).toString("base64")})
 })).status,404);
 const orig=await sharp({create:{width:16,height:16,channels:3,background:{r:30,g:140,b:80}}}).png().toBuffer();
 const checksumSha256=createHash("sha256").update(orig).digest("base64");
 const init=await request(path+"/payment-uploads/initiate",tenantToken,{
  method:"POST",body:JSON.stringify({contentType:"image/png",size:orig.length,checksumSha256})
 });
 assert.equal(init.status,201,JSON.stringify(init.body));ids.uploads.push(init.body.uploadId);
 const upload=init.body;
 assert.ok(upload.uploadUrl.includes("X-Amz-Signature="));
 assert.ok(upload.uploadUrl.includes("/quarantine/v1/"));
 assert.equal((await request(path+"/payment-uploads/"+upload.uploadId+"/finalize",outsiderToken,{method:"POST",body:"{}"})).status,404);
 // A signed upload never exposes the final sanitized evidence, and is short-lived.
 const sent=await fetch(upload.uploadUrl,{method:"PUT",headers:upload.headers,body:new Uint8Array(orig)});
 assert.equal(sent.status,200);
 const finalized=await request(path+"/payment-uploads/"+upload.uploadId+"/finalize",tenantToken,{method:"POST",body:"{}"});
 assert.equal(finalized.status,200,JSON.stringify(finalized.body));
 assert.equal(finalized.body.status,"READY");
 assert.equal((await request(path+"/payment-uploads/"+upload.uploadId+"/finalize",tenantToken,{
  method:"POST",body:"{}"
 })).status,409);
 const dbTicket=(await db.select().from(evidenceUploads).where(eq(evidenceUploads.id,upload.uploadId)))[0];
 assert.ok(dbTicket.evidenceKey);
 assert.equal(dbTicket.status,"READY");
 assert.ok(!objects.has("/apartment-e2e/quarantine/v1/"+org.id+"/"+upload.uploadId));
 const stored=objects.get("/apartment-e2e/private/evidence/v1/"+dbTicket.evidenceKey+".webp");
 assert.ok(stored);assert.equal((await sharp(stored.data).metadata()).format,"webp");
 assert.equal((await sharp(stored.data).metadata()).exif,undefined);
 const claimBody={uploadId:upload.uploadId,amountSatang:120000,paidAt:new Date().toISOString(),
  transferReference:"S3-CLAIM-"+tag};
 const idempotency="s3-claim-"+randomUUID();
 const claim=await request(path+"/payment-claims/from-upload",tenantToken,{
  method:"POST",headers:{"idempotency-key":idempotency},body:JSON.stringify(claimBody)
 });
 assert.equal(claim.status,201,JSON.stringify(claim.body));ids.claims.push(claim.body.claim.id);
 assert.equal(claim.body.claim.evidenceKey,undefined);
 const replay=await request(path+"/payment-claims/from-upload",tenantToken,{
  method:"POST",headers:{"idempotency-key":idempotency},body:JSON.stringify(claimBody)
 });
 assert.equal(replay.status,200);
 const cannotReuse=await request(path+"/payment-claims/from-upload",tenantToken,{
  method:"POST",headers:{"idempotency-key":"different-"+randomUUID()},body:JSON.stringify(claimBody)
 });
 assert.equal(cannotReuse.status,409);
 assert.equal((await request(path+"/payment-claims/from-upload",outsiderToken,{
  method:"POST",headers:{"idempotency-key":"out-"+randomUUID()},
  body:JSON.stringify({...claimBody,transferReference:"S3-OTHER-"+tag})
 })).status,404);
 assert.equal((await request("/v1/tenant/payment-claims",outsiderToken)).body.length,0);
 const slip=await fetch("http://127.0.0.1:"+apiPort+"/v1/tenant/payment-claims/"+claim.body.claim.id+"/evidence",{
  headers:{cookie:"apartment_session="+tenantToken}
 });
 assert.equal(slip.status,200);assert.equal(slip.headers.get("content-type"),"image/webp");
 const denied=await fetch("http://127.0.0.1:"+apiPort+"/v1/tenant/payment-claims/"+claim.body.claim.id+"/evidence",{
  headers:{cookie:"apartment_session="+outsiderToken}
 });
 assert.equal(denied.status,404);
 // A bad checksum uploads to quarantine but cannot be finalized.
 const bad=await request(path+"/payment-uploads/initiate",tenantToken,{
  method:"POST",body:JSON.stringify({contentType:"image/png",size:orig.length,
   checksumSha256:Buffer.alloc(32,1).toString("base64")})
 });
 assert.equal(bad.status,201);ids.uploads.push(bad.body.uploadId);
 const badPut=await fetch(bad.body.uploadUrl,{method:"PUT",headers:bad.body.headers,body:new Uint8Array(orig)});
 assert.equal(badPut.status,200);
 const rejected=await request(path+"/payment-uploads/"+bad.body.uploadId+"/finalize",tenantToken,{method:"POST",body:"{}"});
 assert.equal(rejected.status,422,JSON.stringify(rejected.body));
 assert.equal((await db.select().from(evidenceUploads).where(eq(evidenceUploads.id,bad.body.uploadId)))[0].status,"FAILED");
 console.log("PASS signed S3 mock E2E: initiate + presigned PUT + checksum/size + sanitize + quarantine delete + claim + replay + tenant IDOR + bad checksum");
}
try{await main();}
finally{
 child.kill("SIGTERM");
 for(const cid of ids.claims)await db.delete(paymentClaims).where(eq(paymentClaims.id,cid));
 for(const uid of ids.uploads)await db.delete(evidenceUploads).where(eq(evidenceUploads.id,uid));
 if(ids.property)await db.delete(paymentInstructions).where(eq(paymentInstructions.propertyId,ids.property));
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
 await new Promise<void>(r=>minioLike.close(()=>r()));
}
