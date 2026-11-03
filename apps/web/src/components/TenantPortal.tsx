import {useEffect,useState} from "react";
import {DoorOpen,ReceiptText,KeyRound,ShieldCheck,Clock3,FileText} from "lucide-react";
import {TenantPayments} from "./TenantPayments.js";
import {TenantNotificationPreferences} from "./TenantNotificationPreferences.js";
import {TenantMaintenanceRequests} from "./TenantMaintenanceRequests.js";
type Api={api:<T>(path:string,options?:RequestInit)=>Promise<T>;post:<T>(path:string,body:unknown)=>Promise<T>};
type Lease={leaseId:string;tenantName:string;roomNumber:string;propertyName:string;propertyAddress:string;startDate:string;endDate:string|null};
type Invoice={id:string;leaseId:string;propertyName:string;periodStart:string;periodEnd:string;dueDate:string;amountSatang:number;status:string};
type Detail=Invoice&{lines:{type:string;description:string;unitsMilli:number|null;tariffSatang:number|null;amountSatang:number}[]};
type Invitation={id:string;claimedAt:string;approvedAt:string|null;revokedAt:string|null;expiresAt:string};
const baht=(n:number)=>"฿"+(n/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
export function TenantPortal({api,post}:Api){
 const [leases,setLeases]=useState<Lease[]>([]),[bills,setBills]=useState<Invoice[]>([]);
 const [invites,setInvites]=useState<Invitation[]>([]),[detail,setDetail]=useState<Detail|null>(null);
 const [token,setToken]=useState(""),[loading,setLoading]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function reload(){
  const [newLeases,newBills,newInvites]=await Promise.all([
   api<Lease[]>("/tenant/leases"),api<Invoice[]>("/tenant/invoices"),api<Invitation[]>("/tenant/invitations")
  ]);
  setLeases(newLeases);setBills(newBills);setInvites(newInvites);
 }
 useEffect(()=>{void reload().catch(e=>setError((e as Error).message));},[]);
 async function claim(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setLoading(true);setMessage("");setError("");
  try{
   await post("/tenant/invitations/claim",{token:token.trim()});
   setToken("");setMessage("ส่งคำขอผูก LINE แล้ว รอเจ้าของตรวจสอบและอนุมัติก่อนดูบิลได้");
   await reload();
  }catch(e){setError((e as Error).message);}finally{setLoading(false);}
 }
 async function openInvoice(id:string){
  setError("");
  try{setDetail(await api<Detail>("/tenant/invoices/"+id));}catch(e){setError((e as Error).message);}
 }
 return <div>
  <div className="hero"><div><span className="hero-kicker">TENANT SELF SERVICE</span><h2>สวัสดี ผู้พักอาศัย</h2><p>ตรวจสอบสัญญาและบิลของคุณด้วย LINE อย่างเป็นส่วนตัว</p></div><DoorOpen size={66}/></div>
  <div className="two-col" style={{marginTop:22}}>
   <section className="panel"><div className="panel-head"><div><h2>ผูกบัญชี LINE กับห้องพัก</h2><p>รหัสเชิญมีอายุ 24 ชั่วโมงและใช้ได้ครั้งเดียว</p></div><KeyRound size={21}/></div>
    <form className="form" onSubmit={e=>void claim(e)}><label className="field"><span>Invite Code จากเจ้าของหอพัก</span><input type="text" value={token} onChange={e=>setToken(e.target.value)}
      required maxLength={43} autoComplete="off" placeholder="วางรหัสเชิญที่ได้รับ"/></label>
     <button className="btn primary" type="submit" disabled={loading||token.trim().length!==43}>{loading?"กำลังตรวจสอบ...":"ส่งคำขอผูกบัญชี"}</button></form>
    {message&&<p className="notice success" role="status">{message}</p>}{error&&<p className="notice danger" role="alert">{error}</p>}
   </section>
   <section className="panel"><div className="panel-head"><div><h2>สถานะคำขอ</h2><p>ข้อมูลบิลจะเปิดให้อ่านหลังเจ้าของอนุมัติ</p></div><ShieldCheck size={21}/></div>
    {invites.map(i=><div className="rate-row" key={i.id}><span>ขอผูกบัญชี {new Date(i.claimedAt).toLocaleDateString("th-TH")}</span>
     <b>{i.approvedAt?"อนุมัติแล้ว":i.revokedAt?"ยกเลิกแล้ว":"รอเจ้าของอนุมัติ"}</b></div>)}
    {!invites.length&&<div className="empty">ยังไม่มีคำขอผูกบัญชี</div>}
   </section>
  </div>
  <section className="panel"><div className="panel-head"><div><h2>สัญญาเช่าของฉัน</h2><p>เห็นเฉพาะสัญญาที่เจ้าของยืนยันบัญชี LINE แล้ว</p></div><DoorOpen size={20}/></div>
   <div className="room-grid">{leases.map(l=><div className="room-tile" key={l.leaseId}><strong>{l.propertyName}</strong><b>{l.roomNumber}</b><small>{l.propertyAddress}</small><span className="pill vacant">สัญญาเริ่ม {l.startDate}</span></div>)}</div>
   {!leases.length&&<p className="empty">ยังไม่มีสัญญาที่ผูกกับบัญชีนี้</p>}
  </section>
  <TenantNotificationPreferences api={api} leaseKey={leases.map(l=>l.leaseId).join(",")}/>
  <TenantMaintenanceRequests api={api} post={post}
   leases={leases.map(l=>({leaseId:l.leaseId,roomNumber:l.roomNumber,propertyName:l.propertyName}))}/>
  <section className="panel"><div className="panel-head"><div><h2>ใบแจ้งหนี้ของฉัน</h2><p>ยอดที่แสดงคือยอดออกบิล ไม่ใช่ยอดค้างชำระที่ยืนยันแล้ว</p></div><ReceiptText size={20}/></div>
   {bills.map(b=><button type="button" className="tenant-bill" key={b.id} onClick={()=>void openInvoice(b.id)}>
    <div><b>{b.propertyName}</b><small><Clock3 size={13}/> {b.periodStart} ถึง {b.periodEnd} · ครบกำหนด {b.dueDate}</small></div>
    <span><strong>{baht(b.amountSatang)}</strong><small>ดูรายละเอียด</small></span></button>)}
   {!bills.length&&<p className="empty">ยังไม่มีใบแจ้งหนี้ที่เปิดให้ดู</p>}
  </section>
  {detail&&<section className="panel"><div className="panel-head"><div><h2><FileText size={18}/> รายละเอียดใบแจ้งหนี้</h2><p>{detail.propertyName} · {detail.periodStart} – {detail.periodEnd}</p></div>
   <button className="btn outline" onClick={()=>setDetail(null)}>ปิด</button></div>
   {detail.lines.map((l,i)=><div key={i} className="rate-row"><span>{l.description}</span><b>{baht(l.amountSatang)}</b></div>)}
   <div className="rate-row"><strong>ยอดรวม</strong><strong>{baht(detail.amountSatang)}</strong></div>
   <div className="actions" style={{marginTop:15,marginBottom:20}}><a className="btn primary" href={"/v1/tenant/invoices/"+detail.id+"/billing-notice.pdf"} target="_blank" rel="noopener noreferrer">ดาวน์โหลดใบแจ้งหนี้ PDF</a></div>
   <TenantPayments invoiceId={detail.id} api={api}/>
  </section>}
 </div>;
}
