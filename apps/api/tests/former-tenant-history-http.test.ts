import Fastify from "fastify";
import {beforeEach,describe,expect,it,vi} from "vitest";

const state=vi.hoisted(()=>({
 subject:"U:test",
 currentUserActive:true,
 rows:[] as Record<string,unknown>[],
 lines:[{type:"RENT",description:"Rent",unitsMilli:null,tariffSatang:null,amountSatang:50000}],
}));
const example={
 id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",leaseId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
 leaseLineSubject:"U:test",leaseStatus:"ENDED",leaseStartDate:"2026-10-01",
 leaseEndDate:"2026-10-31",invoicePeriodStart:"2026-10-01",
 invoicePeriodEnd:"2026-10-31",invoiceStatus:"ISSUED",
 leaseOrganizationId:"org-a",invoiceOrganizationId:"org-a",
 leasePropertyId:"property-a",invoicePropertyId:"property-a",
 organizationStatus:"ACTIVE",propertyName:"Apartment A",
 dueDate:"2026-11-01",amountSatang:50000,createdAt:new Date("2026-10-31T10:00:00Z"),
};
vi.mock("../src/db/client.js",()=>({
 db:{select:(shape:Record<string,unknown>)=>{
  const kind="lineSubject" in shape?"user":"leaseLineSubject" in shape?"invoice":"lines";
  const data=()=>kind==="user"?(state.currentUserActive?[{lineSubject:state.subject}]:[]):
   kind==="invoice"?state.rows:state.lines;
  const builder={
   from(){return this;},innerJoin(){return this;},where(){return this;},orderBy(){return this;},
   limit:async()=>data(),
   then(resolve:(v:unknown)=>unknown,reject:(e:unknown)=>unknown){
    return Promise.resolve(data()).then(resolve,reject);
   },
  };
  return builder;
 }},
}));
vi.mock("../src/security.js",async(importOriginal)=>{
 const actual=await importOriginal<typeof import("../src/security.js")>();
 return {...actual,requireActor:async()=>({id:"actor-a"})};
});
import {registerFormerTenantHistoryRoutes} from "../src/routes/former-tenant-history.js";

async function invoke(path:string){
 const app=Fastify({logger:false});
 await registerFormerTenantHistoryRoutes(app);
 const res=await app.inject({method:"GET",url:path});
 await app.close();
 return res;
}
beforeEach(()=>{
 state.subject="U:test";
 state.currentUserActive=true;
 state.rows=[{...example}];
});
describe("P1 former-tenant invoice HTTP security",()=>{
 it("lists only past authorized invoices without exposing owner/subject fields",async()=>{
  const res=await invoke("/v1/tenant/history/invoices");
  expect(res.statusCode).toBe(200);
  expect(res.headers["cache-control"]).toBe("no-store");
  const [row]=res.json();
  expect(row).toMatchObject({id:example.id,amountSatang:50000});
  expect(row).not.toHaveProperty("leaseLineSubject");
  expect(row).not.toHaveProperty("leaseOrganizationId");
 });
 it("returns only historical rows within the move-out boundary",async()=>{
  state.rows=[{...example,invoicePeriodEnd:"2026-11-01"},{...example}];
  const res=await invoke("/v1/tenant/history/invoices");
  expect(res.statusCode).toBe(200);
  expect(res.json()).toHaveLength(1);
 });
 it("denies a different subject and property mismatch",async()=>{
  state.rows=[{...example,leaseLineSubject:"U:another"},{...example,invoicePropertyId:"property-b"}];
  const res=await invoke("/v1/tenant/history/invoices");
  expect(res.json()).toEqual([]);
 });
 it("returns no history to inactive or unlinked users",async()=>{
  state.currentUserActive=false;
  const res=await invoke("/v1/tenant/history/invoices");
  expect(res.statusCode).toBe(401);
 });
 it("returns invoice detail and scoped line items for verified former tenant",async()=>{
  const res=await invoke("/v1/tenant/history/invoices/"+example.id);
  expect(res.statusCode).toBe(200);
  expect(res.headers["cache-control"]).toBe("no-store");
  expect(res.json()).toMatchObject({id:example.id,lines:[{amountSatang:50000}]});
 });
 it("responds 404 instead of leaking detail when the lease boundary is invalid",async()=>{
  state.rows=[{...example,invoicePeriodEnd:"2026-11-01"}];
  const res=await invoke("/v1/tenant/history/invoices/"+example.id);
  expect(res.statusCode).toBe(404);
 });
});
