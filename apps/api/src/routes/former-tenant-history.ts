import type {FastifyInstance} from "fastify";
import {and,desc,eq} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {invoiceLines,invoices,leases,organizations,properties,users} from "../db/schema.js";
import {AppError,requireActor} from "../security.js";
import {canReadFormerTenantInvoice} from "../services/former-tenant-access.js";

const params=z.object({invoiceId:z.uuid()});
type HistoricalInvoiceRow={
 id:string;leaseId:string;leaseLineSubject:string|null;
 leaseStatus:string;leaseStartDate:string;leaseEndDate:string|null;
 leaseOrganizationId:string;leasePropertyId:string;
 invoiceOrganizationId:string;invoicePropertyId:string;
 invoicePeriodStart:string;invoicePeriodEnd:string;
 invoiceStatus:string;organizationStatus:string;
 propertyName:string;dueDate:string;amountSatang:number;
 createdAt:Date;
};
async function verifiedSubject(actorId:string){
 const [user]=await db.select({lineSubject:users.lineSubject}).from(users)
  .where(and(eq(users.id,actorId),eq(users.status,"ACTIVE"))).limit(1);
 if(!user?.lineSubject)throw new AppError(401,"UNAUTHENTICATED");
 return user.lineSubject;
}
function historyAllowed(row:HistoricalInvoiceRow,subject:string){
 return canReadFormerTenantInvoice({
  verifiedLineSubject:subject,
  leaseLineSubject:row.leaseLineSubject,
  leaseStatus:row.leaseStatus,
  leaseStartDate:row.leaseStartDate,
  leaseEndDate:row.leaseEndDate,
  invoicePeriodStart:row.invoicePeriodStart,
  invoicePeriodEnd:row.invoicePeriodEnd,
  invoiceStatus:row.invoiceStatus,
  leaseOrganizationId:row.leaseOrganizationId,
  invoiceOrganizationId:row.invoiceOrganizationId,
  leasePropertyId:row.leasePropertyId,
  invoicePropertyId:row.invoicePropertyId,
  organizationActive:row.organizationStatus==="ACTIVE",
 });
}
function fields(){
 return {
  id:invoices.id,leaseId:leases.id,leaseLineSubject:leases.tenantLineSubject,
  leaseStatus:leases.status,leaseStartDate:leases.startDate,leaseEndDate:leases.endDate,
  leaseOrganizationId:leases.organizationId,leasePropertyId:leases.propertyId,
  invoiceOrganizationId:invoices.organizationId,invoicePropertyId:invoices.propertyId,
  invoicePeriodStart:invoices.periodStart,invoicePeriodEnd:invoices.periodEnd,
  invoiceStatus:invoices.status,organizationStatus:organizations.status,
  propertyName:properties.name,dueDate:invoices.dueDate,
  amountSatang:invoices.amountSatang,createdAt:invoices.createdAt,
 };
}
function sanitize(row:HistoricalInvoiceRow){
 return {id:row.id,leaseId:row.leaseId,propertyName:row.propertyName,
  periodStart:row.invoicePeriodStart,periodEnd:row.invoicePeriodEnd,
  dueDate:row.dueDate,amountSatang:row.amountSatang,status:row.invoiceStatus,
  createdAt:row.createdAt};
}
export async function registerFormerTenantHistoryRoutes(app:FastifyInstance):Promise<void>{
 app.get("/v1/tenant/history/invoices",async(req,reply)=>{
  reply.header("cache-control","no-store");
  const actor=await requireActor(req),subject=await verifiedSubject(actor.id);
  const rows=await db.select(fields()).from(invoices)
   .innerJoin(leases,eq(invoices.leaseId,leases.id))
   .innerJoin(properties,eq(properties.id,leases.propertyId))
   .innerJoin(organizations,eq(organizations.id,leases.organizationId))
   .where(and(eq(leases.tenantLineSubject,subject),eq(leases.status,"ENDED"),
    eq(invoices.status,"ISSUED"),eq(organizations.status,"ACTIVE"),
    eq(properties.organizationId,leases.organizationId),
    eq(invoices.propertyId,leases.propertyId),
    eq(invoices.organizationId,leases.organizationId)))
   .orderBy(desc(invoices.createdAt)).limit(100);
  return rows.filter(row=>historyAllowed(row,subject)).map(sanitize);
 });
 app.get("/v1/tenant/history/invoices/:invoiceId",async(req,reply)=>{
  reply.header("cache-control","no-store");
  const {invoiceId}=params.parse(req.params);
  const actor=await requireActor(req),subject=await verifiedSubject(actor.id);
  const [row]=await db.select(fields()).from(invoices)
   .innerJoin(leases,eq(invoices.leaseId,leases.id))
   .innerJoin(properties,eq(properties.id,leases.propertyId))
   .innerJoin(organizations,eq(organizations.id,leases.organizationId))
   .where(and(eq(invoices.id,invoiceId),
    eq(leases.tenantLineSubject,subject),eq(leases.status,"ENDED"),
    eq(invoices.status,"ISSUED"),eq(organizations.status,"ACTIVE"),
    eq(properties.organizationId,leases.organizationId),
    eq(invoices.propertyId,leases.propertyId),
    eq(invoices.organizationId,leases.organizationId))).limit(1);
  if(!row||!historyAllowed(row,subject))throw new AppError(404,"INVOICE_NOT_FOUND");
  const lines=await db.select({type:invoiceLines.type,description:invoiceLines.description,
    unitsMilli:invoiceLines.unitsMilli,tariffSatang:invoiceLines.tariffSatang,
    amountSatang:invoiceLines.amountSatang}).from(invoiceLines)
   .where(eq(invoiceLines.invoiceId,row.id));
  return {...sanitize(row),lines};
 });
}
