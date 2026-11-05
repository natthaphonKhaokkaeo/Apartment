import {describe,expect,it} from "vitest";
import {canReadFormerTenantInvoice} from "../src/services/former-tenant-access.js";

const scope={
 verifiedLineSubject:"U:verified",
 leaseLineSubject:"U:verified",
 leaseStatus:"ENDED" as const,
 leaseStartDate:"2026-10-01",
 leaseEndDate:"2026-10-31",
 invoicePeriodStart:"2026-10-01",
 invoicePeriodEnd:"2026-10-31",
 invoiceStatus:"ISSUED" as const,
 leaseOrganizationId:"org-a",
 invoiceOrganizationId:"org-a",
 leasePropertyId:"property-a",
 invoicePropertyId:"property-a",
 organizationActive:true,
};
describe("P1 former-tenant historical invoice privacy guard",()=>{
 it("allows only their own pre-moveout issued invoice in matching scope",()=>{
  expect(canReadFormerTenantInvoice(scope)).toBe(true);
 });
 it("denies cross-org or cross-property invoices even when subject matches",()=>{
  expect(canReadFormerTenantInvoice({...scope,invoiceOrganizationId:"org-b"})).toBe(false);
  expect(canReadFormerTenantInvoice({...scope,invoicePropertyId:"property-b"})).toBe(false);
 });
 it("denies another LINE identity and empty or unverified subjects",()=>{
  expect(canReadFormerTenantInvoice({...scope,verifiedLineSubject:"U:other"})).toBe(false);
  expect(canReadFormerTenantInvoice({...scope,verifiedLineSubject:""})).toBe(false);
  expect(canReadFormerTenantInvoice({...scope,leaseLineSubject:null})).toBe(false);
 });
 it("denies non-ended leases, missing end date and inactive organizations",()=>{
  expect(canReadFormerTenantInvoice({...scope,leaseStatus:"ACTIVE"})).toBe(false);
  expect(canReadFormerTenantInvoice({...scope,leaseEndDate:null})).toBe(false);
  expect(canReadFormerTenantInvoice({...scope,organizationActive:false})).toBe(false);
 });
 it("denies invoices issued for a future period and void invoices",()=>{
  expect(canReadFormerTenantInvoice({...scope,invoicePeriodEnd:"2026-11-01"})).toBe(false);
  expect(canReadFormerTenantInvoice({...scope,invoiceStatus:"VOID"})).toBe(false);
 });
 it("rejects invoices outside the actual signed lease period",()=>{
  expect(canReadFormerTenantInvoice({...scope,invoicePeriodStart:"2026-09-01"})).toBe(false);
  expect(canReadFormerTenantInvoice({...scope,invoicePeriodStart:"2026-11-01"})).toBe(false);
  expect(canReadFormerTenantInvoice({...scope,leaseStartDate:"2026-11-01"})).toBe(false);
 });
 it("fails closed for malformed dates",()=>{
  expect(canReadFormerTenantInvoice({...scope,leaseEndDate:"2026-02-30"})).toBe(false);
  expect(canReadFormerTenantInvoice({...scope,invoicePeriodEnd:"2030-not-a-date"})).toBe(false);
 });
});
