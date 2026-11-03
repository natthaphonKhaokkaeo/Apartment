import {randomUUID} from "node:crypto";
import {strict as assert} from "node:assert";
import {eq} from "drizzle-orm";
import sharp from "sharp";
import {db,sqlClient} from "../src/db/client.js";
import {users,organizations,properties,rooms,leases,invoices,evidenceUploads,paymentClaims,memberships,auditLogs} from "../src/db/schema.js";
import {sweepOrphanEvidence,type CleanupStorage} from "../src/services/evidence-cleanup.js";
import {savePrivateEvidence,loadPrivateEvidence,deletePrivateEvidence} from "../src/services/evidence.js";
const tag=randomUUID().slice(0,8);
const ids={user:"",org:"",property:"",room:"",lease:"",invoice:"",uploads:[] as string[],claims:[] as string[],files:[] as string[]};
const old=new Date(Date.now()-3*86400000),recent=new Date(Date.now()-10*60000);
try{
 const [user]=await db.insert(users).values({lineSubject:"cleanup-"+tag,displayName:"Cleanup Fixture"}).returning();ids.user=user.id;
 const [org]=await db.insert(organizations).values({name:"Cleanup Fixture "+tag}).returning();ids.org=org.id;
 await db.insert(memberships).values({organizationId:org.id,userId:user.id,role:"OWNER"});
 const [property]=await db.insert(properties).values({name:"Test Property",organizationId:org.id,rentSatang:400000,waterSatangPerUnit:100,electricSatangPerUnit:100}).returning();ids.property=property.id;
 const [room]=await db.insert(rooms).values({organizationId:org.id,propertyId:property.id,number:"C101",status:"OCCUPIED"}).returning();ids.room=room.id;
 const [lease]=await db.insert(leases).values({organizationId:org.id,propertyId:property.id,roomId:room.id,tenantName:"Test Tenant",startDate:"2026-10-01"}).returning();ids.lease=lease.id;
 const [invoice]=await db.insert(invoices).values({organizationId:org.id,propertyId:property.id,roomId:room.id,leaseId:lease.id,periodStart:"2026-10-01",periodEnd:"2026-11-01",dueDate:"2026-11-05",amountSatang:400000,idempotencyKey:"cleanup-"+tag,issuedBy:user.id}).returning();ids.invoice=invoice.id;
 const png=await sharp({create:{width:4,height:4,channels:3,background:{r:10,g:20,b:30}}}).png().toBuffer();
 const files=await Promise.all(Array.from({length:3},()=>savePrivateEvidence(png,"image/png")));
 ids.files.push(...files.map(f=>f.key));
 const common={organizationId:org.id,propertyId:property.id,invoiceId:invoice.id,submittedBy:user.id,
  contentType:"image/png",contentLength:png.length,checksumSha256:"A".repeat(43)+"=",expiresAt:old};
 const uploadData=[
  {...common,id:randomUUID(),status:"INITIATED" as const},
  {...common,id:randomUUID(),status:"READY" as const,processedAt:old,evidenceKey:files[0].key,evidenceSha256:files[0].sha256},
  {...common,id:randomUUID(),status:"READY" as const,processedAt:old,evidenceKey:files[1].key,evidenceSha256:files[1].sha256,legalHold:true},
  {...common,id:randomUUID(),status:"CLAIMED" as const,processedAt:old,evidenceKey:files[2].key,evidenceSha256:files[2].sha256,claimedAt:old},
  {...common,id:randomUUID(),status:"INITIATED" as const,expiresAt:recent}
 ];
 const uploads=await db.insert(evidenceUploads).values(uploadData).returning();ids.uploads.push(...uploads.map(u=>u.id));
 const [claim]=await db.insert(paymentClaims).values({organizationId:org.id,propertyId:property.id,invoiceId:invoice.id,
  leaseId:lease.id,submittedBy:user.id,amountSatang:1000,paidAt:old,transferReference:"CLEAN-"+tag,
  evidenceKey:files[2].key,evidenceSha256:files[2].sha256,idempotencyKey:"cleanup-claim-"+tag}).returning();ids.claims.push(claim.id);
 // Simulate an inconsistent legacy ticket flagged READY while a claim still references it.
 // Reference protection must take precedence even over an expired READY timestamp.
 await db.update(evidenceUploads).set({status:"READY"}).where(eq(evidenceUploads.id,uploads[3].id));
 const protectedDry=await sweepOrphanEvidence({organizationId:org.id});
 assert.equal(protectedDry.protected,1);
 assert.equal(protectedDry.eligible,2);
 await db.update(evidenceUploads).set({status:"CLAIMED"}).where(eq(evidenceUploads.id,uploads[3].id));
 const dry=await sweepOrphanEvidence({organizationId:org.id});
 assert.equal(dry.mode,"DRY_RUN");assert.equal(dry.eligible,2);
 const untouched=await db.select().from(evidenceUploads).where(eq(evidenceUploads.id,uploads[1].id));
 assert.equal(untouched[0].status,"READY");
 let failOnce=true;
 const storage:CleanupStorage={
  deleteQuarantine:async(_,uploadId)=>{if(uploadId===uploads[1].id&&failOnce){failOnce=false;throw Error("temporary unavailable");}},
  deleteEvidence:deletePrivateEvidence
 };
 const first=await sweepOrphanEvidence({organizationId:org.id,apply:true,storage});
 assert.equal(first.eligible,2);assert.equal(first.cleaned,1);assert.equal(first.failed,1);
 const afterFailure=(await db.select().from(evidenceUploads).where(eq(evidenceUploads.id,uploads[1].id)))[0];
 assert.equal(afterFailure.status,"EXPIRED");assert.equal(afterFailure.cleanedAt,null);
 assert.equal((await loadPrivateEvidence(files[0].key)).subarray(0,4).toString(),"RIFF");
 const retry=await sweepOrphanEvidence({organizationId:org.id,apply:true,storage});
 assert.equal(retry.cleaned,1);
 assert.equal(retry.failed,0);
 await assert.rejects(()=>loadPrivateEvidence(files[0].key),{code:"EVIDENCE_NOT_FOUND"});
 // A held or linked payment evidence file must survive cleanup and retain its metadata.
 assert.ok((await loadPrivateEvidence(files[1].key)).length>0);
 assert.ok((await loadPrivateEvidence(files[2].key)).length>0);
 const remaining=await db.select().from(evidenceUploads).where(eq(evidenceUploads.organizationId,org.id));
 assert.equal(remaining.find(x=>x.id===uploads[2].id)?.status,"READY");
 assert.equal(remaining.find(x=>x.id===uploads[3].id)?.status,"CLAIMED");
 assert.equal(remaining.find(x=>x.id===uploads[4].id)?.status,"INITIATED");
 assert.equal(remaining.find(x=>x.id===uploads[1].id)?.cleanedAt instanceof Date,true);
 console.log("PASS evidence cleanup PostgreSQL: dry-run default, abandoned quarantine, expired READY, retryable failure, legal hold and linked payment protected, young ticket unaffected");
}finally{
 for(const id of ids.claims)await db.delete(paymentClaims).where(eq(paymentClaims.id,id));
 for(const id of ids.uploads)await db.delete(evidenceUploads).where(eq(evidenceUploads.id,id));
 if(ids.invoice)await db.delete(invoices).where(eq(invoices.id,ids.invoice));
 if(ids.lease)await db.delete(leases).where(eq(leases.id,ids.lease));
 if(ids.room)await db.delete(rooms).where(eq(rooms.id,ids.room));
 if(ids.property)await db.delete(properties).where(eq(properties.id,ids.property));
 if(ids.org)await db.delete(memberships).where(eq(memberships.organizationId,ids.org));
 if(ids.user)await db.delete(auditLogs).where(eq(auditLogs.actorId,ids.user));
 if(ids.org)await db.delete(organizations).where(eq(organizations.id,ids.org));
 if(ids.user)await db.delete(users).where(eq(users.id,ids.user));
 for(const key of ids.files)await deletePrivateEvidence(key);
 await sqlClient.end();
}
