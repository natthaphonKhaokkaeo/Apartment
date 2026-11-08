import type {FastifyInstance} from "fastify";
import {and,desc,eq,inArray} from "drizzle-orm";
import {db} from "../db/client.js";
import {invoices,leases,organizations,properties,rooms,users} from "../db/schema.js";
import {AppError,requireActor} from "../security.js";
import {canReadFormerTenantInvoice} from "../services/former-tenant-access.js";

const MAX_LEASES=100,MAX_INVOICES=500;
const validDay=(value:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const time=Date.parse(value);
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;
};
/** A subject-bound, no-side-effects personal-data export.
 * Does not include other occupants, owner contact details, payment evidence
 * blobs, invitation tokens, passwords or LINE provider secrets.
 */
export async function registerTenantPrivacyExportRoutes(app:FastifyInstance):Promise<void>{
 app.get("/v1/tenant/privacy/export",{
  config:{rateLimit:{max:5,timeWindow:"1 minute"}},
 },async(req,reply)=>{
  reply.header("cache-control","no-store");
  const actor=await requireActor(req);
  const [user]=await db.select({id:users.id,lineSubject:users.lineSubject,
   displayName:users.displayName}).from(users).where(and(
    eq(users.id,actor.id),eq(users.status,"ACTIVE"),
  )).limit(1);
  if(!user?.lineSubject)throw new AppError(401,"UNAUTHENTICATED");
  const rows=await db.select({
   leaseId:leases.id,tenantName:leases.tenantName,
   startDate:leases.startDate,endDate:leases.endDate,status:leases.status,
   propertyId:leases.propertyId,organizationId:leases.organizationId,
   propertyName:properties.name,roomNumber:rooms.number,
  }).from(leases)
   .innerJoin(properties,eq(properties.id,leases.propertyId))
   .innerJoin(organizations,eq(organizations.id,leases.organizationId))
   .innerJoin(rooms,eq(rooms.id,leases.roomId))
   .where(and(eq(leases.tenantLineSubject,user.lineSubject),
    inArray(leases.status,["ACTIVE","ENDED"]),eq(organizations.status,"ACTIVE"),
    eq(properties.organizationId,leases.organizationId),
    eq(rooms.propertyId,leases.propertyId)))
   .orderBy(desc(leases.startDate)).limit(MAX_LEASES+1);
  if(rows.length>MAX_LEASES)throw new AppError(409,"TENANT_EXPORT_TOO_LARGE");
  const allowedLeases=rows.filter(lease=>validDay(lease.startDate)&&
    (lease.endDate===null||validDay(lease.endDate)));
  const leaseById=new Map(allowedLeases.map(lease=>[lease.leaseId,lease]));
  const invoiceRows=leaseById.size?await db.select({
   id:invoices.id,leaseId:invoices.leaseId,
   propertyId:invoices.propertyId,organizationId:invoices.organizationId,
   periodStart:invoices.periodStart,periodEnd:invoices.periodEnd,
   dueDate:invoices.dueDate,amountSatang:invoices.amountSatang,
   status:invoices.status,
  }).from(invoices).where(and(
   inArray(invoices.leaseId,[...leaseById.keys()]),
   eq(invoices.status,"ISSUED"),
  )).orderBy(desc(invoices.createdAt)).limit(MAX_INVOICES+1):[];
  if(invoiceRows.length>MAX_INVOICES)throw new AppError(409,"TENANT_EXPORT_TOO_LARGE");
  const permittedInvoices=invoiceRows.filter(bill=>{
   const lease=bill.leaseId?leaseById.get(bill.leaseId):undefined;
   if(!lease||lease.organizationId!==bill.organizationId||
      lease.propertyId!==bill.propertyId||
      !validDay(bill.periodStart)||!validDay(bill.periodEnd)||
      !validDay(bill.dueDate)||bill.periodStart>bill.periodEnd)return false;
   if(lease.status==="ENDED"){
    return canReadFormerTenantInvoice({
     verifiedLineSubject:user.lineSubject,leaseLineSubject:user.lineSubject,
     leaseStatus:"ENDED",leaseStartDate:lease.startDate,
     leaseEndDate:lease.endDate,invoicePeriodStart:bill.periodStart,
     invoicePeriodEnd:bill.periodEnd,invoiceStatus:bill.status,
     leaseOrganizationId:lease.organizationId,
     invoiceOrganizationId:bill.organizationId,
     leasePropertyId:lease.propertyId,invoicePropertyId:bill.propertyId,
     organizationActive:true,
    });
   }
   return bill.periodStart>=lease.startDate&&
    (lease.endDate===null||bill.periodEnd<=lease.endDate);
  }).map(({organizationId:_,propertyId:__, ...bill})=>bill);
  const exportData={
   schemaVersion:1,
   generatedAt:new Date().toISOString(),
   account:{displayName:user.displayName},
   leases:allowedLeases.map(({organizationId:_,propertyId:__,...lease})=>lease),
   invoices:permittedInvoices,
  };
  reply.header("content-type","application/json; charset=utf-8");
  reply.header("content-disposition",'attachment; filename="tenant-data-export.json"');
  return reply.send(exportData);
 });
}
