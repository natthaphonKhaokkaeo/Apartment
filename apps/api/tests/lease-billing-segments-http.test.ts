import Fastify from "fastify";
import {beforeEach,describe,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({
 allowed:true,found:true,
 endDate:null as string|null,
 cadence:"MONTHLY" as "MONTHLY"|"SEMI_MONTHLY"|"EVERY_15_DAYS",
 rollingAnchor:null as string|null,
}));
const propertyId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const leaseId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
vi.mock("../src/security.js",async(importOriginal)=>{
 const real=await importOriginal<typeof import("../src/security.js")>();
 return {...real,requireActor:async()=>({id:"actor-a"}),
  requireProperty:async()=>{
   if(!state.allowed)throw new real.AppError(403,"PROPERTY_ACCESS_DENIED");
   return {id:propertyId,organizationId:"org-a",cadence:state.cadence,rollingAnchor:state.rollingAnchor};
  }};
});
vi.mock("../src/db/client.js",()=>({
 db:{select:()=>({
  from(){return this;},where(){return this;},
  limit:async()=>state.found?[{id:leaseId,startDate:"2026-10-11",endDate:state.endDate,status:"ACTIVE"}]:[],
 })},
}));
vi.mock("../src/services/property-administrator.js",()=>({
 requirePropertyAdministrator:async()=>{
  if(!state.allowed)throw Object.assign(new Error("PROPERTY_ACCESS_DENIED"),{statusCode:403,code:"PROPERTY_ACCESS_DENIED"});
  return {id:propertyId,organizationId:"org-a",cadence:state.cadence,rollingAnchor:state.rollingAnchor};
 },
}));
import {registerLeaseBillingSegmentsRoutes} from "../src/routes/lease-billing-segments.js";
async function request(endExclusive="2026-12-05"){
 const app=Fastify({logger:false});
 await registerLeaseBillingSegmentsRoutes(app);
 const res=await app.inject({method:"GET",
  url:`/v1/properties/${propertyId}/leases/${leaseId}/billing-segments?endExclusive=${endExclusive}`});
 await app.close();
 return res;
}
beforeEach(()=>{
 state.allowed=true;state.found=true;state.endDate=null;
 state.cadence="MONTHLY";state.rollingAnchor=null;
});
describe("P1 owner-scoped mid-cycle invoice boundary preview",()=>{
 it("returns split billing cycles without modifying lease or issuing invoices",async()=>{
  const response=await request();
  expect(response.statusCode).toBe(200);
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(response.json()).toMatchObject({leaseId,previewOnly:true,segments:[
   {start:"2026-10-11",endExclusive:"2026-11-01",partial:true},
   {start:"2026-11-01",endExclusive:"2026-12-01",partial:false},
   {start:"2026-12-01",endExclusive:"2026-12-05",partial:true},
  ]});
 });
 it("denies access to unrelated property before any lease data",async()=>{
  state.allowed=false;
  expect((await request()).statusCode).toBe(403);
 });
 it("hides missing or cross-scope leases",async()=>{
  state.found=false;
  expect((await request()).statusCode).toBe(404);
 });
 it("fails closed when asked to preview after physical move-out",async()=>{
  state.endDate="2026-11-01";
  expect((await request()).statusCode).toBe(422);
 });
 it("rejects unbounded or malformed request dates",async()=>{
  expect((await request("2029-01-01")).statusCode).toBe(422);
  expect((await request("2026-02-30")).statusCode).toBeGreaterThanOrEqual(400);
 });
 it("requires anchor for rolling 15-day cycle",async()=>{
  state.cadence="EVERY_15_DAYS";state.rollingAnchor=null;
  expect((await request()).statusCode).toBe(422);
 });
});
