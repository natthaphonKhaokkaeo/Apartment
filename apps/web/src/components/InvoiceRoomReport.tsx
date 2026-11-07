import {useCallback,useEffect,useState} from "react";
import {Download,FileImage,Printer,RefreshCw,Share2,SquarePen,ReceiptText} from "lucide-react";
import {billAmount,downloadInvoiceFile,invoiceDocumentFilename,renderInvoicePng,type InvoicePicture} from "../invoice-document-export.js";

type Room={id:string;number:string};
type ReportRow={id:string;roomId:string;roomNumber:string;tenantName:string;
 periodStart:string;periodEnd:string;dueDate:string;amountSatang:number;
 paidSatang:number;creditSatang:number;outstandingSatang:number;
 status:"ISSUED"|"VOID";voidReason:string|null;replacesInvoiceId:string|null;createdAt:string};
type ReportResponse={items:ReportRow[];limited:boolean;summary:{invoiceCount:number;billedSatang:number;
 paidSatang:number;outstandingSatang:number}};
type InvoiceDetail=InvoicePicture & {status:"ISSUED"|"VOID"};
type Props={propertyId:string;propertyName:string;rooms:Room[];
 api:<T>(path:string,options?:RequestInit)=>Promise<T>;
 onIssue:()=>void;onEdit:(invoiceId:string)=>void};
const money=(v:number)=>`฿${billAmount(v)}`;

/** Owner-only invoice reporting: private files are never exposed via public share links. */
export function InvoiceRoomReport({propertyId,propertyName,rooms,api,onIssue,onEdit}:Props){
 const [roomId,setRoomId]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState(""),
  [status,setStatus]=useState("");
 const [report,setReport]=useState<ReportResponse|null>(null),[selected,setSelected]=useState<ReportRow|null>(null),
  [detail,setDetail]=useState<InvoiceDetail|null>(null);
 const [loading,setLoading]=useState(false),[working,setWorking]=useState(false),
  [error,setError]=useState(""),[notice,setNotice]=useState("");
 const base=`/properties/${propertyId}`;
 const reload=useCallback(async(filters:{roomId:string;from:string;to:string;status:string})=>{
  const query=new URLSearchParams();
  if(filters.roomId)query.set("roomId",filters.roomId);
  if(filters.from)query.set("from",filters.from);
  if(filters.to)query.set("to",filters.to);
  if(filters.status)query.set("status",filters.status);
  if(filters.from&&filters.to&&filters.from>filters.to)throw new Error("วันเริ่มต้นต้องไม่หลังวันสิ้นสุด");
  return api<ReportResponse>(`${base}/invoice-room-report?${query.toString()}`);
 },[api,base]);
 useEffect(()=>{let cancelled=false;
  setRoomId("");setFrom("");setTo("");setStatus("");
  setReport(null);setSelected(null);setDetail(null);setLoading(true);setError("");
  void reload({roomId:"",from:"",to:"",status:""}).then(result=>{if(!cancelled)setReport(result);})
   .catch(e=>{if(!cancelled)setError((e as Error).message);})
   .finally(()=>{if(!cancelled)setLoading(false);});
  return()=>{cancelled=true;};
 },[reload]);
 async function search(){setLoading(true);setError("");setSelected(null);setDetail(null);
  try{setReport(await reload({roomId,from,to,status}));}catch(e){setError((e as Error).message);}finally{setLoading(false);}
 }
 async function inspect(row:ReportRow){setSelected(row);setDetail(null);setError("");
  try{setDetail(await api<InvoiceDetail>(`${base}/invoices/${row.id}`));}
  catch(e){setError((e as Error).message);}
 }
 const pdfUrl=(row:ReportRow)=>`/v1${base}/invoices/${row.id}/billing-notice.pdf`;
 async function pdfFile(row:ReportRow){
  const response=await fetch(pdfUrl(row),{credentials:"include",headers:{accept:"application/pdf"}});
  if(!response.ok||!response.headers.get("content-type")?.includes("application/pdf"))
   throw new Error("ดาวน์โหลดใบแจ้งหนี้ไม่ได้ กรุณาตรวจสอบสถานะบิลและสิทธิ์");
  return new File([await response.blob()],invoiceDocumentFilename(row.roomNumber,row.periodStart,"pdf"),{type:"application/pdf"});
 }
 async function fileFor(row:ReportRow,format:"pdf"|"png"){
  if(row.status!=="ISSUED")throw new Error("บิลที่ยกเลิกแล้วไม่สามารถส่งเป็นใบแจ้งหนี้ที่ใช้ชำระได้");
  if(format==="pdf")return pdfFile(row);
  const current=detail?.id===row.id?detail:await api<InvoiceDetail>(`${base}/invoices/${row.id}`);
  if(current.status!=="ISSUED")throw new Error("ใบแจ้งหนี้นี้ถูกยกเลิกแล้ว");
  const image=await renderInvoicePng(current,propertyName,row.roomNumber,row.tenantName);
  return new File([image],invoiceDocumentFilename(row.roomNumber,row.periodStart,"png"),{type:"image/png"});
 }
 async function exportFile(row:ReportRow,format:"pdf"|"png",share=false){
  setWorking(true);setError("");setNotice("");
  try{
   const file=await fileFor(row,format);
   if(share&&navigator.share&&navigator.canShare?.({files:[file]})){
    await navigator.share({files:[file],title:`ใบแจ้งหนี้ห้อง ${row.roomNumber}`});
    setNotice("เลือกแอปสำหรับแชร์ไฟล์แล้ว โปรดตรวจผู้รับก่อนส่ง");
   }else{
    downloadInvoiceFile(file,file.name);
    setNotice(share?"อุปกรณ์ไม่รองรับแชร์ไฟล์โดยตรง จึงดาวน์โหลดเอกสารแทน":"บันทึกไฟล์ลงอุปกรณ์แล้ว");
   }
  }catch(e){if((e as Error).name!=="AbortError")setError((e as Error).message);}
  finally{setWorking(false);}
 }
 return <section className="panel" aria-label="รายงานบิลแยกตามห้อง">
  <div className="panel-head"><div><h2><ReceiptText size={20}/> รายงานบิลรายห้อง</h2>
   <p>ค้นประวัติและยอดคงค้าง ออกบิล แก้ไขบิล พิมพ์ แชร์ PDF หรือบันทึกเป็นรูปภาพได้จากที่เดียว</p></div>
   <button type="button" className="btn primary" onClick={onIssue}>ออกบิลใหม่</button></div>
  <form className="form" onSubmit={e=>{e.preventDefault();void search();}}>
   <div className="cols3"><label className="field"><span>เลือกห้อง</span><select value={roomId} onChange={e=>setRoomId(e.target.value)}><option value="">ทุกห้อง</option>{rooms.map(room=><option key={room.id} value={room.id}>{room.number}</option>)}</select></label>
    <label className="field"><span>เริ่มรอบบิลตั้งแต่</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label className="field"><span>เริ่มรอบบิลถึง</span><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
   <div className="actions"><label className="field"><span>สถานะเอกสาร</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">ทั้งหมด</option><option value="ISSUED">ออกแล้ว</option><option value="VOID">ยกเลิกแล้ว</option></select></label>
    <button className="btn outline" disabled={loading} type="submit"><RefreshCw size={16}/> {loading?"กำลังโหลด…":"ค้นหา / โหลดใหม่"}</button></div>
  </form>
  {error&&<p className="notice danger" role="alert">{error}</p>}
  {notice&&<p className="notice success" role="status">{notice}</p>}
  {report&&<><div className="payment-figures">
   <div><small>ใบแจ้งหนี้ที่ยังใช้ได้</small><strong>{report.summary.invoiceCount} ใบ</strong></div>
   <div><small>ยอดเรียกเก็บ</small><strong>{money(report.summary.billedSatang)}</strong></div>
   <div><small>ยอดคงค้าง</small><strong>{money(report.summary.outstandingSatang)}</strong></div></div>
   <p className="hint">ยอดรับชำระอ้างอิงรายการรับเงินที่ตรวจสอบในระบบ ไม่ใช่ข้อมูลยืนยันจากธนาคาร · เครดิตภายในแสดงแยกจากเงินรับจริง</p>
   {report.limited&&<p className="notice danger">แสดง 250 รายการล่าสุด กรุณาเลือกห้องหรือช่วงวันที่เพื่อให้ข้อมูลครบถ้วน</p>}
   <div className="table-scroll"><table><thead><tr><th>ห้อง / ผู้เช่า</th><th>รอบบิล</th><th>ยอดบิล</th><th>รับชำระ</th><th>เครดิต</th><th>คงค้าง</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>
    {report.items.map(row=><tr key={row.id}>
     <td><b>{row.roomNumber}</b><small style={{display:"block"}}>{row.tenantName}</small></td>
     <td>{row.periodStart} – {row.periodEnd}<small style={{display:"block"}}>ครบกำหนด {row.dueDate}</small></td>
     <td>{money(row.amountSatang)}</td><td>{money(row.paidSatang)}</td><td>{money(row.creditSatang)}</td><td>{row.status==="VOID"?"—":money(row.outstandingSatang)}</td>
     <td><span className="pill">{row.status==="VOID"?"ยกเลิก":"ออกแล้ว"}</span>{row.replacesInvoiceId&&<small style={{display:"block"}}>ฉบับแก้ไข</small>}</td>
     <td><button className="btn outline" type="button" onClick={()=>void inspect(row)}>ดูรายละเอียด</button></td></tr>)}
    {report.items.length===0&&<tr><td colSpan={8}>ไม่พบใบแจ้งหนี้ในเงื่อนไขที่เลือก</td></tr>}
   </tbody></table></div></>}
  {selected&&<article className="claim-item" aria-label="รายละเอียดเอกสารบิล">
   <div className="claim-heading"><div><b>ห้อง {selected.roomNumber} · รอบ {selected.periodStart} – {selected.periodEnd}</b>
    <small>{selected.tenantName} · {selected.status==="VOID"?"เอกสารยกเลิกแล้ว":"ใบแจ้งหนี้ที่ใช้งานอยู่"}</small></div>
    <button type="button" className="btn outline" onClick={()=>{setSelected(null);setDetail(null);}}>ปิดรายละเอียด</button></div>
   {selected.status==="VOID"&&<p className="hint">บิลฉบับเดิมเก็บไว้เพื่อการตรวจสอบเท่านั้น{selected.voidReason?` · เหตุผล: ${selected.voidReason}`:""} ไม่สามารถนำไปชำระหรือแชร์เป็นใบเรียกเก็บปัจจุบันได้</p>}
   {detail&&<div>{detail.lines.map((line,i)=><div className="rate-row" key={i}><span>{line.type==="NOTE"?`หมายเหตุ: ${line.description}`:line.description}</span><b>{line.type==="NOTE"?"—":money(line.amountSatang)}</b></div>)}
    <div className="rate-row"><b>รวมยอดเรียกเก็บ</b><b>{money(selected.amountSatang)}</b></div></div>}
   {selected.status==="ISSUED"&&<div className="actions">
    <button className="btn outline" type="button" disabled={working} onClick={()=>onEdit(selected.id)}><SquarePen size={16}/> แก้ไขและออกใหม่</button>
    <a href={pdfUrl(selected)+"?inline=1"} target="_blank" rel="noopener noreferrer" className="btn outline"><Printer size={16}/> เปิดเพื่อพิมพ์</a>
    <button className="btn outline" type="button" disabled={working} onClick={()=>void exportFile(selected,"pdf")}><Download size={16}/> บันทึก PDF</button>
    <button className="btn outline" type="button" disabled={working} onClick={()=>void exportFile(selected,"png")}><FileImage size={16}/> บันทึกรูป PNG</button>
    <button className="btn primary" type="button" disabled={working} onClick={()=>void exportFile(selected,"pdf",true)}><Share2 size={16}/> แชร์บิล</button>
   </div>}
   <p className="hint">เอกสารมีข้อมูลผู้เช่า กรุณาตรวจสอบผู้รับก่อนแชร์ ระบบไม่สร้างลิงก์สาธารณะ</p>
  </article>}
 </section>;
}
