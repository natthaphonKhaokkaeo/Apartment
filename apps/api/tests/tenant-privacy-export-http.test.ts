import Fastify from "fastify";
import {getTableName} from "drizzle-orm";
import {beforeEach,describe,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({
 userActive:true,leases:[] as Record<string,unknown>[],
 invoices:[] as Record<string,unknown>[],
}));
const lease={
 leaseId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
 tenantName:"Own Tenant",startDate:"2026-10-01",
 endDate:"2026-10-31",status:"ENDED",
 propertyId:"property-a",organizationId:"org-a",
 propertyName:"Own Building",roomNumber:"101",
};
const invoice={
 id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",leaseId:lease.leaseId,
 organizationId:"org-a",propertyId:"property-a",
 periodStart:"2026-10-01",periodEnd:"2026-10-31",
 dueDate:"2026-11-01",amountSatang:10000,status:"ISSUED",
};
vi.mock("../src/db/client.js",()=>({
 db:{select:()=>{
  let table="";
  return {
   from(t:unknown){table=getTableName(t as Parameters<typeof getTableName>[0]);return this;},
   where(){return this;},innerJoin(){return this;},orderBy(){return this;},
   limit:async()=>table==="users"?
    state.userActive?[{id:"actor-a",lineSubject:"U:own",displayName:"Own User"}]:[]:
    table==="leases"?state.leases:table==="invoices"?state.invoices:[],
  };
 }},
}));
vi.mock("../src/security.js",async(importOriginal)=>{
 const actual=await importOriginal<typeof import("../src/security.js")>();
 return {...actual,requireActor:async()=>({id:"actor-a"})};
});
import {registerTenantPrivacyExportRoutes} from "../src/routes/tenant-privacy-export.js";
async function exportData(){
 const app=Fastify({logger:false});
 await registerTenantPrivacyExportRoutes(app);
 const res=await app.inject({method:"GET",url:"/v1/tenant/privacy/export"});
 await app.close();
 return res;
}
beforeEach(()=>{
 state.userActive=true;state.leases=[{...lease}];state.invoices=[{...invoice}];
});
describe("P5 tenant privacy export HTTP security",()=>{
 it("exports only own lease and matching issued invoices without provider identifiers",async()=>{
  const res=await exportData();
  expect(res.statusCode).toBe(200);
  expect(res.headers["cache-control"]).toBe("no-store");
  expect(res.headers["content-disposition"]).toContain("attachment");
  expect(res.json()).toMatchObject({schemaVersion:1,
   leases:[{leaseId:lease.leaseId}],invoices:[{id:invoice.id}]});
  expect(res.body).not.toContain("U:own");
  expect(res.body).not.toContain("organizationId");
  expect(res.body).not.toContain("propertyId");
 });
 it("blocks disabled or unlinked accounts",async()=>{
  state.userActive=false;
  const res=await exportData();
  expect(res.statusCode).toBe(401);
 });
 it("rejects other property or organization's invoice",async()=>{
  state.invoices=[{...invoice,organizationId:"org-other"},
   {...invoice,propertyId:"property-other"}];
  const res=await exportData();
  expect(res.statusCode).toBe(200);
  expect(res.json().invoices).toEqual([]);
 });
 it("removes invoices beyond former tenant lease dates or voided invoices",async()=>{
  state.invoices=[{...invoice,periodEnd:"2026-11-01"},
   {...invoice,status:"VOID"}];
  const res=await exportData();
  expect(res.json().invoices).toEqual([]);
 });
 it("fails closed instead of silently truncating >100 leases",async()=>{
  state.leases=Array.from({length:101},()=>({...lease}));
  expect((await exportData()).statusCode).toBe(409);
 });
 it("fails closed instead of silently truncating >500 invoices",async()=>{
  state.invoices=Array.from({length:501},()=>({...invoice}));
  expect((await exportData()).statusCode).toBe(409);
 });
 it("supports empty own account export",async()=>{
  state.leases=[];state.invoices=[];
  const res=await exportData();
  expect(res.statusCode).toBe(200);
  expect(res.json()).toMatchObject({leases:[],invoices:[]});
 });
});
