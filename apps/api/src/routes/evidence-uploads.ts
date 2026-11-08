import type {FastifyInstance} from "fastify";
import {and,eq,gt} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {z} from "zod";
import {config} from "../config.js";
import {db} from "../db/client.js";
import {
 auditLogs,evidenceUploads,invoices,leases,organizations,paymentClaims,paymentInstructions,
 properties,users
} from "../db/schema.js";
import {AppError,requireActor} from "../security.js";
import {tenantBill,approvedSum} from "./payments.js";
import {
 presignQuarantinePut,readQuarantinedUpload,deleteQuarantineObject,validateUploadProposal
} from "../services/evidence-s3.js";
import {sanitizeEvidence,storeSanitizedEvidence,deletePrivateEvidence} from "../services/evidence.js";
import {assertApprovalAllowed,normalizePaymentReference,PaymentInvariantError} from "../services/payment-rules.js";

const uuid=z.uuid();
const invoiceParams=z.object({invoiceId:uuid});
const uploadParams=invoiceParams.extend({uploadId:uuid});
const propose=z.object({
 contentType:z.enum(["image/jpeg","image/png","image/webp"]),
 size:z.number().int().min(1).max(4_000_000),
 checksumSha256:z.string().min(44).max(44)
});
const claimRequest=z.object({
 uploadId:uuid,
 amountSatang:z.number().int().min(1).max(2147483647),
 paidAt:z.iso.datetime({offset:true}),
 transferReference:z.string().trim().max(80).optional()
});
const TTL_MS=300000;

function requireS3(){
 if(config.EVIDENCE_STORAGE_DRIVER!=="s3")throw new AppError(409,"SIGNED_UPLOAD_NOT_AVAILABLE");
}
function safeClaim(row:typeof paymentClaims.$inferSelect){
 const {evidenceKey: _evidenceKey,evidenceSha256: _evidenceSha256,...publicClaim}=row;
 return publicClaim;
}
export async function registerEvidenceUploadRoutes(app:FastifyInstance){
 app.get("/v1/evidence-upload-mode",async req=>{
  await requireActor(req);
  return {mode:config.EVIDENCE_STORAGE_DRIVER==="s3"?"DIRECT_S3":"SERVER_MULTIPART"};
 });

 app.post("/v1/tenant/invoices/:invoiceId/payment-uploads/initiate",{
  config:{rateLimit:{max:5,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  requireS3();
  const actor=await requireActor(req),{invoiceId}=invoiceParams.parse(req.params);
  const bill=await tenantBill(actor,invoiceId);
  const input=validateUploadProposal(propose.parse(req.body));
  const [settings]=await db.select({id:paymentInstructions.id}).from(paymentInstructions)
   .where(and(eq(paymentInstructions.propertyId,bill.propertyId),
    eq(paymentInstructions.organizationId,bill.organizationId),eq(paymentInstructions.active,"YES"))).limit(1);
  if(!settings)throw new AppError(422,"PAYMENT_INSTRUCTIONS_UNAVAILABLE");
  const remaining=bill.amountSatang-(await approvedSum(bill.id));
  if(remaining<=0)throw new AppError(422,"INVOICE_FULLY_RECORDED");
  const id=randomUUID(),expiresAt=new Date(Date.now()+TTL_MS);
  const signed=await presignQuarantinePut({
   orgId:bill.organizationId,uploadId:id,contentType:input.contentType,
   size:input.size,checksumSha256:input.checksumSha256
  });
  // Re-check under invoice row lock: an owner may void/reissue while S3 signing is running.
  await db.transaction(async tx=>{
   const [current]=await tx.select({id:invoices.id}).from(invoices).where(and(
    eq(invoices.id,bill.id),eq(invoices.organizationId,bill.organizationId),
    eq(invoices.propertyId,bill.propertyId),eq(invoices.status,"ISSUED"))).for("update");
   if(!current)throw new AppError(409,"INVOICE_NOT_ISSUED");
   await tx.insert(evidenceUploads).values({
    id,organizationId:bill.organizationId,propertyId:bill.propertyId,invoiceId:bill.id,
    submittedBy:actor.id,contentType:input.contentType,contentLength:input.size,
    checksumSha256:input.checksumSha256,expiresAt
   });
  });
  reply.header("cache-control","no-store");
  return reply.code(201).send({
   uploadId:id,uploadUrl:signed.url,method:signed.method,
   headers:signed.headers,expiresAt,expiresInSeconds:300,
   note:"Quarantine only; finalize before attaching to a payment claim"
  });
 });

 app.post("/v1/tenant/invoices/:invoiceId/payment-uploads/:uploadId/finalize",{
  config:{rateLimit:{max:8,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  requireS3();
  const actor=await requireActor(req),{invoiceId,uploadId}=uploadParams.parse(req.params);
  const bill=await tenantBill(actor,invoiceId);
  // Atomic state change prevents concurrent double-processing of the same ticket.
  const [ticket]=await db.update(evidenceUploads).set({status:"PROCESSING"})
   .where(and(eq(evidenceUploads.id,uploadId),eq(evidenceUploads.invoiceId,bill.id),
    eq(evidenceUploads.organizationId,bill.organizationId),eq(evidenceUploads.submittedBy,actor.id),
    eq(evidenceUploads.status,"INITIATED"),gt(evidenceUploads.expiresAt,new Date()))).returning();
  if(!ticket)throw new AppError(409,"UPLOAD_NOT_FINALIZABLE");
  let saved:{key:string;sha256:string;size:number}|undefined;
  try{
   const raw=await readQuarantinedUpload({
    orgId:ticket.organizationId,uploadId:ticket.id,contentType:ticket.contentType,
    size:ticket.contentLength,checksumSha256:ticket.checksumSha256
   });
   saved=await storeSanitizedEvidence(await sanitizeEvidence(raw,ticket.contentType));
   const [ready]=await db.update(evidenceUploads).set({
    status:"READY",evidenceKey:saved.key,evidenceSha256:saved.sha256,processedAt:new Date()
   }).where(and(eq(evidenceUploads.id,ticket.id),eq(evidenceUploads.status,"PROCESSING"))).returning({id:evidenceUploads.id});
   if(!ready)throw new AppError(409,"UPLOAD_NOT_FINALIZABLE");
   // Deleting the untrusted raw object is best effort; provider lifecycle must also expire quarantine/v1.
   try{await deleteQuarantineObject(ticket.organizationId,ticket.id);}
   catch{req.log.warn({uploadId:ticket.id},"quarantine cleanup deferred to storage lifecycle");}
   reply.header("cache-control","no-store");
   return {uploadId:ticket.id,status:"READY",expiresAt:ticket.expiresAt};
  }catch(error){
   if(saved)try{await deletePrivateEvidence(saved.key);}catch{req.log.error({uploadId:ticket.id},"orphan evidence cleanup required");}
   // Missing raw upload is retryable while the URL is valid; corrupted/mismatched upload is terminal.
   const retryable=error instanceof AppError && error.code==="QUARANTINE_OBJECT_NOT_FOUND";
   await db.update(evidenceUploads).set({status:retryable?"INITIATED":"FAILED"})
    .where(and(eq(evidenceUploads.id,ticket.id),eq(evidenceUploads.status,"PROCESSING")));
   throw error;
  }
 });

 app.post("/v1/tenant/invoices/:invoiceId/payment-claims/from-upload",{
  config:{rateLimit:{max:10,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  requireS3();
  const actor=await requireActor(req),{invoiceId}=invoiceParams.parse(req.params);
  const bill=await tenantBill(actor,invoiceId);
  const key=req.headers["idempotency-key"];
  if(typeof key!=="string"||key.length<8||key.length>128)throw new AppError(400,"IDEMPOTENCY_KEY_REQUIRED");
  const input=claimRequest.parse(req.body);
  const paidAt=new Date(input.paidAt);
  if(paidAt.getTime()>Date.now()+300000||paidAt.getTime()<Date.now()-366*86400000)
   throw new AppError(422,"INVALID_PAYMENT_DATE");
  const transferReference=input.transferReference
   ?normalizePaymentReference(input.transferReference):null;
  const [replay]=await db.select().from(paymentClaims)
   .where(and(eq(paymentClaims.submittedBy,actor.id),eq(paymentClaims.idempotencyKey,key))).limit(1);
  if(replay){
   if(replay.invoiceId!==bill.id||replay.amountSatang!==input.amountSatang||
     replay.transferReference!==transferReference)
    throw new AppError(409,"IDEMPOTENCY_KEY_REUSED");
   return reply.code(200).send({claim:safeClaim(replay),replayed:true});
  }
  const claim=await db.transaction(async tx=>{
   const [locked]=await tx.select().from(invoices).where(and(eq(invoices.id,bill.id),
    eq(invoices.propertyId,bill.propertyId),eq(invoices.organizationId,bill.organizationId),
    eq(invoices.status,"ISSUED"))).for("update");
   if(!locked)throw new AppError(409,"INVOICE_NOT_ISSUED");
   if(!bill.leaseId)throw new AppError(404,"INVOICE_NOT_FOUND");
   const [activeLease]=await tx.select({id:leases.id}).from(leases)
    .innerJoin(organizations,eq(organizations.id,leases.organizationId))
    .innerJoin(properties,eq(properties.id,leases.propertyId))
    .innerJoin(users,eq(users.lineSubject,leases.tenantLineSubject))
    .where(and(eq(leases.id,bill.leaseId),eq(leases.tenantLineSubject,users.lineSubject),
     eq(users.id,actor.id),eq(users.status,"ACTIVE"),eq(leases.status,"ACTIVE"),
     eq(organizations.status,"ACTIVE"),eq(properties.organizationId,bill.organizationId))).limit(1);
   if(!activeLease)throw new AppError(404,"INVOICE_NOT_FOUND");
   const [settings]=await tx.select({id:paymentInstructions.id}).from(paymentInstructions)
    .where(and(eq(paymentInstructions.propertyId,bill.propertyId),
     eq(paymentInstructions.organizationId,bill.organizationId),
     eq(paymentInstructions.active,"YES"))).limit(1);
   if(!settings)throw new AppError(422,"PAYMENT_INSTRUCTIONS_UNAVAILABLE");
   const approved=await approvedSum(bill.id,tx);
   try{assertApprovalAllowed(bill.amountSatang,approved,input.amountSatang);}
   catch(err){if(err instanceof PaymentInvariantError)throw new AppError(422,err.code);throw err;}
   // Lock ticket after invoice; READY ticket may be claimed only once.
   const [ticket]=await tx.select().from(evidenceUploads).where(and(
    eq(evidenceUploads.id,input.uploadId),eq(evidenceUploads.invoiceId,bill.id),
    eq(evidenceUploads.submittedBy,actor.id),eq(evidenceUploads.organizationId,bill.organizationId)
   )).for("update");
   if(!ticket||ticket.status!=="READY"||!ticket.evidenceKey||!ticket.evidenceSha256||
       !ticket.processedAt||ticket.processedAt.getTime()+86400000<Date.now())
    throw new AppError(409,"UPLOAD_NOT_READY");
   const [created]=await tx.insert(paymentClaims).values({
    organizationId:bill.organizationId,propertyId:bill.propertyId,invoiceId:bill.id,
    leaseId:bill.leaseId,submittedBy:actor.id,amountSatang:input.amountSatang,
    paidAt,transferReference,evidenceKey:ticket.evidenceKey,
    evidenceSha256:ticket.evidenceSha256,idempotencyKey:key
   }).returning();
   const [updated]=await tx.update(evidenceUploads).set({status:"CLAIMED",claimedAt:new Date()})
    .where(and(eq(evidenceUploads.id,ticket.id),eq(evidenceUploads.status,"READY"))).returning({id:evidenceUploads.id});
   if(!updated)throw new AppError(409,"UPLOAD_ALREADY_CLAIMED");
   await tx.insert(auditLogs).values({actorId:actor.id,organizationId:bill.organizationId,
    action:"PAYMENT_S3_CLAIM_SUBMITTED",targetId:created.id,
    metadata:{invoiceId:bill.id,uploadId:ticket.id,amountSatang:created.amountSatang}});
   return created;
  });
  reply.header("cache-control","no-store");
  return reply.code(201).send({claim:safeClaim(claim),replayed:false});
 });
}
