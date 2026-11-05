import Fastify from "fastify";
import {beforeEach,describe,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({
 role:"USER",owner:true,positionCalls:0,isolation:"",
 rows:[] as Array<{id:string;periodStart:string;periodEnd:string;dueDate:string;amountSatang:number}>,
 outstandingSatang:50000,
}));
const propertyId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const record={
 id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
 periodStart:"2026-10-01",periodEnd:"2026-10-31",dueDate:"2026-11-05",
 amountSatang:100000,
};
vi.mock("../src/db/client.js",()=>({
 db:{
  select:()=>({
   from(){return this;},where(){return this;},
   limit:async()=>state.owner?[{id:"member"}]:[],
  }),
  transaction:async(fn:(tx:unknown)=>Promise<unknown>,config:{isolationLevel:string})=>{
   state.isolation=config.isolationLevel;
   const tx={select:()=>({
    from(){return this;},where(){return this;},orderBy(){return this;},
    limit:async()=>state.rows,
   })};
   return fn(tx);
  },
 },
}));
vi.mock("../src/services/financial-position.js",()=>({
 getFinancialPosition:async()=>{
  state.positionCalls++;
  return {netManualApprovedSatang:40000,internalCreditSatang:10000,
   outstandingSatang:state.outstandingSatang};
 },
}));
vi.mock("../src/security.js",async(importOriginal)=>{
 const actual=await importOriginal<typeof import("../src/security.js")>();
 return {...actual,
  requireActor:async()=>({id:"actor-a",role:state.role}),
  requireProperty:async()=>({id:propertyId,organizationId:"org-a"}),
 };
});
import {registerReceivablesExportRoutes} from "../src/routes/receivables-export.js";
async function invoke(){
 const app=Fastify({logger:false});
 await registerReceivablesExportRoutes(app);
 const res=await app.inject({method:"GET",url:`/v1/properties/${propertyId}/receivables.csv`});
 await app.close();
 return res;
}
beforeEach(()=>{
 state.role="USER";state.owner=true;state.positionCalls=0;state.isolation="";
 state.rows=[{...record}];state.outstandingSatang=50000;
});
describe("P3 scoped receivables CSV export HTTP",()=>{
 it("exports only scoped invoice numbers using a repeatable-read transaction",async()=>{
  const res=await invoke();
  expect(res.statusCode).toBe(200);
  expect(res.headers["cache-control"]).toBe("no-store");
  expect(res.headers["content-disposition"]).toContain("attachment");
  expect(res.headers["content-type"]).toContain("text/csv");
  expect(res.body).toContain(record.id);
  expect(res.body).toContain("100000,40000,10000,50000");
  expect(state.isolation).toBe("repeatable read");
  expect(state.positionCalls).toBe(1);
 });
 it("denies non-owners without querying invoices or disclosing data",async()=>{
  state.owner=false;
  const res=await invoke();
  expect(res.statusCode).toBe(403);
  expect(state.positionCalls).toBe(0);
 });
 it("permits super-admin without an owner membership",async()=>{
  state.owner=false;state.role="SUPER_ADMIN";
  expect((await invoke()).statusCode).toBe(200);
 });
 it("fails closed rather than silently truncating exports over 500 records",async()=>{
  state.rows=Array.from({length:501},()=>({...record}));
  const res=await invoke();
  expect(res.statusCode).toBe(409);
  expect(state.positionCalls).toBe(0);
 });
 it("refuses to export inconsistent financial ledgers",async()=>{
  state.outstandingSatang=99999;
  const res=await invoke();
  expect(res.statusCode).toBeGreaterThanOrEqual(400);
  expect(res.headers["content-type"]).not.toContain("text/csv");
 });
});
