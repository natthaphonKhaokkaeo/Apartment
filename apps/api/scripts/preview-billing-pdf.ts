import {writeFile} from "node:fs/promises";
import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs";
import {createCanvas} from "@napi-rs/canvas";
import {renderBillingNotice,type BillingNoticeInput} from "../src/services/billing-notice-pdf.js";
const data:BillingNoticeInput={
 invoiceId:"a13d8b2b-1d85-48df-9a4e-29c5c3013d2f",
 issueDate:new Date("2026-11-03T09:15:00.000Z"),
 periodStart:"2026-11-01",periodEnd:"2026-12-01",dueDate:"2026-12-07",
 amountSatang:413000,status:"ISSUED",issuerName:"บริษัท บ้านสุขใจ",
 propertyName:"หอพักบ้านสุขใจ",propertyAddress:"123/45 ถนนประชาอุทิศ กรุงเทพมหานคร 10140",
 roomNumber:"A-101",tenantName:"คุณสมหญิง ใจดี",snapshotSource:"ISSUED_SNAPSHOT",
 lines:[
 {type:"RENT",description:"ค่าเช่าห้อง",amountSatang:400000,unitsMilli:null,tariffSatang:null},
 {type:"WATER",description:"ค่าน้ำ",amountSatang:9000,unitsMilli:5000,tariffSatang:1800},
 {type:"ELECTRIC",description:"ค่าไฟ",amountSatang:4000,unitsMilli:10000,tariffSatang:400}
 ]
};
const long=process.argv.includes("--long");
if(long){
 data.lines=Array.from({length:70},(_,i)=>({type:"OTHER",description:"ค่าบริการเพิ่มเติมสำหรับผู้พักอาศัย รายการที่ "+(i+1),amountSatang:1000,unitsMilli:null,tariffSatang:null}));
 data.amountSatang=70000;
 data.snapshotSource="CURRENT_RECORD_LEGACY";
}
const pdf=await renderBillingNotice(data);
await writeFile("/tmp/apartment-billing-notice-preview"+(long?"-long":"")+".pdf",pdf);
const loaded=await getDocument({data:new Uint8Array(pdf),useSystemFonts:false}).promise;
const page=await loaded.getPage(long?loaded.numPages:1);
const viewport=page.getViewport({scale:1.6});
const canvas=createCanvas(Math.floor(viewport.width),Math.floor(viewport.height));
await page.render({
 canvasContext:canvas.getContext("2d") as unknown as CanvasRenderingContext2D,
 viewport,canvas:canvas as unknown as HTMLCanvasElement
}).promise;
await writeFile("/tmp/apartment-billing-notice-preview"+(long?"-long":"")+".png",canvas.toBuffer("image/png"));
console.log("Preview rendered:",loaded.numPages,"pages,",pdf.length,"PDF bytes,",canvas.width,"x",canvas.height);
