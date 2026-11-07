import type {FastifyInstance} from "fastify";
import {and,desc,eq,gte,inArray,lte,sql} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {financeAdjustmentEntries,invoices,leases,paymentLedger,rooms} from "../db/schema.js";
import {AppError,requireActor,requireProperty} from "../security.js";
import {assertOwner} from "./billing-batches.js";
import {reportInvoiceFinancials,safeRoomInvoiceReportRange} from "../services/invoice-room-report.js";

const params=z.object({propertyId:z.uuid()});
const query=z.object({roomId:z.uuid().optional(),from:z.iso.date().optional(),
 to:z.iso.date().optional(),status:z.enum(["ISSUED","VOID"]).optional()}).strict();
const MAX_ROWS=250;
const safeAmount=(value:string|number|null)=>{
 const amount=Number(value??0);
 if(!Number.isSafeInteger(amount)||amount<0||amount>2147483647)
  throw new AppError(409,"INVOICE_REPORT_FINANCIAL_DATA_INVALID");
 return amount;
};

/** Owner-only per-room statement: all rows are already scoped to a verified property and org. */
export async function registerInvoiceRoomReportRoutes(app:FastifyInstance){
 app.get("/v1/properties/:propertyId/invoice-room-report",{
  config:{rateLimit:{max:30,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const {propertyId}=params.parse(req.params),filters=query.parse(req.query);
  if(!safeRoomInvoiceReportRange(filters.from,filters.to))throw new AppError(422,"INVALID_REPORT_DATE_RANGE");
  const actor=await requireActor(req),property=await requireProperty(actor,propertyId);
  await assertOwner(actor.id,property,db);
  const rows=await db.select({id:invoices.id,roomId:invoices.roomId,
   roomNumber:rooms.number,tenantName:leases.tenantName,
   documentSnapshot:invoices.documentSnapshot,amountSatang:invoices.amountSatang,
   periodStart:invoices.periodStart,periodEnd:invoices.periodEnd,
   dueDate:invoices.dueDate,status:invoices.status,createdAt:invoices.createdAt,
   replacesInvoiceId:invoices.replacesInvoiceId,voidReason:invoices.voidReason})
   .from(invoices).innerJoin(rooms,eq(invoices.roomId,rooms.id))
   .innerJoin(leases,eq(invoices.leaseId,leases.id))
   .where(and(eq(invoices.organizationId,property.organizationId),eq(invoices.propertyId,property.id),
    eq(rooms.organizationId,property.organizationId),eq(rooms.propertyId,property.id),
    eq(leases.organizationId,property.organizationId),eq(leases.propertyId,property.id),
    filters.roomId?eq(invoices.roomId,filters.roomId):undefined,
    filters.status?eq(invoices.status,filters.status):undefined,
    filters.from?gte(invoices.periodStart,filters.from):undefined,
    filters.to?lte(invoices.periodStart,filters.to):undefined))
   .orderBy(desc(invoices.createdAt),desc(invoices.id)).limit(MAX_ROWS+1);
  const limited=rows.length>MAX_ROWS,items=rows.slice(0,MAX_ROWS),ids=items.map(item=>item.id);
  const [payments,adjustments]=ids.length?await Promise.all([
   db.select({invoiceId:paymentLedger.invoiceId,amount:sql<string>`sum(${paymentLedger.amountSatang})`})
    .from(paymentLedger).where(and(eq(paymentLedger.organizationId,property.organizationId),
     eq(paymentLedger.propertyId,property.id),inArray(paymentLedger.invoiceId,ids)))
    .groupBy(paymentLedger.invoiceId),
   db.select({invoiceId:financeAdjustmentEntries.invoiceId,kind:financeAdjustmentEntries.kind,
    amount:sql<string>`sum(${financeAdjustmentEntries.amountSatang})`})
    .from(financeAdjustmentEntries).where(and(eq(financeAdjustmentEntries.organizationId,property.organizationId),
     eq(financeAdjustmentEntries.propertyId,property.id),inArray(financeAdjustmentEntries.invoiceId,ids)))
    .groupBy(financeAdjustmentEntries.invoiceId,financeAdjustmentEntries.kind)
  ]):[[],[]];
  const paymentMap=new Map(payments.map(row=>[row.invoiceId,safeAmount(row.amount)]));
  const adjustmentMap=new Map<string,{reversed:number;credit:number}>();
  for(const row of adjustments){
   const current=adjustmentMap.get(row.invoiceId)??{reversed:0,credit:0};
   if(row.kind==="REVERSE_MANUAL_PAYMENT")current.reversed+=safeAmount(row.amount);
   if(row.kind==="INTERNAL_CREDIT")current.credit+=safeAmount(row.amount);
   adjustmentMap.set(row.invoiceId,current);
  }
  const report=items.map(row=>{
   const adjustment=adjustmentMap.get(row.id)??{reversed:0,credit:0};
   let position:ReturnType<typeof reportInvoiceFinancials>;
   try{position=reportInvoiceFinancials(row.status,row.amountSatang,
    paymentMap.get(row.id)??0,adjustment.reversed,adjustment.credit);}
   catch{throw new AppError(409,"INVOICE_REPORT_FINANCIAL_DATA_INVALID");}
   // Issued snapshot is immutable; never silently change historical recipient labels.
   const snapshot=row.documentSnapshot;
   return {id:row.id,roomId:row.roomId,roomNumber:snapshot?.roomNumber||row.roomNumber,
    tenantName:snapshot?.tenantName||row.tenantName,
    amountSatang:row.amountSatang,periodStart:row.periodStart,periodEnd:row.periodEnd,
    dueDate:row.dueDate,status:row.status,createdAt:row.createdAt,
    replacesInvoiceId:row.replacesInvoiceId,voidReason:row.voidReason,...position};
  });
  reply.header("cache-control","private, no-store");
  return {propertyId:property.id,items:report,limited,
   summary:{invoiceCount:report.filter(x=>x.status==="ISSUED").length,
    billedSatang:report.filter(x=>x.status==="ISSUED").reduce((sum,x)=>sum+x.amountSatang,0),
    paidSatang:report.reduce((sum,x)=>sum+x.paidSatang,0),
    outstandingSatang:report.reduce((sum,x)=>sum+x.outstandingSatang,0)}};
 });
}
