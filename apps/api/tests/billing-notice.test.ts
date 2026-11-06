import {describe,it,expect} from "vitest";
import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs";
import {renderBillingNotice, type BillingNoticeInput} from "../src/services/billing-notice-pdf.js";

const bill:BillingNoticeInput={
 invoiceId:"a13d8b2b-1d85-48df-9a4e-29c5c3013d2f",
 issueDate:new Date("2026-11-03T09:15:00.000Z"),
 periodStart:"2026-11-01",periodEnd:"2026-12-01",dueDate:"2026-12-07",
 amountSatang:413000,status:"ISSUED",
 issuerName:"บริษัท บ้านสุขใจ",propertyName:"หอพักบ้านสุขใจ",
 propertyAddress:"123/45 ถนนประชาอุทิศ กรุงเทพมหานคร",
 roomNumber:"A-101",tenantName:"คุณสมหญิง ใจดี",
 snapshotSource:"ISSUED_SNAPSHOT",
 lines:[
  {type:"RENT",description:"ค่าเช่าห้อง",amountSatang:400000,unitsMilli:null,tariffSatang:null},
  {type:"WATER",description:"ค่าน้ำ",amountSatang:9000,unitsMilli:5000,tariffSatang:1800},
  {type:"ELECTRIC",description:"ค่าไฟ",amountSatang:4000,unitsMilli:10000,tariffSatang:400}
 ]
};
async function textFrom(b:Buffer){
 const doc=await getDocument({data:new Uint8Array(b),useSystemFonts:false}).promise;
 const pages:string[]=[];
 for(let n=1;n<=doc.numPages;n++){
  const content=await (await doc.getPage(n)).getTextContent();
  pages.push(content.items.map(i=>"str" in i?i.str:"").join(" "));
 }
 return {pages,text:pages.join("\n")};
}
describe("P3-05b informational Billing Notice",()=>{
 it("renders A4 Thai PDF with immutable line values and explicit no-receipt disclaimer",async()=>{
  const result=await renderBillingNotice(bill);
  expect(result.subarray(0,5).toString()).toBe("%PDF-");
  expect(result.length).toBeGreaterThan(5000);
  const data=await textFrom(result);
  expect(data.pages).toHaveLength(1);
  expect(data.text).toContain("ใบแจ้งหนี้");
  expect(data.text).toContain("ไม่ใช่ใบเสร็จรับเงิน");
  expect(data.text).toContain("บริษัท บ้านสุขใจ");
  expect(data.text).toContain("A-101");
  expect(data.text).toContain("4,130.00");
  expect(data.text).toContain("4,000.00");
  expect(data.text).not.toContain("VAT 7%");
 });
 it("clearly labels legacy invoice metadata and can paginate long descriptions",async()=>{
  const entries=Array.from({length:70},(_,i)=>({
   type:"OTHER",description:"ค่าบริการเพิ่มเติมสำหรับผู้พักอาศัย รายการที่ "+(i+1),amountSatang:1000,
   unitsMilli:null,tariffSatang:null
  }));
  const legacy={...bill,amountSatang:70000,lines:entries,snapshotSource:"CURRENT_RECORD_LEGACY" as const};
  const output=await renderBillingNotice(legacy);
  const pages=await textFrom(output);
  expect(pages.pages.length).toBeGreaterThan(1);
  expect(pages.text).toContain("ข้อมูลปัจจุบัน");
  expect(pages.text).toContain("700.00");
 });
 it("allows a negative correction line while requiring a positive final invoice",async()=>{
  const corrected:BillingNoticeInput={...bill,amountSatang:411750,
   lines:[...bill.lines,{type:"CORRECTION",description:"ส่วนลดแก้บิลเดิม",amountSatang:-1250,
    unitsMilli:null,tariffSatang:null}]};
  const document=await textFrom(await renderBillingNotice(corrected));
  expect(document.text).toContain("ส่วนลดแก้บิลเดิม");
  expect(document.text).toContain("4,117.50");
  expect(document.text).toContain("-12.50");
  await expect(renderBillingNotice({...corrected,lines:[...bill.lines,{...corrected.lines[3],type:"WATER"}]}))
   .rejects.toThrow("INVALID_INVOICE_LINE");
 });
 it("never renders inconsistent or negative invoice totals",async()=>{
  await expect(renderBillingNotice({...bill,amountSatang:413001})).rejects.toThrow("INVOICE_LINE_SUM_MISMATCH");
  await expect(renderBillingNotice({...bill,amountSatang:-1})).rejects.toThrow("INVALID_BILL_AMOUNT");
  await expect(renderBillingNotice({...bill,lines:[]})).rejects.toThrow("EMPTY_INVOICE_LINES");
  await expect(renderBillingNotice({...bill,status:"VOID"})).rejects.toThrow("BILLING_NOTICE_NOT_ISSUED");
  await expect(renderBillingNotice({...bill,dueDate:"2026-02-31"})).rejects.toThrow("INVALID_BILL_DATE");
 });
});
