import {describe,it,expect} from "vitest";
import {assertReissueAllowed,correctedInvoiceTotal} from "../src/services/invoice-reissue-policy.js";
const clean={status:"ISSUED" as const,claimCount:0,ledgerCount:0,adjustmentCount:0,evidenceCount:0,sendingCount:0};
describe("invoice correction financial safety",()=>{
 it("allows an untouched issued invoice",()=>expect(()=>assertReissueAllowed(clean)).not.toThrow());
 it("blocks a void invoice",()=>expect(()=>assertReissueAllowed({...clean,status:"VOID"})).toThrow());
 for(const field of ["claimCount","ledgerCount","adjustmentCount","evidenceCount","sendingCount"] as const){
  it(`blocks invoices with ${field}`,()=>expect(()=>assertReissueAllowed({...clean,[field]:1})).toThrow());
 }
 it("supports price correction in satang",()=>{expect(correctedInvoiceTotal(50000,-1250)).toBe(48750);expect(correctedInvoiceTotal(50000,1250)).toBe(51250);});
 it("blocks zero, negative and overflow totals",()=>{
  expect(()=>correctedInvoiceTotal(1000,-1000)).toThrow();
  expect(()=>correctedInvoiceTotal(1000,-2000)).toThrow();
  expect(()=>correctedInvoiceTotal(2147483647,1)).toThrow();
 });
});
