/** Local-only invoice image export. No third-party screenshot server receives customer data. */
export type InvoicePicture={
 id:string;periodStart:string;periodEnd:string;dueDate:string;amountSatang:number;
 documentSnapshot?:{issuerName:string;propertyName:string;propertyAddress:string;roomNumber:string;tenantName:string}|null;
 lines:{type:string;description:string;amountSatang:number;unitsMilli?:number|null;tariffSatang?:number|null}[];
};
export const billAmount=(satang:number)=>new Intl.NumberFormat("th-TH",{
 minimumFractionDigits:2,maximumFractionDigits:2
}).format(satang/100);
export const invoiceDocumentFilename=(roomNumber:string,start:string,extension:"pdf"|"png")=>
 `invoice-${roomNumber.replace(/[^a-zA-Z0-9ก-๙_-]/g,"-").slice(0,24)}-${start}.${extension}`;

function splitText(ctx:CanvasRenderingContext2D,value:string,maxWidth:number){
 const segmenter=typeof Intl.Segmenter==="function"?new Intl.Segmenter("th",{granularity:"word"}):null;
 const tokens=segmenter?[...segmenter.segment(value)].map(x=>x.segment):Array.from(value);
 const rows:string[]=[];let line="";
 for(const piece of tokens){
  if(ctx.measureText(line+piece).width>maxWidth&&line){rows.push(line.trim());line="";}
  // Long identifiers must also fit without truncating the financial details.
  if(ctx.measureText(piece).width>maxWidth){
   for(const char of Array.from(piece)){
    if(ctx.measureText(line+char).width>maxWidth&&line){rows.push(line.trim());line="";}
    line+=char;
   }
  }else line+=piece;
 }
 if(line.trim())rows.push(line.trim());
 return rows.length?rows:["-"];
}

/** Creates a downloadable PNG from the server's immutable issued invoice lines. */
export async function renderInvoicePng(data:InvoicePicture,propertyName:string,roomNumber:string,tenantName?:string):Promise<Blob>{
 if(!data.lines.length||!Number.isSafeInteger(data.amountSatang))throw new Error("INVOICE_DOCUMENT_INVALID");
 await document.fonts?.ready;
 const width=1080,left=70,right=1010;
 const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
 if(!ctx)throw new Error("CANVAS_UNAVAILABLE");
 ctx.font='26px "Noto Sans Thai",sans-serif';
 const blocks=data.lines.map(l=>({line:l,words:splitText(ctx,l.type==="NOTE"?`หมายเหตุ: ${l.description}`:l.description,650)}));
 const snap=data.documentSnapshot;
 const fields=[
  `หอพัก: ${snap?.propertyName||propertyName}`,
  `ผู้ออกเอกสาร: ${snap?.issuerName||propertyName}`,
  ...(snap?.propertyAddress?[`ที่อยู่: ${snap.propertyAddress}`]:[]),
  `ห้อง: ${snap?.roomNumber||roomNumber}`,
  `ผู้เช่า: ${snap?.tenantName||tenantName||"ตรวจสอบกับเจ้าของหอพัก"}`,
  `รอบบิล: ${data.periodStart} ถึง ${data.periodEnd} (ไม่รวมวันสิ้นสุด)`,
  `ครบกำหนด: ${data.dueDate}`,
  `เลขอ้างอิง: ${data.id}`,
  ...(!snap?["เอกสารย้อนหลัง: ข้อมูลชื่อและที่อยู่อาจอ้างอิงข้อมูลปัจจุบัน"]:[])
 ];
 const metadataHeight=fields.reduce((total,field)=>total+35*splitText(ctx,field,940).length,0);
 const height=Math.max(1050,500+metadataHeight+blocks.reduce((total,b)=>total+Math.max(62,b.words.length*34+28),0));
 if(height>16000)throw new Error("INVOICE_IMAGE_TOO_LONG");
 canvas.width=width;canvas.height=height;
 ctx.fillStyle="#ffffff";ctx.fillRect(0,0,width,height);
 ctx.fillStyle="#102a43";ctx.font='bold 43px "Noto Sans Thai",sans-serif';
 ctx.fillText("ใบแจ้งหนี้",left,95);
 ctx.font='24px "Noto Sans Thai",sans-serif';
 ctx.fillText("BILLING NOTICE · ไม่ใช่ใบเสร็จรับเงินหรือใบกำกับภาษี",left,135);
 ctx.strokeStyle="#d5dee8";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,161);ctx.lineTo(right,161);ctx.stroke();
 ctx.fillStyle="#243b53";ctx.font='25px "Noto Sans Thai",sans-serif';
 let y=205;
 for(const field of fields){
  for(const line of splitText(ctx,field,940)){ctx.fillText(line,left,y);y+=35;}
 }
 y+=22;ctx.fillStyle="#edf2f7";ctx.fillRect(left,y-40,right-left,56);
 ctx.fillStyle="#102a43";ctx.font='bold 27px "Noto Sans Thai",sans-serif';
 ctx.fillText("รายละเอียด",left+15,y);ctx.textAlign="right";ctx.fillText("บาท",right-16,y);ctx.textAlign="left";
 y+=38;ctx.font='25px "Noto Sans Thai",sans-serif';
 for(const item of blocks){
  const rows=item.words;
  ctx.fillStyle="#243b53";for(const line of rows){ctx.fillText(line,left+15,y);y+=34;}
  ctx.fillStyle="#102a43";ctx.textAlign="right";
  ctx.fillText(item.line.type==="NOTE"?"-":billAmount(item.line.amountSatang),right-16,y-(rows.length*34));
  ctx.textAlign="left";y+=28;
  ctx.strokeStyle="#e8eef4";ctx.beginPath();ctx.moveTo(left,y-13);ctx.lineTo(right,y-13);ctx.stroke();
 }
 y+=20;ctx.fillStyle="#edf2f7";ctx.fillRect(left,y-39,right-left,66);
 ctx.fillStyle="#102a43";ctx.font='bold 31px "Noto Sans Thai",sans-serif';ctx.fillText("ยอดเรียกเก็บ",left+15,y+6);
 ctx.textAlign="right";ctx.fillText(`฿${billAmount(data.amountSatang)}`,right-16,y+6);ctx.textAlign="left";
 ctx.font='22px "Noto Sans Thai",sans-serif';ctx.fillStyle="#627d98";
 ctx.fillText("กรุณาตรวจสอบข้อมูลก่อนชำระเงิน เอกสารนี้ไม่ยืนยันการรับชำระเงิน",left,height-95);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("IMAGE_EXPORT_FAILED")),"image/png"));
}

export function downloadInvoiceFile(blob:Blob,filename:string){
 const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30_000);
}
