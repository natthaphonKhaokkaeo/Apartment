import type {FastifyInstance,FastifyReply} from "fastify";
import {and,asc,eq} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {invoiceLines,invoices,leases,organizations,properties,rooms,type InvoiceDocumentSnapshot} from "../db/schema.js";
import {AppError,requireActor,requireProperty} from "../security.js";
import {tenantBill} from "./payments.js";
import {renderBillingNotice,type BillingNoticeInput} from "../services/billing-notice-pdf.js";

const params=z.object({invoiceId:z.uuid()});
const ownerParams=params.extend({propertyId:z.uuid()});
function validSnapshot(value:unknown):value is InvoiceDocumentSnapshot{
 return z.object({
  schemaVersion:z.literal(1),
  issuerName:z.string().min(1),
  propertyName:z.string().min(1),
  propertyAddress:z.string(),
  roomNumber:z.string().min(1),
  tenantName:z.string().min(1)
 }).safeParse(value).success;
}
async function sourceFor(bill:typeof invoices.$inferSelect):Promise<BillingNoticeInput>{
 const lines=await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId,bill.id))
  .orderBy(asc(invoiceLines.ordinal),asc(invoiceLines.id));
 let snapshot:InvoiceDocumentSnapshot;
 let snapshotSource:BillingNoticeInput["snapshotSource"];
 if(validSnapshot(bill.documentSnapshot)){
  snapshot=bill.documentSnapshot;
  snapshotSource="ISSUED_SNAPSHOT";
 }else if(bill.documentSnapshot===null){
  // Historical invoices issued before the snapshot migration have immutable financial lines
  // but mutable labels. The PDF explicitly identifies the current-record fallback.
  const [[org],[prop],[room],[lease]]=await Promise.all([
   db.select().from(organizations).where(eq(organizations.id,bill.organizationId)).limit(1),
   db.select().from(properties).where(and(eq(properties.id,bill.propertyId),
    eq(properties.organizationId,bill.organizationId))).limit(1),
   db.select().from(rooms).where(and(eq(rooms.id,bill.roomId),
    eq(rooms.propertyId,bill.propertyId))).limit(1),
   db.select().from(leases).where(and(eq(leases.id,bill.leaseId),
    eq(leases.roomId,bill.roomId))).limit(1)
  ]);
  if(!org||!prop||!room||!lease)throw new AppError(409,"BILLING_NOTICE_METADATA_MISSING");
  snapshot={schemaVersion:1,issuerName:org.name,propertyName:prop.name,
   propertyAddress:prop.address,roomNumber:room.number,tenantName:lease.tenantName};
  snapshotSource="CURRENT_RECORD_LEGACY";
 }else throw new AppError(409,"BILLING_NOTICE_SNAPSHOT_INVALID");
 return {
  invoiceId:bill.id,issueDate:bill.createdAt,periodStart:bill.periodStart,
  periodEnd:bill.periodEnd,dueDate:bill.dueDate,amountSatang:bill.amountSatang,
  status:bill.status,
  ...snapshot,snapshotSource,
  lines:lines.map(l=>({type:l.type,description:l.description,amountSatang:l.amountSatang,
   unitsMilli:l.unitsMilli,tariffSatang:l.tariffSatang}))
 };
}
async function sendPdf(reply:FastifyReply,bill:typeof invoices.$inferSelect){
 if(bill.status!=="ISSUED")throw new AppError(409,"BILLING_NOTICE_NOT_ISSUED");
 let content:Buffer;
 try{content=await renderBillingNotice(await sourceFor(bill));}
 catch(e){
  if(e instanceof AppError)throw e;
  if(e instanceof Error&&[
   "INVOICE_LINE_SUM_MISMATCH","EMPTY_INVOICE_LINES","INVALID_BILL_AMOUNT",
   "INVALID_INVOICE_LINE","TOO_MANY_INVOICE_LINES","INVALID_DOCUMENT_METADATA",
   "INVOICE_LINE_TOO_TALL","INVALID_BILL_DATE","INVALID_BILL_PERIOD",
   "DOCUMENT_METADATA_TOO_LONG","BILLING_NOTICE_NOT_ISSUED"
  ].includes(e.message))throw new AppError(409,"BILLING_NOTICE_DATA_INVALID");
  throw e;
 }
 reply.header("cache-control","private, no-store, max-age=0");
 reply.header("pragma","no-cache");
 reply.header("x-content-type-options","nosniff");
 reply.header("content-disposition",'attachment; filename="billing-notice-'+bill.id+'.pdf"');
 return reply.type("application/pdf").send(content);
}
export async function registerBillingDocumentRoutes(app:FastifyInstance){
 app.get("/v1/properties/:propertyId/invoices/:invoiceId/billing-notice.pdf",{
  config:{rateLimit:{max:20,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const {propertyId,invoiceId}=ownerParams.parse(req.params);
  const actor=await requireActor(req);
  const property=await requireProperty(actor,propertyId);
  const [bill]=await db.select().from(invoices).where(and(eq(invoices.id,invoiceId),
   eq(invoices.propertyId,property.id),eq(invoices.organizationId,property.organizationId))).limit(1);
  if(!bill)throw new AppError(404,"INVOICE_NOT_FOUND");
  return sendPdf(reply,bill);
 });
 app.get("/v1/tenant/invoices/:invoiceId/billing-notice.pdf",{
  config:{rateLimit:{max:20,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const {invoiceId}=params.parse(req.params);
  const actor=await requireActor(req);
  const bill=await tenantBill(actor,invoiceId);
  return sendPdf(reply,bill);
 });
}
