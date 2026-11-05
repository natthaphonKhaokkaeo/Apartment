import {beforeEach,describe,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({
 bill:[{amountSatang:500000}] as Array<{amountSatang:number}>,
 payments:[{amount:300000}] as Array<{amount:number}>,
 adjustments:[
  {kind:"REVERSE_MANUAL_PAYMENT",amount:100000},
  {kind:"INTERNAL_CREDIT",amount:50000},
 ] as Array<{kind:string;amount:number}>,
}));
vi.mock("../src/db/client.js",()=>({
 db:{
  select:(shape:Record<string,unknown>)=>{
   const key="amountSatang" in shape?"bill":"kind" in shape?"adjustments":"payments";
   return {
    from(){return this;},
    where(){return key==="bill"?{limit:async()=>state.bill}:
      Promise.resolve(key==="payments"?state.payments:state.adjustments);},
   };
  },
 },
}));
import {getFinancialPosition} from "../src/services/financial-position.js";
beforeEach(()=>{
 state.bill=[{amountSatang:500000}];
 state.payments=[{amount:300000}];
 state.adjustments=[
  {kind:"REVERSE_MANUAL_PAYMENT",amount:100000},
  {kind:"INTERNAL_CREDIT",amount:50000},
 ];
});
describe("P3/P0 financial-position DB aggregation",()=>{
 it("combines approved ledger, reversals and credits without mutating entries",async()=>{
  expect(await getFinancialPosition("invoice-a")).toEqual({
   grossManualApprovedSatang:300000,
   reversedManualSatang:100000,
   netManualApprovedSatang:200000,
   internalCreditSatang:50000,
   totalAppliedSatang:250000,
   outstandingSatang:250000,
  });
 });
 it("does not miscount a fully paid invoice",async()=>{
  state.payments=[{amount:200000},{amount:300000}];
  state.adjustments=[];
  expect((await getFinancialPosition("invoice-a")).outstandingSatang).toBe(0);
 });
 it("denies access to a non-existing invoice",async()=>{
  state.bill=[];
  await expect(getFinancialPosition("missing")).rejects.toMatchObject({
   statusCode:404,code:"INVOICE_NOT_FOUND",
  });
 });
 it("fails closed when reversals exceed the approved ledger",async()=>{
  state.adjustments=[{kind:"REVERSE_MANUAL_PAYMENT",amount:300001}];
  await expect(getFinancialPosition("invoice-a")).rejects.toMatchObject({
   statusCode:409,code:"FINANCIAL_LEDGER_INCONSISTENT",
  });
 });
 it("fails closed when credit and ledger overapply",async()=>{
  state.adjustments=[{kind:"INTERNAL_CREDIT",amount:250000}];
  await expect(getFinancialPosition("invoice-a")).rejects.toMatchObject({
   statusCode:409,code:"FINANCIAL_LEDGER_INCONSISTENT",
  });
 });
 it("rejects negative ledger entries",async()=>{
  state.payments=[{amount:-1}];
  await expect(getFinancialPosition("invoice-a")).rejects.toMatchObject({
   statusCode:409,code:"FINANCIAL_LEDGER_INCONSISTENT",
  });
 });
 it("ignores adjustment kinds not eligible for net position",async()=>{
  state.adjustments=[{kind:"IGNORED",amount:100000}];
  expect((await getFinancialPosition("invoice-a")).outstandingSatang).toBe(200000);
 });
});
