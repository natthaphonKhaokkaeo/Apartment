import {spawn} from "node:child_process";
import {randomUUID,createHash} from "node:crypto";
import {strict as assert} from "node:assert";
import sharp from "sharp";
import {eq} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {users,sessions,organizations,memberships,properties,rooms,meterReadings,propertyStaffGrants,meterReadingEvidence} from "../src/db/schema.js";
import {newSessionToken,tokenHash} from "../src/security.js";
if(!process.env.APARTMENT_COVERAGE_ROOT||!process.env.DATABASE_URL?.includes("isolated_coverage_only@127.0.0.1:"))throw Error("DISPOSABLE_DATABASE_REQUIRED");
const child=spawn("node",["--import","tsx","src/index.ts"],{cwd:process.cwd(),env:process.env,stdio:"ignore"});
const base="http://127.0.0.1:8088",tag=randomUUID();
async function request(path:string,token:string,method="GET",body?:unknown,key?:string){
 const r=await fetch(base+path,{method,headers:{cookie:"apartment_session="+token,...(body===undefined?{}:{"content-type":"application/json"}),...(key?{"idempotency-key":key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json() as any};
}
async function upload(path:string,token:string,bytes:Uint8Array,mime="image/png",key="photo-"+tag){
 const form=new FormData();form.set("photo",new Blob([new Uint8Array(bytes)],{type:mime}),"untrusted-file.png");
 const r=await fetch(base+path,{method:"POST",headers:{cookie:"apartment_session="+token,"idempotency-key":key},body:form});
 return {status:r.status,body:await r.json() as any};
}
try{
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+"/readyz")).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 const [owner,meter,viewer,foreign]=await db.insert(users).values(["owner","meter","viewer","foreign"].map(x=>({lineSubject:"meter-proof-"+tag+x,displayName:x}))).returning();
 const tokens:string[]=[];for(const u of [owner,meter,viewer,foreign]){const token=newSessionToken();await db.insert(sessions).values({userId:u.id,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+300000)});tokens.push(token);}
 const [org]=await db.insert(organizations).values({name:"Meter evidence "+tag}).returning();
 await db.insert(memberships).values([{organizationId:org.id,userId:owner.id,role:"OWNER"},{organizationId:org.id,userId:meter.id,role:"STAFF"},{organizationId:org.id,userId:viewer.id,role:"STAFF"}]);
 const [p]=await db.insert(properties).values({organizationId:org.id,name:"Photo scope",rentSatang:100,waterSatangPerUnit:100,electricSatangPerUnit:100}).returning();
 await db.insert(propertyStaffGrants).values([{organizationId:org.id,propertyId:p.id,userId:meter.id,level:"METER_READER",updatedBy:owner.id},{organizationId:org.id,propertyId:p.id,userId:viewer.id,level:"VIEWER",updatedBy:owner.id}]);
 const [room]=await db.insert(rooms).values({organizationId:org.id,propertyId:p.id,number:"M101"}).returning();
 const readings=await db.insert(meterReadings).values([{organizationId:org.id,propertyId:p.id,roomId:room.id,kind:"WATER",readAt:"2026-11-01",value:"0.000",createdBy:owner.id},{organizationId:org.id,propertyId:p.id,roomId:room.id,kind:"WATER",readAt:"2026-11-02",value:"100.000",createdBy:owner.id}]).returning();
 const reading=readings[1],path="/v1/properties/"+p.id+"/rooms/"+room.id+"/meter-records";
 assert.equal((await request(path+"?kind=WATER",tokens[0])).status,200);
 const photo=await sharp({create:{width:16,height:16,channels:3,background:"#ff8800"}}).png().toBuffer();
 const upath=path+"/"+reading.id+"/photos";
 assert.equal((await upload(upath,tokens[2],photo)).status,403);
 assert.equal((await upload(upath,tokens[3],photo)).status,403);
 const uploads=await Promise.all(Array.from({length:3},()=>upload(upath,tokens[1],photo)));
 assert.deepEqual(uploads.map(x=>x.status).sort(),[200,200,201]);
 const stored=uploads[0].body.photo;assert.equal(stored.scanVerdict,"NOT_SCANNED_DEV");assert.equal(stored.evidenceKey,undefined);
 assert.equal((await db.select().from(meterReadingEvidence).where(eq(meterReadingEvidence.readingId,reading.id))).length,1);
 const content=await fetch(base+upath+"/"+stored.id+"/content",{headers:{cookie:"apartment_session="+tokens[2]}});
 assert.equal(content.status,200);assert.ok(content.headers.get("content-type")?.startsWith("image/webp"));assert.equal(content.headers.get("cache-control"),"no-store");
 const bytes=Buffer.from(await content.arrayBuffer());assert.equal(createHash("sha256").update(bytes).digest("hex"),stored.sha256);
 assert.equal((await sharp(bytes).metadata()).format,"webp");
 assert.equal((await fetch(base+upath+"/"+stored.id+"/content",{headers:{cookie:"apartment_session="+tokens[3]}})).status,403);
 const other=await sharp({create:{width:16,height:16,channels:3,background:"#0088ff"}}).png().toBuffer();
 assert.equal((await upload(upath,tokens[1],other)).status,409);
 assert.equal((await upload(upath,tokens[1],Buffer.from("not-image"),"text/plain","invalid-"+tag)).status,415);
 assert.equal((await upload(upath,tokens[1],photo,"image/jpeg","mime-"+tag)).status,422);
 assert.equal((await upload(upath,tokens[1],Buffer.alloc(4194305),"image/png","large-"+tag)).status,413);
 const input={action:"REQUIRES_CORRECTION",maxDailyMilli:1000,reason:"Owner reviewed synthetic unusually high reading"};
 assert.equal((await request(path+"/"+reading.id+"/reviews",tokens[1],"POST",input,"review-"+tag)).status,403);
 const review=await request(path+"/"+reading.id+"/reviews",tokens[0],"POST",input,"review-"+tag);assert.equal(review.status,201);assert.equal(review.body.review.assessment.kind,"USAGE_SPIKE");
 assert.equal((await request(path+"/"+reading.id+"/reviews",tokens[0],"POST",input,"review-"+tag)).status,200);
 assert.equal((await request(path+"/"+reading.id+"/reviews",tokens[0],"POST",{...input,maxDailyMilli:2000},"review-"+tag)).status,409);
 assert.equal((await db.select().from(meterReadings).where(eq(meterReadings.id,reading.id)))[0].value,"100.000");
 const list=await request(path+"?kind=WATER",tokens[2]);assert.equal(list.status,200);assert.equal(list.body.readings[0].photos.length,1);assert.equal(list.body.readings[0].reviews[0].action,"REQUIRES_CORRECTION");
 assert.equal((await request(path.replace(room.id,randomUUID())+"?kind=WATER",tokens[0])).status,404);
 await db.update(propertyStaffGrants).set({status:"DISABLED"}).where(eq(propertyStaffGrants.userId,meter.id));
 assert.equal((await request(path+"?kind=WATER",tokens[1])).status,403);
 console.log("PASS meter proof: private sanitized WebP, staff grant authorization, replay/different payload, MIME/size bounds, no key leak, owner-only persisted anomaly assessment, unchanged readings, IDOR and revoke denial");
}finally{child.kill("SIGTERM");await new Promise(r=>setTimeout(r,200));await sqlClient.end();}
