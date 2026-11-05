/** Privacy gate for future *read-only* historical invoice endpoint.
 * The subject MUST originate from authenticated LINE identity and the
 * joined lease/invoice scope MUST be independently verified at DB level.
 * No current claim that the endpoint is wired or approved for production.
 */
export type FormerTenantInvoiceAccess={
 verifiedLineSubject:string;
 leaseLineSubject:string|null;
 leaseStatus:string;
 leaseStartDate:string;
 leaseEndDate:string|null;
 invoicePeriodStart:string;
 invoicePeriodEnd:string;
 invoiceStatus:string;
 leaseOrganizationId:string;
 invoiceOrganizationId:string;
 leasePropertyId:string;
 invoicePropertyId:string;
 organizationActive:boolean;
};
const validDate=(value:string|null):value is string=>{
 if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const time=Date.parse(value);
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;
};
export function canReadFormerTenantInvoice(input:FormerTenantInvoiceAccess):boolean{
 return input.organizationActive &&
  input.verifiedLineSubject.length>0 &&
  input.leaseLineSubject===input.verifiedLineSubject &&
  input.leaseStatus==="ENDED" &&
  input.invoiceStatus==="ISSUED" &&
  input.leaseOrganizationId.length>0 &&
  input.leaseOrganizationId===input.invoiceOrganizationId &&
  input.leasePropertyId.length>0 &&
  input.leasePropertyId===input.invoicePropertyId &&
  validDate(input.leaseStartDate) &&
  validDate(input.leaseEndDate) &&
  validDate(input.invoicePeriodStart) &&
  validDate(input.invoicePeriodEnd) &&
  input.leaseStartDate<=input.leaseEndDate &&
  input.leaseStartDate<=input.invoicePeriodStart &&
  input.invoicePeriodStart<=input.invoicePeriodEnd &&
  input.invoicePeriodEnd<=input.leaseEndDate;
}
