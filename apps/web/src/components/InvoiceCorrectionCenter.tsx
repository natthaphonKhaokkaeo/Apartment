import {useCallback,useEffect,useState} from "react";
import {RefreshCw,TriangleAlert} from "lucide-react";

type Invoice={id:string;roomNumber:string;periodStart:string;periodEnd:string;
 amountSatang:number;status:"ISSUED"|"VOID";replacesInvoiceId:string|null;
 voidReason:string|null;createdAt:string};
type Preview={previewHash:string;originalAmountSatang:number;amountSatang:number;
 lines:Array<{description:string;amountSatang:number}>;periodStart:string;periodEnd:string};
type Props={propertyId:string;api:<T>(path:string,options?:RequestInit)=>Promise<T>;
 post:<T>(path:string,body:unknown,headers?:HeadersInit)=>Promise<T>;onIssued:()=>Promise<void>};
const money=(satang:number)=>"฿"+(satang/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
const message=(error:unknown)=>{
 const code=(error as Error)?.message??"";
 if(code.includes("INVOICE_HAS_PAYMENT_ACTIVITY"))return "บิลนี้มีรายการชำระเงิน หลักฐานโอน หรือรายการการเงินที่เกี่ยวข้อง ต้องเคลียร์ยอดผ่านระบบการเงินก่อน";
 if(code.includes("LINE_NOTIFICATION_IN_FLIGHT"))return "กำลังส่ง LINE แจ้งบิลเดิม กรุณาลองใหม่เมื่อการส่งเสร็จสิ้น";
 if(code.includes("PREVIEW_STALE"))return "ข้อมูลใบแจ้งหนี้เปลี่ยนแล้ว กรุณาตรวจสอบยอดใหม่";
 return code||"เกิดข้อผิดพลาด กรุณาลองใหม่";
};
export function InvoiceCorrectionCenter({propertyId,api,post,onIssued}:Props){
 const [invoices,setInvoices]=useState<Invoice[]>([]),[selected,setSelected]=useState<Invoice|null>(null);
 const [reason,setReason]=useState(""),[adjustmentBaht,setAdjustmentBaht]=useState("0.00");
 const [preview,setPreview]=useState<Preview|null>(null),[retryKey,setRetryKey]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const path=`/properties/${propertyId}`;
 const reload=useCallback(async()=>setInvoices(await api<Invoice[]>(`${path}/invoice-corrections`)),[api,path]);
 useEffect(()=>{void reload().catch(e=>setError(message(e)));},[reload]);
 function adjustmentSatang(){
  if(!/^-?\d+(?:\.\d{1,2})?$/.test(adjustmentBaht.trim()))throw new Error("กรอกยอดปรับปรุงเป็นบาท ทศนิยมไม่เกิน 2 ตำแหน่ง");
  const amount=Math.round(Number(adjustmentBaht)*100);
  if(!Number.isSafeInteger(amount)||Math.abs(amount)>2147483647)throw new Error("ยอดปรับปรุงไม่ถูกต้อง");
  return amount;
 }
 async function inspect(){
  if(!selected)return;
  setBusy(true);setError("");setSuccess("");setPreview(null);
  try{
   const response=await post<Preview>(`${path}/invoices/${selected.id}/reissue-preview`,{reason:reason.trim(),adjustmentSatang:adjustmentSatang()});
   setPreview(response);setRetryKey(crypto.randomUUID());
  }catch(e){setError(message(e));}finally{setBusy(false);}
 }
 async function confirm(){
  if(!selected||!preview||!retryKey)return;
  if(!window.confirm(`ยืนยันยกเลิกบิลเดิมและออกบิลฉบับแก้ไขห้อง ${selected.roomNumber} ยอด ${money(preview.amountSatang)}? ระบบเก็บประวัติเดิมและไม่สามารถลบได้`))return;
  setBusy(true);setError("");setSuccess("");
  try{
   await post(`${path}/invoices/${selected.id}/reissue`,{reason:reason.trim(),adjustmentSatang:adjustmentSatang(),previewHash:preview.previewHash,confirmed:true},{"idempotency-key":retryKey});
   await reload();await onIssued();setSelected(null);setPreview(null);setReason("");setAdjustmentBaht("0.00");
   setSuccess("ออกบิลฉบับแก้ไขสำเร็จ บิลเดิมเปลี่ยนเป็นยกเลิกแล้ว ระบบเก็บประวัติไว้ครบถ้วน");
  }catch(e){setError(message(e));}finally{setBusy(false);}
 }
 return <section className="panel" aria-label="แก้ไขและออกบิลทดแทน">
  <div className="panel-head"><div><h2>แก้ไขและออกบิลใหม่</h2>
   <p>แก้ไขบิลที่ออกผิดได้โดยไม่ลบประวัติ · เฉพาะ OWNER และบิลที่ไม่มีรายการชำระเงินหรือหลักฐานโอน</p></div>
   <button className="btn outline" type="button" disabled={busy} onClick={()=>void reload()}><RefreshCw size={15}/> โหลดบิลล่าสุด</button></div>
  {error&&<p className="notice danger" role="alert">{error}</p>}{success&&<p className="notice success" role="status">{success}</p>}
  <div className="claim-list"><h3>ขั้นที่ 1 เลือกบิลที่ต้องการแก้ไข</h3>
   {invoices.map(invoice=><button className="claim-item" type="button" key={invoice.id}
    disabled={busy||invoice.status!=="ISSUED"} onClick={()=>{setSelected(invoice);setPreview(null);setError("");setSuccess("");setReason("");setAdjustmentBaht("0.00");}}>
    <span><b>ห้อง {invoice.roomNumber} · {invoice.periodStart} – {invoice.periodEnd}</b>
     <small>{invoice.replacesInvoiceId?"บิลฉบับแก้ไข":"บิลเดิม"} · {new Date(invoice.createdAt).toLocaleString("th-TH")}</small></span>
    <span>{money(invoice.amountSatang)} · {invoice.status==="VOID"?"ยกเลิกแล้ว":"เลือกแก้ไข"}</span></button>)}
   {invoices.length===0&&<p>ยังไม่มีบิลของหอพักนี้</p>}
  </div>
  {selected&&<div className="form"><h3>ขั้นที่ 2 ตรวจสอบยอดและระบุเหตุผล · ห้อง {selected.roomNumber}</h3>
   <p>ยอดเดิม {money(selected.amountSatang)} · รอบ {selected.periodStart} – {selected.periodEnd}</p>
   <label className="field"><span>เหตุผลการแก้บิล (อย่างน้อย 15 ตัวอักษร)</span><textarea value={reason} onChange={e=>{setReason(e.target.value);setPreview(null);}} maxLength={500} rows={3} required/></label>
   <label className="field"><span>ปรับยอดเพิ่ม/ลด (บาท) · กรอกค่าติดลบเพื่อลดหนี้</span><input type="text" inputMode="decimal" value={adjustmentBaht} onChange={e=>{setAdjustmentBaht(e.target.value);setPreview(null);}}/></label>
   <p className="hint">ระบบจะคำนวณค่าเช่า น้ำ และไฟจากข้อมูลปัจจุบันใหม่ แล้วบวก/ลบยอดปรับปรุงนี้ ห้ามใช้แทนการคืนเงินที่ชำระแล้ว</p>
   <button className="btn outline" type="button" disabled={busy||reason.trim().length<15} onClick={()=>void inspect()}>ตรวจสอบบิลฉบับแก้ไข</button>
   {preview&&<div className="claim-list" aria-live="polite"><h3>ขั้นที่ 3 ตรวจสอบก่อนยืนยัน</h3>
    {preview.lines.map((line,i)=><p key={i}>{line.description}: {money(line.amountSatang)}</p>)}
    <b>ยอดรวมใหม่ {money(preview.amountSatang)} (เดิม {money(preview.originalAmountSatang)})</b>
    <p className="hint"><TriangleAlert size={15}/> ยืนยันแล้วบิลเดิมจะถูกยกเลิก ระบบจะออกฉบับใหม่พร้อมประวัติการแก้ไข และยกเลิกข้อความแจ้งบิลเดิมที่ยังไม่ส่ง</p>
    <button className="btn primary" type="button" disabled={busy} onClick={()=>void confirm()}>{busy?"กำลังดำเนินการ…":"ยืนยันยกเลิกและออกบิลฉบับใหม่"}</button></div>}
  </div>}
 </section>;
}
