import Fastify from "fastify";
import {beforeEach,describe,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({owner:true,scope:true,isolation:"",calls:0,inconsistent:false}));
const propertyId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
vi.mock("../src/security.js",async importOriginal=>{
 const real=await importOriginal<typeof import("../src/security.js")>();
 return {...real,requireActor:async()=>({id:"owner-id",role:"USER"}),
  requireProperty:async()=>{if(!state.scope)throw new real.AppError(403,"PROPERTY_ACCESS_DENIED");
   return {id:propertyId,organizationId:"org-a"};}};
});
vi.mock("../src/db/client.js",()=>{
 const bills=[{id:"invoice-1",periodStart:"2026-10-01",amountSatang:100000}];
 const payments=[{invoiceId:"invoice-1",amountSatang:"60000"}];
 const builder=(data:unknown[])=>({from(){return this;},where(){return this;},orderBy(){return this;},
  limit:async()=>data,groupBy:async()=>data});
 return {db:{select:()=>builder(state.owner?[{id:"membership"}]:[]),
  transaction:async(fn:(tx:unknown)=>Promise<unknown>,options:{isolationLevel:string})=>{
   state.isolation=options.isolationLevel;state.calls=0;
   const tx={select:()=>{const n=++state.calls;const adjustments=state.inconsistent?
    [{invoiceId:"invoice-1",kind:"REVERSE_MANUAL_PAYMENT",amountSatang:"70000"}]:
    [{invoiceId:"invoice-1",kind:"INTERNAL_CREDIT",amountSatang:"5000"}];
    return builder(n===1?bills:n===2?payments:adjustments);}};
   return fn(tx);
  }}};
});
import {registerPropertyFinancialReportRoutes} from "../src/routes/property-financial-report.js";
async function request(query=""){
 const app=Fastify({logger:false});await registerPropertyFinancialReportRoutes(app);
 const response=await app.inject({method:"GET",url:`/v1/properties/${propertyId}/financial-report${query}`});
 await app.close();return response;
}
beforeEach(()=>{state.owner=true;state.scope=true;state.isolation="";state.calls=0;state.inconsistent=false;});
describe("property financial report",()=>{
 it("returns owner-only ledger totals in satang from one repeatable-read snapshot",async()=>{
  const res=await request("?from=2026-10-01&to=2026-10-31");
  expect(res.statusCode).toBe(200);expect(res.headers["cache-control"]).toBe("no-store");
  expect(state.isolation).toBe("repeatable read");
  expect(res.json()).toMatchObject({propertyId,bankVerified:false,unit:"SATANG",
   totals:{invoiceCount:1,totalBilledSatang:100000,grossManualApprovedSatang:60000,
    netManualApprovedSatang:60000,internalCreditSatang:5000,outstandingSatang:35000}});
 });
 it("denies a non-owner",async()=>{state.owner=false;expect((await request()).statusCode).toBe(403);});
 it("rejects invalid and oversized date ranges",async()=>{
  expect((await request("?from=2026-02-30&to=2026-03-01")).statusCode).toBe(400);
  expect((await request("?from=2025-01-01&to=2026-12-31")).statusCode).toBe(400);
 });
 it("fails closed when persisted financial ledgers are inconsistent",async()=>{state.inconsistent=true;expect((await request()).statusCode).toBe(409);});
 it("denies out-of-scope property access",async()=>{state.scope=false;expect((await request()).statusCode).toBe(403);});
});
