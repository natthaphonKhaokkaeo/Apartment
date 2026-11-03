import PDFDocument from "pdfkit";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

export type BillingNoticeLine={
 type:string;
 description:string;
 amountSatang:number;
 unitsMilli:number|null;
 tariffSatang:number|null;
};
export type BillingNoticeInput={
 invoiceId:string;
 issueDate:Date;
 periodStart:string;
 periodEnd:string;
 dueDate:string;
 amountSatang:number;
 status:"ISSUED"|"VOID";
 issuerName:string;
 propertyName:string;
 propertyAddress:string;
 roomNumber:string;
 tenantName:string;
 snapshotSource:"ISSUED_SNAPSHOT"|"CURRENT_RECORD_LEGACY";
 lines:BillingNoticeLine[];
};

const FONT_DIR=new URL("../../node_modules/@expo-google-fonts/noto-sans-thai/",import.meta.url);
const fontNormal=readFileSync(fileURLToPath(new URL("400Regular/NotoSansThai_400Regular.ttf",FONT_DIR)));
const fontBold=readFileSync(fileURLToPath(new URL("700Bold/NotoSansThai_700Bold.ttf",FONT_DIR)));
const W=595.28,H=841.89,LEFT=47,RIGHT=548.28,WIDTH=RIGHT-LEFT;
const DARK="#14283B",GREY="#64748B",TEAL="#087F78",LINE="#DDE7ED",RED="#9C3B38",BG="#F7FAFC";
const fmt=(value:number)=> (value/100).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
function checkMoney(value:number){return Number.isSafeInteger(value)&&value>=0&&value<=2147483647;}
function dateLabel(day:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||Number.isNaN(Date.parse(day+"T00:00:00Z")))
  throw new Error("INVALID_BILL_DATE");
 const d=new Date(day+"T00:00:00Z");
 if(d.toISOString().slice(0,10)!==day)throw new Error("INVALID_BILL_DATE");
 return new Intl.DateTimeFormat("th-TH-u-nu-latn",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(d);
}
function previousDay(day:string){
 const d=new Date(day+"T00:00:00Z");d.setUTCDate(d.getUTCDate()-1);
 return d.toISOString().slice(0,10);
}
function bangkokIssueDay(timestamp:Date){
 return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(timestamp);
}
function ensureValid(b:BillingNoticeInput){
 if(b.status!=="ISSUED")throw new Error("BILLING_NOTICE_NOT_ISSUED");
 if(!checkMoney(b.amountSatang))throw new Error("INVALID_BILL_AMOUNT");
 if(!Array.isArray(b.lines)||b.lines.length===0)throw new Error("EMPTY_INVOICE_LINES");
 if(b.lines.length>300)throw new Error("TOO_MANY_INVOICE_LINES");
 if(!b.lines.every(l=>checkMoney(l.amountSatang)&&l.description?.trim()&&l.description.length<=450))
  throw new Error("INVALID_INVOICE_LINE");
 const sum=b.lines.reduce((acc,l)=>acc+l.amountSatang,0);
 if(!Number.isSafeInteger(sum)||sum!==b.amountSatang)throw new Error("INVOICE_LINE_SUM_MISMATCH");
 if(!b.invoiceId||!b.issuerName?.trim()||!b.propertyName?.trim()||
   !b.roomNumber?.trim()||!b.tenantName?.trim()||!Number.isFinite(b.issueDate.getTime()))
  throw new Error("INVALID_DOCUMENT_METADATA");
 if(b.periodStart>=b.periodEnd)throw new Error("INVALID_BILL_PERIOD");
 [b.periodStart,b.periodEnd,b.dueDate].forEach(dateLabel);
}
function label(d:PDFKit.PDFDocument,value:string,x:number,y:number,opts:PDFKit.Mixins.TextOptions={}){
 d.font("NotoThai").fontSize(8.5).fillColor(GREY).text(value,x,y,{lineBreak:false,...opts});
}
function bold(d:PDFKit.PDFDocument,value:string,x:number,y:number,opts:PDFKit.Mixins.TextOptions={}){
 d.font("NotoThaiBold").fontSize(10).fillColor(DARK).text(value,x,y,{lineBreak:false,...opts});
}
function background(d:PDFKit.PDFDocument){
 d.rect(0,0,W,H).fill("#FFFFFF");
 d.rect(0,0,W,7).fill(TEAL);
}
function rowHeader(d:PDFKit.PDFDocument,y:number){
 d.roundedRect(LEFT,y,WIDTH,32,7).fill(DARK);
 d.font("NotoThaiBold").fontSize(9).fillColor("#FFFFFF");
 d.text("รายการ",LEFT+13,y+8,{width:258,lineBreak:false});
 d.text("จำนวน",LEFT+283,y+8,{width:63,align:"right",lineBreak:false});
 d.text("อัตรา",LEFT+350,y+8,{width:60,align:"right",lineBreak:false});
 d.text("ยอดเงิน (บาท)",LEFT+414,y+8,{width:76,align:"right",lineBreak:false});
}
function headerFirst(d:PDFKit.PDFDocument,b:BillingNoticeInput){
 background(d);
 d.roundedRect(LEFT,31,WIDTH,96,14).fill(DARK);
 d.roundedRect(LEFT,31,6,96,3).fill("#39C5AE");
 d.font("NotoThaiBold").fontSize(22).fillColor("#FFFFFF").text("ใบแจ้งหนี้",LEFT+22,48,{lineBreak:false});
 d.font("NotoThai").fontSize(10).fillColor("#BBEAE1").text("BILLING NOTICE",LEFT+23,91,{lineBreak:false});
 d.font("NotoThai").fontSize(9).fillColor("#F0F6FA").text("เลขที่เอกสาร",LEFT+294,53,{lineBreak:false});
 d.font("NotoThai").fontSize(8).fillColor("#FFFFFF").text(b.invoiceId,LEFT+294,75,{width:188,lineBreak:false});
 d.roundedRect(LEFT,140,WIDTH,37,6).fill("#FFF2E7");
 d.font("NotoThaiBold").fontSize(10).fillColor(RED)
  .text("เอกสารนี้ไม่ใช่ใบเสร็จรับเงินหรือใบกำกับภาษี",LEFT+14,151,{width:WIDTH-28,lineBreak:false});
 const y=195;
 label(d,"ผู้เรียกเก็บ / หอพัก",LEFT,y);
 label(d,"ผู้พักอาศัย",LEFT+265,y);
 d.font("NotoThaiBold").fontSize(10);
 const nameHeight=Math.max(23,
  d.heightOfString(b.issuerName,{width:240,lineGap:1}),
  d.heightOfString(b.tenantName,{width:225,lineGap:1}));
 if(nameHeight>110)throw new Error("DOCUMENT_METADATA_TOO_LONG");
 d.font("NotoThaiBold").fontSize(10).fillColor(DARK)
  .text(b.issuerName,LEFT,y+19,{width:240,lineGap:1});
 d.font("NotoThaiBold").fontSize(10).fillColor(DARK)
  .text(b.tenantName,LEFT+265,y+19,{width:225,lineGap:1});
 const propertyY=y+19+nameHeight+1;
 d.font("NotoThai").fontSize(8.5);
 const propertyHeight=Math.max(
  d.heightOfString(b.propertyName,{width:245,lineGap:1}),
  d.heightOfString("ห้อง "+b.roomNumber,{width:220,lineGap:1}),15);
 if(propertyHeight>100)throw new Error("DOCUMENT_METADATA_TOO_LONG");
 d.font("NotoThai").fontSize(8.5).fillColor(GREY)
  .text(b.propertyName,LEFT,propertyY,{width:245,lineGap:1});
 d.font("NotoThai").fontSize(8.5).fillColor(GREY)
  .text("ห้อง "+b.roomNumber,LEFT+265,propertyY,{width:220,lineGap:1});
 const addressY=propertyY+propertyHeight+6;
 let addressHeight=0;
 if(b.propertyAddress){
  d.font("NotoThai").fontSize(8.5);
  addressHeight=d.heightOfString(b.propertyAddress,{width:245,lineGap:1});
  if(addressHeight>100)throw new Error("DOCUMENT_METADATA_TOO_LONG");
  d.font("NotoThai").fontSize(8.5).fillColor(GREY)
   .text(b.propertyAddress,LEFT,addressY,{width:245,lineGap:1});
 }
 const dividerY=addressY+Math.max(addressHeight,24)+16;
 d.moveTo(LEFT,dividerY).lineTo(RIGHT,dividerY).lineWidth(1).strokeColor(LINE).stroke();
 const y2=dividerY+11;
 label(d,"วันที่ออกบิล",LEFT,y2);
 label(d,"รอบค่าใช้จ่าย",LEFT+157,y2);
 label(d,"ครบกำหนดชำระ",LEFT+344,y2);
 bold(d,dateLabel(bangkokIssueDay(b.issueDate)),LEFT,y2+17,{width:144});
 bold(d,dateLabel(b.periodStart)+" - "+dateLabel(previousDay(b.periodEnd)),LEFT+157,y2+17,{width:178});
 bold(d,dateLabel(b.dueDate),LEFT+344,y2+17,{width:155});
 if(b.snapshotSource==="CURRENT_RECORD_LEGACY"){
  d.roundedRect(LEFT,y2+46,WIDTH,31,5).fill("#FEF3C7");
  d.font("NotoThai").fontSize(8.5).fillColor("#775E14")
   .text("บิลเดิม: ชื่อและที่อยู่อ้างอิงข้อมูลปัจจุบัน (ไม่มีข้อมูลบันทึก ณ วันออกบิล)",LEFT+10,y2+56,{width:WIDTH-20,lineBreak:false});
 }
 return b.snapshotSource==="CURRENT_RECORD_LEGACY"?y2+94:y2+64;
}
function continuation(d:PDFKit.PDFDocument,b:BillingNoticeInput,index:number){
 background(d);
 d.font("NotoThaiBold").fontSize(14).fillColor(TEAL)
  .text("ใบแจ้งหนี้ - รายการต่อเนื่อง",LEFT,32,{lineBreak:false});
 d.font("NotoThai").fontSize(8).fillColor(GREY)
  .text("เลขที่เอกสาร: "+b.invoiceId,LEFT,61,{lineBreak:false});
 return 86;
}
function footer(d:PDFKit.PDFDocument,page:number,total:number,invoiceId:string){
 const y=H-72;
 d.moveTo(LEFT,y).lineTo(RIGHT,y).strokeColor(LINE).stroke();
 d.font("NotoThai").fontSize(8).fillColor(GREY)
  .text("ข้อมูลจากรายการบิลที่ออกแล้ว • ไม่ใช่หลักฐานการรับเงิน",LEFT,y+12,{width:365,lineBreak:false});
 d.font("NotoThai").fontSize(8).fillColor(GREY)
  .text("หน้า "+page+" / "+total,RIGHT-85,y+12,{width:85,align:"right",lineBreak:false});
 d.font("NotoThai").fontSize(7).fillColor(GREY)
  .text(invoiceId,LEFT,y+34,{width:WIDTH,lineBreak:false});
}
/** Informational notice only; does not create or authorize a tax invoice / official receipt. */
export async function renderBillingNotice(b:BillingNoticeInput):Promise<Buffer>{
 ensureValid(b);
 return new Promise((resolve,reject)=>{
  const d=new PDFDocument({
   size:"A4",margins:{top:0,bottom:0,left:0,right:0},
   bufferPages:true,autoFirstPage:false,compress:true,
   info:{Title:"Billing Notice "+b.invoiceId,Author:"Apartment",Subject:"Non-tax billing notice, not payment receipt",CreationDate:b.issueDate,ModDate:b.issueDate}
  });
  const chunks:Buffer[]=[];
  d.on("data",part=>chunks.push(Buffer.from(part)));
  d.on("end",()=>resolve(Buffer.concat(chunks)));
  d.on("error",reject);
  try{
   d.registerFont("NotoThai",fontNormal);
   d.registerFont("NotoThaiBold",fontBold);
   d.addPage();
   let y=headerFirst(d,b);
   if(y>H-235){d.addPage();y=continuation(d,b,0);}
   rowHeader(d,y);
   y+=40;
   for(const [index,line] of b.lines.entries()){
    // Height is computed by the same embedded font used to actually render.
    d.font("NotoThai").fontSize(9.5);
    const descHeight=d.heightOfString(line.description,{width:260,lineGap:2});
    const rh=Math.max(41,Math.ceil(descHeight+20));
    if(rh>440)throw new Error("INVOICE_LINE_TOO_TALL");
    if(y+rh>H-185){
     d.addPage();
     y=continuation(d,b,index);
     rowHeader(d,y);
     y+=40;
    }
    if(index%2===0)d.rect(LEFT,y-2,WIDTH,rh).fill(BG);
    d.font("NotoThai").fontSize(9.5).fillColor(DARK)
      .text(line.description,LEFT+13,y+10,{width:260,lineGap:2});
    const units=line.unitsMilli===null?"-":(line.unitsMilli/1000).toLocaleString("en-US",{minimumFractionDigits:3,maximumFractionDigits:3});
    const rate=line.tariffSatang===null?"-":fmt(line.tariffSatang);
    label(d,units,LEFT+283,y+11,{width:63,align:"right"});
    label(d,rate,LEFT+350,y+11,{width:60,align:"right"});
    bold(d,fmt(line.amountSatang),LEFT+414,y+10,{width:76,align:"right"});
    y+=rh;
   }
   if(y+122>H-83){d.addPage();y=continuation(d,b,b.lines.length);}
   d.moveTo(LEFT,y+8).lineTo(RIGHT,y+8).lineWidth(1).strokeColor(LINE).stroke();
   d.roundedRect(LEFT+248,y+22,WIDTH-248,62,9).fill("#E4F6F1");
   label(d,"ยอดรวมเรียกเก็บ (บาท)",LEFT+261,y+30,{width:204});
   d.font("NotoThaiBold").fontSize(20).fillColor(TEAL)
    .text("฿"+fmt(b.amountSatang),LEFT+261,y+47,{width:WIDTH-274,align:"right",lineBreak:false});
   d.font("NotoThai").fontSize(8).fillColor(GREY)
    .text("กรุณาตรวจสอบช่องทางชำระเงินล่าสุดจากระบบก่อนโอนเงิน",LEFT,y+96,{width:WIDTH,lineBreak:false});
   const range=d.bufferedPageRange();
   for(let n=range.start;n<range.start+range.count;n++){
    d.switchToPage(n);
    footer(d,n-range.start+1,range.count,b.invoiceId);
   }
   d.end();
  }catch(e){reject(e);d.end();}
 });
}
