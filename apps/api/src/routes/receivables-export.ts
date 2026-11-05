import type {FastifyInstance} from "fastify";
import {and,desc,eq} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {invoices,memberships} from "../db/schema.js";
import {AppError,requireActor,requireProperty} from "../security.js";
import {getFinancialPosition} from "../services/financial-position.js";
import {serializeReceivablesCsv} from "../services/receivables-csv.js";

const propertyParam=z.object({propertyId:z.uuid()});
const MAX_EXPORT_ROWS=500;

/** Scoped read-only receivables export. Requires verified active OWNER
 * membership or SUPER_ADMIN; never sends financial data to a third party.
 */
export async function registerReceivablesExportRoutes(app:FastifyInstance):Promise<void>{
 app.get("/v1/properties/:propertyId/receivables.csv",async(req,reply)=>{
  const {propertyId}=propertyParam.parse(req.params);
  const actor=await requireActor(req);
  const property=await requireProperty(actor,propertyId);
  if(actor.role!=="SUPER_ADMIN"){
   const [member]=await db.select({id:memberships.id}).from(memberships)
    .where(and(eq(memberships.organizationId,property.organizationId),
     eq(memberships.userId,actor.id),eq(memberships.role,"OWNER"),
     eq(memberships.status,"ACTIVE"))).limit(1);
   if(!member)throw new AppError(403,"RECEIVABLE_EXPORT_OWNER_REQUIRED");
  }
  const rows=await db.transaction(async tx=>{
   const bills=await tx.select({
    id:invoices.id,periodStart:invoices.periodStart,
    periodEnd:invoices.periodEnd,dueDate:invoices.dueDate,
    amountSatang:invoices.amountSatang,
   }).from(invoices).where(and(
    eq(invoices.propertyId,property.id),
    eq(invoices.organizationId,property.organizationId),
    eq(invoices.status,"ISSUED"),
   )).orderBy(desc(invoices.createdAt)).limit(MAX_EXPORT_ROWS+1);
   if(bills.length>MAX_EXPORT_ROWS)
    throw new AppError(409,"RECEIVABLE_EXPORT_TOO_LARGE");
   const result=[];
   for(const bill of bills){
    const position=await getFinancialPosition(bill.id,tx);
    result.push({
     invoiceId:bill.id,periodStart:bill.periodStart,
     periodEnd:bill.periodEnd,dueDate:bill.dueDate,
     totalBilledSatang:bill.amountSatang,
     netManualApprovedSatang:position.netManualApprovedSatang,
     internalCreditSatang:position.internalCreditSatang,
     outstandingSatang:position.outstandingSatang,
    });
   }
   return result;
  },{isolationLevel:"repeatable read"});
  const csv=serializeReceivablesCsv(rows);
  reply.header("cache-control","no-store");
  reply.header("content-type","text/csv; charset=utf-8");
  reply.header("content-disposition",`attachment; filename="receivables-${propertyId}.csv"`);
  return reply.send(csv);
 });
}
