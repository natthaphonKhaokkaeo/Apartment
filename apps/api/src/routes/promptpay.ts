import type {FastifyInstance, FastifyReply} from "fastify";
import {and,eq} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {invoices,paymentInstructions,paymentClaims} from "../db/schema.js";
import {AppError,requireActor,requireProperty} from "../security.js";
import {tenantBill,approvedSum} from "./payments.js";
import {buildPromptPayPayload,isValidPromptPayId,maskPromptPayId} from "../services/promptpay.js";

const uuid=z.uuid();
const tenantParams=z.object({invoiceId:uuid});
const ownerParams=tenantParams.extend({propertyId:uuid});
async function forInvoice(bill:typeof invoices.$inferSelect,reply:FastifyReply){
 if(bill.status!=="ISSUED")throw new AppError(409,"INVOICE_NOT_ISSUED");
 const [settings]=await db.select({
  accountName:paymentInstructions.accountName,promptPayId:paymentInstructions.promptPayId,
  active:paymentInstructions.active,version:paymentInstructions.version
 }).from(paymentInstructions).where(and(
  eq(paymentInstructions.propertyId,bill.propertyId),
  eq(paymentInstructions.organizationId,bill.organizationId),
  eq(paymentInstructions.active,"YES")
 )).limit(1);
 // Never encode bank account number as a PromptPay ID; tag 29.04 requires a bank code.
 if(!settings?.promptPayId)throw new AppError(404,"PROMPTPAY_NOT_CONFIGURED");
 if(!isValidPromptPayId(settings.promptPayId))
  throw new AppError(422,"PROMPTPAY_IDENTIFIER_INVALID");
 // Do not encourage duplicate transfers while earlier slip claims await manual review.
 const [pending]=await db.select({id:paymentClaims.id}).from(paymentClaims)
  .where(and(eq(paymentClaims.invoiceId,bill.id),eq(paymentClaims.organizationId,bill.organizationId),
    eq(paymentClaims.propertyId,bill.propertyId),eq(paymentClaims.status,"PENDING"))).limit(1);
 if(pending)throw new AppError(409,"PAYMENT_CLAIM_PENDING");
 const approved=await approvedSum(bill.id);
 const amountSatang=bill.amountSatang-approved;
 if(!Number.isSafeInteger(amountSatang)||amountSatang<0)
  throw new AppError(409,"PAYMENT_BALANCE_INVALID");
 if(amountSatang===0)throw new AppError(409,"INVOICE_FULLY_RECORDED");
 const payload=buildPromptPayPayload(settings.promptPayId,amountSatang);
 reply.header("cache-control","private, no-store, max-age=0");
 reply.header("pragma","no-cache");
 return {
  invoiceId:bill.id,
  payload,amountSatang,currency:"THB" as const,
  recipientName:settings.accountName,
  promptPayIdMasked:maskPromptPayId(settings.promptPayId),
  paymentSettingsVersion:settings.version,
  recipientVerifiedByBank:false,
  paymentVerifiedByBank:false,
  status:"DISPLAY_ONLY_MANUAL_REVIEW" as const
 };
}
export async function registerPromptPayRoutes(app:FastifyInstance){
 app.get("/v1/tenant/invoices/:invoiceId/promptpay-qr",{
  config:{rateLimit:{max:20,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req);
  const {invoiceId}=tenantParams.parse(req.params);
  const bill=await tenantBill(actor,invoiceId);
  return forInvoice(bill,reply);
 });
 app.get("/v1/properties/:propertyId/invoices/:invoiceId/promptpay-qr",{
  config:{rateLimit:{max:20,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req);
  const {propertyId,invoiceId}=ownerParams.parse(req.params);
  const property=await requireProperty(actor,propertyId);
  const [bill]=await db.select().from(invoices).where(and(
   eq(invoices.id,invoiceId),
   eq(invoices.propertyId,property.id),
   eq(invoices.organizationId,property.organizationId)
  )).limit(1);
  if(!bill)throw new AppError(404,"INVOICE_NOT_FOUND");
  return forInvoice(bill,reply);
 });
}
