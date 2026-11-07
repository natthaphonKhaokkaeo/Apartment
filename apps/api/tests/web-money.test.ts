import {describe,it,expect} from "vitest";
import {parseSatang} from "../../web/src/money.js";
import {invoiceDocumentFilename,billAmount} from "../../web/src/invoice-document-export.js";
describe("browser decimal input to integer satang",()=>{
 it.each([["0",0],["0.01",1],["12.34",1234],["1.1",110],["21474836.47",2147483647]])("parses %s exactly",(value,want)=>expect(parseSatang(value)).toBe(want));
 it.each(["1.005","-1","1e3","NaN","Infinity","","21474836.48","9007199254740993","1.2.3"])("rejects invalid or overflowing %s",value=>expect(()=>parseSatang(value)).toThrow());
});

describe("private invoice document export filenames",()=>{
 it("creates safe PDF/PNG filenames and correct satang formatting",()=>{
  expect(invoiceDocumentFilename("A/101", "2026-11-01", "pdf")).toBe("invoice-A-101-2026-11-01.pdf");
  expect(invoiceDocumentFilename("A/101", "2026-11-01", "png")).toBe("invoice-A-101-2026-11-01.png");
  expect(billAmount(12345)).toBe("123.45");
 });
});
