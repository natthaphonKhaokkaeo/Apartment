import type {FastifyInstance,FastifyRequest} from "fastify";
import multipart from "@fastify/multipart";
import {and,eq,desc,sql} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {auditLogs,invoices,leases,organizations,paymentClaims,paymentInstructions,paymentLedger,properties,users,memberships} from "../db/schema.js";
import {AppError,requireActor,requireProperty,type Actor} from "../security.js";
import {assertApprovalAllowed,maskBankAccount,normalizePaymentReference,remainingSatang,PaymentInvariantError} from "../services/payment-rules.js";
import {isValidPromptPayId} from "../services/promptpay.js";
import {savePrivateEvidence,loadPrivateEvidence,deletePrivateEvidence} from "../services/evidence.js";

const uuid=z.uuid(),satang=z.number().int().positive().max(2147483647);
const propParam=z.object({propertyId:uuid});
const claimParam=propParam.extend({claimId:uuid});
const invoiceParam=z.object({invoiceId:uuid});
const bankInput=z.object({
 bankName:z.string().trim().min(2).max(120),
 accountName:z.string().trim().min(3).max(160),
 accountNumber:z.string().trim().regex(/^\d{8,20}$/),
 promptPayId:z.string().trim().refine(isValidPromptPayId,"INVALID_PROMPTPAY_ID").nullable().default(null),
 active:z.boolean().default(true),
 expectedVersion:z.number().int().positive().nullable()
});
const claimFields=z.object({
 amountSatang:z.coerce.number().int().positive().max(2147483647),
 paidAt:z.coerce.date(),
 transferReference:z.string().trim().max(80).optional()
});
type Bill=typeof invoices.$inferSelect;
async function propertyOwner(actor:Actor,propertyId:string){
 const p=await requireProperty(actor,propertyId,true);
 if(actor.role==="SUPER_ADMIN")return p;
 const [member]=await db.select().from(memberships)
  .where(and(eq(memberships.organizationId,p.organizationId),eq(memberships.userId,actor.id),
   eq(memberships.status,"ACTIVE"),eq(memberships.role,"OWNER"))).limit(1);
 if(!member)throw new AppError(403,"PAYMENT_OWNER_REQUIRED");
 return p;
}
async function subject(actor:Actor){
 const [u]=await db.select({subject:users.lineSubject}).from(users).where(and(eq(users.id,actor.id),eq(users.status,"ACTIVE"))).limit(1);
 if(!u)throw new AppError(401,"UNAUTHENTICATED");
 return u.subject;
}
export async function tenantBill(actor:Actor,invoiceId:string):Promise<Bill>{
 const sub=await subject(actor);
 const [row]=await db.select({invoice:invoices}).from(invoices)
  .innerJoin(leases,eq(invoices.leaseId,leases.id))
  .innerJoin(organizations,eq(organizations.id,leases.organizationId))
  .innerJoin(properties,eq(properties.id,leases.propertyId))
  .where(and(eq(invoices.id,invoiceId),eq(invoices.status,"ISSUED"),
   eq(leases.tenantLineSubject,sub),eq(leases.status,"ACTIVE"),
   eq(organizations.status,"ACTIVE"),eq(properties.organizationId,leases.organizationId),
   eq(invoices.organizationId,leases.organizationId),eq(invoices.propertyId,leases.propertyId),
   eq(invoices.roomId,leases.roomId))).limit(1);
 if(!row)throw new AppError(404,"INVOICE_NOT_FOUND");
 return row.invoice;
}
export async function approvedSum(invoiceId:string,tx:Pick<typeof db,"select">=db):Promise<number>{
 const rows=await tx.select({amount:paymentLedger.amountSatang}).from(paymentLedger).where(eq(paymentLedger.invoiceId,invoiceId));
 const sum=rows.reduce((n,r)=>n+r.amount,0);
 if(!Number.isSafeInteger(sum))throw new AppError(500,"PAYMENT_LEDGER_OVERFLOW");
 return sum;
}
function overviewFor(invoice:Bill,alreadyApproved:number,pendingCount:number){
 const remaining=remainingSatang(invoice.amountSatang,[alreadyApproved]);
 return {invoiceId:invoice.id,totalSatang:invoice.amountSatang,manuallyApprovedSatang:alreadyApproved,
  outstandingSatang:remaining,pendingClaims:pendingCount,
  settlementState:remaining===0?"FULLY_RECORDED":alreadyApproved>0?"PARTIALLY_RECORDED":"NO_MANUAL_RECORD",
  verification:"MANUAL_REVIEW_ONLY_NO_BANK_API"};
}
async function billOverview(invoice:Bill){
 const [approved,pending]=await Promise.all([
  approvedSum(invoice.id),
  db.select({id:paymentClaims.id}).from(paymentClaims)
   .where(and(eq(paymentClaims.invoiceId,invoice.id),eq(paymentClaims.status,"PENDING")))
 ]);
 return overviewFor(invoice,approved,pending.length);
}
async function findOwnerClaim(propertyId:string,claimId:string){
 const [claim]=await db.select().from(paymentClaims)
  .where(and(eq(paymentClaims.id,claimId),eq(paymentClaims.propertyId,propertyId))).limit(1);
 if(!claim)throw new AppError(404,"PAYMENT_CLAIM_NOT_FOUND");
 return claim;
}
function clientClaim(row:typeof paymentClaims.$inferSelect){
 const {evidenceKey,evidenceSha256,...safe}=row;return safe;
}

export async function registerPaymentRoutes(app:FastifyInstance){
 await app.register(multipart,{limits:{fileSize:4_000_000,files:1,fields:3,parts:4},
  throwFileSizeLimit:true});

 // Explicit owner control for bank details. Change requires matching optimistic version.
 app.get("/v1/properties/:propertyId/payment-instructions",async req=>{
  const actor=await requireActor(req);
  const {propertyId}=propParam.parse(req.params);
  await requireProperty(actor,propertyId);
  const [row]=await db.select().from(paymentInstructions).where(eq(paymentInstructions.propertyId,propertyId)).limit(1);
  return row?{...row,active:row.active==="YES",accountNumberMasked:maskBankAccount(row.accountNumber)}:null;
 });
 app.put("/v1/properties/:propertyId/payment-instructions",async req=>{
  const actor=await requireActor(req),{propertyId}=propParam.parse(req.params);
  const property=await propertyOwner(actor,propertyId);
  const input=bankInput.parse(req.body);
  const result=await db.transaction(async tx=>{
   const [locked]=await tx.select().from(properties).where(eq(properties.id,property.id)).for("update");
   if(!locked)throw new AppError(404,"PROPERTY_NOT_FOUND");
   const [old]=await tx.select().from(paymentInstructions).where(eq(paymentInstructions.propertyId,propertyId)).for("update");
   if((old?.version??null)!==input.expectedVersion)throw new AppError(409,"PAYMENT_SETTINGS_VERSION_CONFLICT");
   const data={bankName:input.bankName,accountName:input.accountName,accountNumber:input.accountNumber,
    promptPayId:input.promptPayId,active:input.active?"YES":"NO",updatedBy:actor.id,updatedAt:new Date()};
   const [row]=old
    ?await tx.update(paymentInstructions).set({...data,version:old.version+1})
       .where(and(eq(paymentInstructions.id,old.id),eq(paymentInstructions.version,old.version))).returning()
    :await tx.insert(paymentInstructions).values({...data,organizationId:property.organizationId,propertyId,version:1}).returning();
   if(!row)throw new AppError(409,"PAYMENT_SETTINGS_VERSION_CONFLICT");
   await tx.insert(auditLogs).values({actorId:actor.id,organizationId:property.organizationId,
    action:"PAYMENT_INSTRUCTIONS_UPDATED",targetId:row.id,
    metadata:{version:row.version,active:row.active,accountMasked:maskBankAccount(row.accountNumber)}});
   return {...row,accountNumberMasked:maskBankAccount(row.accountNumber),active:row.active==="YES"};
  });
  return result;
 });

 app.get("/v1/tenant/invoices/:invoiceId/payment-instructions",async req=>{
  const actor=await requireActor(req),{invoiceId}=invoiceParam.parse(req.params);
  const bill=await tenantBill(actor,invoiceId);
  const [row]=await db.select().from(paymentInstructions)
   .where(and(eq(paymentInstructions.propertyId,bill.propertyId),eq(paymentInstructions.organizationId,bill.organizationId),
    eq(paymentInstructions.active,"YES"))).limit(1);
  if(!row)throw new AppError(404,"PAYMENT_INSTRUCTIONS_UNAVAILABLE");
  return {bankName:row.bankName,accountName:row.accountName,accountNumber:row.accountNumber,
   promptPayId:row.promptPayId,updatedAt:row.updatedAt,version:row.version,
   caution:"VERIFY_RECIPIENT_WITH_PROPERTY_MANAGEMENT"};
 });

 app.get("/v1/tenant/invoices/:invoiceId/payment-summary",async req=>{
  const actor=await requireActor(req),{invoiceId}=invoiceParam.parse(req.params);
  return billOverview(await tenantBill(actor,invoiceId));
 });
 app.get("/v1/properties/:propertyId/invoices/:invoiceId/payment-summary",async req=>{
  const actor=await requireActor(req),{propertyId}=propParam.parse(req.params);
  const property=await requireProperty(actor,propertyId);
  const {invoiceId}=invoiceParam.parse(req.params);
  const [invoice]=await db.select().from(invoices).where(and(eq(invoices.id,invoiceId),
    eq(invoices.propertyId,property.id),eq(invoices.organizationId,property.organizationId))).limit(1);
  if(!invoice)throw new AppError(404,"INVOICE_NOT_FOUND");
  return billOverview(invoice);
 });

 app.post("/v1/tenant/invoices/:invoiceId/payment-claims",{
  config:{rateLimit:{max:6,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req),{invoiceId}=invoiceParam.parse(req.params);
  const bill=await tenantBill(actor,invoiceId);
  const key=req.headers["idempotency-key"];
  if(typeof key!=="string"||key.length<8||key.length>128)throw new AppError(400,"IDEMPOTENCY_KEY_REQUIRED");
  const [sameKey]=await db.select().from(paymentClaims)
   .where(and(eq(paymentClaims.submittedBy,actor.id),eq(paymentClaims.idempotencyKey,key))).limit(1);
  if(sameKey){
   if(sameKey.invoiceId!==bill.id)throw new AppError(409,"IDEMPOTENCY_KEY_REUSED");
   return reply.code(200).send({claim:clientClaim(sameKey),replayed:true});
  }
  const fields:Record<string,string>={};
  let upload:Buffer|undefined,mime:string|undefined;
  for await (const part of req.parts()){
   if(part.type==="file"){
    if(upload)throw new AppError(400,"MULTIPLE_EVIDENCE_FILES");
    mime=part.mimetype;upload=await part.toBuffer();
   }else{
    if(!["amountSatang","paidAt","transferReference"].includes(part.fieldname)||
       typeof part.value!=="string")throw new AppError(400,"INVALID_PAYMENT_FIELD");
    fields[part.fieldname]=part.value;
   }
  }
  if(!upload||!mime)throw new AppError(400,"PAYMENT_EVIDENCE_REQUIRED");
  const input=claimFields.parse(fields);
  const transferReference=input.transferReference?normalizePaymentReference(input.transferReference):null;
  if(input.paidAt.getTime()>Date.now()+300000||
    input.paidAt.getTime()<Date.now()-366*86400000)throw new AppError(422,"INVALID_PAYMENT_DATE");
  if(input.amountSatang>bill.amountSatang)throw new AppError(422,"OVERPAYMENT_NOT_ALLOWED");
  const evidence=await savePrivateEvidence(upload,mime);
  try{
   const result=await db.transaction(async tx=>{
    const [locked]=await tx.select().from(invoices).where(and(eq(invoices.id,bill.id),
      eq(invoices.propertyId,bill.propertyId),eq(invoices.organizationId,bill.organizationId),
      eq(invoices.status,"ISSUED"))).for("update");
    if(!locked)throw new AppError(409,"INVOICE_NOT_ISSUED");
    // Re-check that the claimant still has an approved active lease and org.
    const identity=await subject(actor);
    const [valid]=await tx.select({id:leases.id}).from(leases)
     .innerJoin(organizations,eq(organizations.id,leases.organizationId))
     .where(and(eq(leases.id,bill.leaseId),eq(leases.tenantLineSubject,identity),
      eq(leases.status,"ACTIVE"),eq(organizations.status,"ACTIVE"))).limit(1);
    if(!valid)throw new AppError(404,"INVOICE_NOT_FOUND");
    const [settings]=await tx.select({id:paymentInstructions.id}).from(paymentInstructions)
     .where(and(eq(paymentInstructions.propertyId,bill.propertyId),eq(paymentInstructions.active,"YES"))).limit(1);
    if(!settings)throw new AppError(422,"PAYMENT_INSTRUCTIONS_UNAVAILABLE");
    const previous=await approvedSum(bill.id,tx);
    try{assertApprovalAllowed(bill.amountSatang,previous,input.amountSatang);}
    catch(e){if(e instanceof PaymentInvariantError)throw new AppError(422,e.code);throw e;}
    const [created]=await tx.insert(paymentClaims).values({
     organizationId:bill.organizationId,propertyId:bill.propertyId,invoiceId:bill.id,leaseId:bill.leaseId,
     submittedBy:actor.id,amountSatang:input.amountSatang,paidAt:input.paidAt,
     transferReference,evidenceKey:evidence.key,evidenceSha256:evidence.sha256,idempotencyKey:key
    }).returning();
    await tx.insert(auditLogs).values({actorId:actor.id,organizationId:bill.organizationId,
     action:"PAYMENT_CLAIM_SUBMITTED",targetId:created.id,metadata:{invoiceId:bill.id,amountSatang:created.amountSatang}});
    return created;
   });
   reply.header("cache-control","no-store");
   return reply.code(201).send({claim:clientClaim(result),replayed:false});
  }catch(e){await deletePrivateEvidence(evidence.key);throw e;}
 });

 app.get("/v1/tenant/payment-claims",async req=>{
  const actor=await requireActor(req),identity=await subject(actor);
  const claims=await db.select({claim:paymentClaims}).from(paymentClaims)
   .innerJoin(leases,eq(leases.id,paymentClaims.leaseId))
   .innerJoin(organizations,eq(organizations.id,leases.organizationId))
   .where(and(eq(paymentClaims.submittedBy,actor.id),eq(leases.tenantLineSubject,identity),
    eq(leases.status,"ACTIVE"),eq(organizations.status,"ACTIVE"),
    eq(paymentClaims.organizationId,leases.organizationId)))
   .orderBy(desc(paymentClaims.createdAt)).limit(100);
  return claims.map(r=>clientClaim(r.claim));
 });
 app.get("/v1/properties/:propertyId/payment-claims",async req=>{
  const actor=await requireActor(req),{propertyId}=propParam.parse(req.params);
  const property=await propertyOwner(actor,propertyId);
  const claims=await db.select({claim:paymentClaims,tenantName:leases.tenantName}).from(paymentClaims)
   .innerJoin(leases,eq(leases.id,paymentClaims.leaseId))
   .where(and(eq(paymentClaims.propertyId,property.id),eq(paymentClaims.organizationId,property.organizationId),
     eq(leases.propertyId,property.id)))
   .orderBy(desc(paymentClaims.createdAt)).limit(200);
  return claims.map(r=>({...clientClaim(r.claim),tenantName:r.tenantName}));
 });

 app.post("/v1/properties/:propertyId/payment-claims/:claimId/decision",async req=>{
  const actor=await requireActor(req),{propertyId,claimId}=claimParam.parse(req.params);
  const property=await propertyOwner(actor,propertyId);
  const body=z.discriminatedUnion("action",[
    z.object({action:z.literal("APPROVE")}),
    z.object({action:z.literal("REJECT"),reason:z.string().trim().min(5).max(500)})
  ]).parse(req.body);
  const result=await db.transaction(async tx=>{
   // Lock order: invoice -> claim. Serializes all owner approvals on the same invoice.
   const [candidate]=await tx.select().from(paymentClaims)
    .where(and(eq(paymentClaims.id,claimId),eq(paymentClaims.propertyId,property.id),
     eq(paymentClaims.organizationId,property.organizationId))).limit(1);
   if(!candidate)throw new AppError(404,"PAYMENT_CLAIM_NOT_FOUND");
   const [invoice]=await tx.select().from(invoices).where(and(eq(invoices.id,candidate.invoiceId),
     eq(invoices.propertyId,property.id),eq(invoices.organizationId,property.organizationId))).for("update");
   if(!invoice||invoice.status!=="ISSUED")throw new AppError(409,"INVOICE_NOT_ISSUED");
   const [claim]=await tx.select().from(paymentClaims).where(eq(paymentClaims.id,candidate.id)).for("update");
   if(!claim||claim.status!=="PENDING")throw new AppError(409,"PAYMENT_ALREADY_DECIDED");
   const decidedAt=new Date();
   if(body.action==="APPROVE"){
    const already=await approvedSum(invoice.id,tx);
    try{assertApprovalAllowed(invoice.amountSatang,already,claim.amountSatang);}
    catch(e){if(e instanceof PaymentInvariantError)throw new AppError(422,e.code);throw e;}
    // Reconciliation reference is a tenant assertion; owner must verify outside this application.
    await tx.insert(paymentLedger).values({organizationId:property.organizationId,propertyId:property.id,
     invoiceId:invoice.id,claimId:claim.id,amountSatang:claim.amountSatang,createdBy:actor.id});
   }
   const [updated]=await tx.update(paymentClaims).set({status:body.action==="APPROVE"?"APPROVED":"REJECTED",
    decidedAt,decidedBy:actor.id,rejectionReason:body.action==="REJECT"?body.reason:null})
    .where(and(eq(paymentClaims.id,claim.id),eq(paymentClaims.status,"PENDING"))).returning();
   if(!updated)throw new AppError(409,"PAYMENT_ALREADY_DECIDED");
   await tx.insert(auditLogs).values({actorId:actor.id,organizationId:property.organizationId,
    action:body.action==="APPROVE"?"PAYMENT_MANUALLY_APPROVED":"PAYMENT_REJECTED",targetId:claim.id,
    metadata:{invoiceId:invoice.id,amountSatang:claim.amountSatang,bankVerification:false}});
   const remaining=remainingSatang(invoice.amountSatang,[await approvedSum(invoice.id,tx)]);
   return {claim:clientClaim(updated),outstandingSatang:remaining,bankVerification:"NOT_CONNECTED"};
  });
  return result;
 });

 // Explicit authorization before reading private evidence; no static files or public URLs.
 app.get("/v1/properties/:propertyId/payment-claims/:claimId/evidence",async(req,reply)=>{
  const actor=await requireActor(req),{propertyId,claimId}=claimParam.parse(req.params);
  await propertyOwner(actor,propertyId);
  const claim=await findOwnerClaim(propertyId,claimId);
  reply.header("cache-control","no-store");
  reply.header("content-disposition",'inline; filename="payment-evidence.webp"');
  return reply.type("image/webp").send(await loadPrivateEvidence(claim.evidenceKey));
 });
 app.get("/v1/tenant/payment-claims/:claimId/evidence",async(req,reply)=>{
  const actor=await requireActor(req),{claimId}=z.object({claimId:uuid}).parse(req.params);
  const [claim]=await db.select().from(paymentClaims).where(and(eq(paymentClaims.id,claimId),
    eq(paymentClaims.submittedBy,actor.id))).limit(1);
  if(!claim)throw new AppError(404,"PAYMENT_CLAIM_NOT_FOUND");
  await tenantBill(actor,claim.invoiceId);
  reply.header("cache-control","no-store");
  reply.header("content-disposition",'inline; filename="payment-evidence.webp"');
  return reply.type("image/webp").send(await loadPrivateEvidence(claim.evidenceKey));
 });
}
