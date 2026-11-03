import {describe,it,expect} from "vitest";
import {assertInvoiceStorageBounds,invoiceUtilityAmount} from "../src/services/billing.js";

describe("P1-05 invoice PostgreSQL integer bounds",()=>{
 const max=2_147_483_647;
 it("accepts exact int32 upper boundary with zero-cost utility",()=>{
  expect(()=>assertInvoiceStorageBounds([
   {amountSatang:max,unitsMilli:null},
   {amountSatang:0,unitsMilli:max}
  ],max)).not.toThrow();
 });
 it("rejects utility quantity over int32 even if the tariff is zero",()=>{
  expect(()=>assertInvoiceStorageBounds([
   {amountSatang:100,unitsMilli:null},
   {amountSatang:0,unitsMilli:max+1}
  ],100)).toThrow("METER_USAGE_OUT_OF_RANGE");
 });
 it("rejects fractional, negative and unsafe quantities",()=>{
  for(const unitsMilli of [-1,0.5,Number.MAX_SAFE_INTEGER+1]){
   expect(()=>assertInvoiceStorageBounds([{amountSatang:10,unitsMilli}],10)).toThrow("METER_USAGE_OUT_OF_RANGE");
  }
 });
 it("rejects total and line amounts beyond database int32 limits",()=>{
  expect(()=>assertInvoiceStorageBounds([{amountSatang:max+1,unitsMilli:null}],max+1))
   .toThrow("AMOUNT_OUT_OF_RANGE");
  expect(()=>assertInvoiceStorageBounds([{amountSatang:-1,unitsMilli:null}],-1))
   .toThrow("AMOUNT_OUT_OF_RANGE");
  expect(()=>assertInvoiceStorageBounds([{amountSatang:max,unitsMilli:null},{amountSatang:1,unitsMilli:null}],max+1))
   .toThrow("AMOUNT_OUT_OF_RANGE");
 });
 it("rejects mismatched sums without issuing an inconsistent snapshot",()=>{
  expect(()=>assertInvoiceStorageBounds([{amountSatang:99,unitsMilli:null}],100))
   .toThrow("AMOUNT_OUT_OF_RANGE");
 });
 it("maps unsafe utility multiplication to a bounded client error",()=>{
  expect(()=>invoiceUtilityAmount(Number.MAX_SAFE_INTEGER,max))
   .toThrow("AMOUNT_OUT_OF_RANGE");
 });
});
