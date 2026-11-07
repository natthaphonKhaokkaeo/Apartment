import {describe,expect,it} from "vitest";
import {invoiceNoteLine,optionalInvoiceNote} from "../src/services/invoice-note.js";

describe("optional custom invoice note",()=>{
 it("allows an invoice without a note",()=>{
  expect(optionalInvoiceNote.parse(undefined)).toBeUndefined();
  expect(invoiceNoteLine(undefined)).toBeNull();
 });
 it("stores customer-facing text as an immutable zero-charge invoice line",()=>{
  expect(invoiceNoteLine("  ฝากชำระก่อนสิ้นเดือน  ")).toMatchObject({type:"NOTE",amountSatang:0,description:"ฝากชำระก่อนสิ้นเดือน"});
 });
 it("limits note size and rejects control characters",()=>{
  expect(()=>optionalInvoiceNote.parse("a".repeat(301))).toThrow();
  expect(()=>optionalInvoiceNote.parse("abc\u0000def")).toThrow();
 });
});
