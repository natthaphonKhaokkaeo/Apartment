import type {FastifyInstance} from "fastify";
import {and,eq,gte,inArray,lte,sql} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {financeAdjustmentEntries,invoices,memberships,paymentLedger} from "../db/schema.js";
import {AppError,requireActor,requireProperty} from "../security.js";
import {summarizePropertyFinancials} from "../services/property-financial-summary.js";

const params=z.object({propertyId:z.uuid()});
const dateString=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{
 const date=new Date(`${value}T00:00:00.000Z`);
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
});
const query=z.object({from:dateString.optional(),to:dateString.optional()});
const MAX_REPORT_INVOICES=5000;
function satang(value:string|number):number{
 const amount=Number(value);
 if(!Number.isSafeInteger(amount)||amount<0)throw new AppError(409,"FINANCIAL_REPORT_DATA_INVALID");
 return amount;
}

/** Owner-only, read-only financial totals based on the internal payment ledger. */
export async function registerPropertyFinancialReportRoutes(app:FastifyInstance):Promise<void>{
 app.get("/v1/properties/:propertyId/financial-report",async(req,reply)=>{
  reply.header("cache-control","no-store");
  const parsedParams=params.safeParse(req.params),parsedQuery=query.safeParse(req.query);
  if(!parsedParams.success||!parsedQuery.success)throw new AppError(400,"FINANCIAL_REPORT_QUERY_INVALID");
  const {propertyId}=parsedParams.data,range=parsedQuery.data;
  const today=new Date().toISOString().slice(0,10);
  const from=range.from??`${today.slice(0,7)}-01`,to=range.to??today;
  const start=Date.parse(`${from}T00:00:00Z`),end=Date.parse(`${to}T00:00:00Z`);
  if(start>end||end-start>366*24*60*60*1000)throw new AppError(400,"FINANCIAL_REPORT_RANGE_INVALID");
  const actor=await requireActor(req),property=await requireProperty(actor,propertyId);
  if(actor.role!=="SUPER_ADMIN"){
   const [owner]=await db.select({id:memberships.id}).from(memberships).where(and(
    eq(memberships.organizationId,property.organizationId),eq(memberships.userId,actor.id),
    eq(memberships.role,"OWNER"),eq(memberships.status,"ACTIVE"))).limit(1);
   if(!owner)throw new AppError(403,"FINANCIAL_REPORT_OWNER_REQUIRED");
  }
  const report=await db.transaction(async tx=>{
   const bills=await tx.select({id:invoices.id,periodStart:invoices.periodStart,
    amountSatang:invoices.amountSatang}).from(invoices).where(and(
     eq(invoices.propertyId,property.id),eq(invoices.organizationId,property.organizationId),
     eq(invoices.status,"ISSUED"),gte(invoices.periodStart,from),lte(invoices.periodStart,to)))
    .orderBy(invoices.periodStart).limit(MAX_REPORT_INVOICES+1);
   if(bills.length>MAX_REPORT_INVOICES)throw new AppError(409,"FINANCIAL_REPORT_TOO_LARGE");
   const ids=bills.map(row=>row.id);
   if(!ids.length)return summarizePropertyFinancials([],[],[]);
   const payments=await tx.select({invoiceId:paymentLedger.invoiceId,
    amountSatang:sql<string>`sum(${paymentLedger.amountSatang})`}).from(paymentLedger).where(and(
     eq(paymentLedger.organizationId,property.organizationId),eq(paymentLedger.propertyId,property.id),
     inArray(paymentLedger.invoiceId,ids))).groupBy(paymentLedger.invoiceId);
   const adjustments=await tx.select({invoiceId:financeAdjustmentEntries.invoiceId,
    kind:financeAdjustmentEntries.kind,
    amountSatang:sql<string>`sum(${financeAdjustmentEntries.amountSatang})`})
    .from(financeAdjustmentEntries).where(and(
     eq(financeAdjustmentEntries.organizationId,property.organizationId),
     eq(financeAdjustmentEntries.propertyId,property.id),inArray(financeAdjustmentEntries.invoiceId,ids)))
    .groupBy(financeAdjustmentEntries.invoiceId,financeAdjustmentEntries.kind);
   try{return summarizePropertyFinancials(bills.map(row=>({id:row.id,periodStart:row.periodStart,
    amountSatang:satang(row.amountSatang)})),payments.map(row=>({invoiceId:row.invoiceId,
    amountSatang:satang(row.amountSatang)})),adjustments.map(row=>({invoiceId:row.invoiceId,
    kind:row.kind,amountSatang:satang(row.amountSatang)})));}
   catch{throw new AppError(409,"FINANCIAL_REPORT_DATA_INCONSISTENT");}
  },{isolationLevel:"repeatable read"});
  return reply.send({propertyId:property.id,from,to,currency:"THB",unit:"SATANG",
   bankVerified:false,...report});
 });
}
