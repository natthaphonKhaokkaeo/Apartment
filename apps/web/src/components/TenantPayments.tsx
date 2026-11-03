import {useEffect,useState} from "react";
import {Banknote,ClipboardCopy,FileImage,ShieldCheck,UploadCloud} from "lucide-react";
type Api={api:<T>(path:string,options?:RequestInit)=>Promise<T>};
type Bank={bankName:string;accountName:string;accountNumber:string;promptPayId:string|null;updatedAt:string;version:number};
type Summary={invoiceId:string;totalSatang:number;manuallyApprovedSatang:number;outstandingSatang:number;pendingClaims:number;settlementState:string;verification:string};
type Claim={id:string;invoiceId:string;amountSatang:number;status:"PENDING"|"APPROVED"|"REJECTED";createdAt:string;rejectionReason:string|null};
const money=(n:number)=>"฿"+(n/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
const localDateTime=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
function toSatang(value:string){
 const m=/^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(value.trim());
 if(!m)throw new Error("กรุณากรอกจำนวนเงินเป็นบาทและสตางค์ไม่เกิน 2 ตำแหน่ง");
 const total=Number(m[1])*100+Number((m[2]||"").padEnd(2,"0"));
 if(!Number.isSafeInteger(total)||total<=0||total>2147483647)throw new Error("จำนวนเงินไม่ถูกต้อง");
 return total;
}
export function TenantPayments({invoiceId,api}:Api&{invoiceId:string}){
 const [bank,setBank]=useState<Bank|null>(null),[summary,setSummary]=useState<Summary|null>(null),[claims,setClaims]=useState<Claim[]>([]);
 const [amount,setAmount]=useState(""),[paidAt,setPaidAt]=useState(localDateTime()),[reference,setReference]=useState("");
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [key,setKey]=useState(()=>crypto.randomUUID());
 async function reload(){
  const [b,s,c]=await Promise.all([
   api<Bank>("/tenant/invoices/"+invoiceId+"/payment-instructions").catch(()=>null),
   api<Summary>("/tenant/invoices/"+invoiceId+"/payment-summary"),
   api<Claim[]>("/tenant/payment-claims")
  ]);
  setBank(b);setSummary(s);setClaims(c.filter(x=>x.invoiceId===invoiceId));
 }
 useEffect(()=>{setAmount("");setKey(crypto.randomUUID());setFile(null);setError("");setMessage("");void reload().catch(e=>setError((e as Error).message));},[invoiceId]);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError("");setMessage("");
  try{
   if(!file)throw new Error("กรุณาเลือกภาพหลักฐานการโอน");
   if(file.size>4_000_000)throw new Error("ไฟล์ต้องไม่เกิน 4 MB");
   const data=new FormData();
   data.append("amountSatang",String(toSatang(amount)));
   data.append("paidAt",new Date(paidAt).toISOString());
   if(reference.trim())data.append("transferReference",reference.trim());
   data.append("evidence",file);
   const r=await fetch("/v1/tenant/invoices/"+invoiceId+"/payment-claims",{
    method:"POST",body:data,credentials:"include",headers:{"idempotency-key":key}
   });
   const payload=await r.json() as {error?:string;claim?:{id:string}};
   if(!r.ok)throw new Error(payload.error||"แจ้งชำระไม่สำเร็จ");
   setKey(crypto.randomUUID());setAmount("");setReference("");setFile(null);
   setMessage("ส่งหลักฐานเรียบร้อยแล้ว รอเจ้าของตรวจสอบยอดเงินเข้าบัญชีและอนุมัติ");
   await reload();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <div className="tenant-payment-area">
  <div className="panel-head"><div><h2><Banknote size={20}/> ช่องทางชำระเงินและแจ้งโอน</h2><p>เจ้าของหอพักเป็นผู้ระบุบัญชี และต้องตรวจสอบยอดจริงก่อนอนุมัติ</p></div></div>
  {bank?<div className="bank-display">
   <div className="bank-header"><Banknote size={20}/> <strong>{bank.bankName}</strong></div>
   <small>ชื่อบัญชี</small><b>{bank.accountName}</b>
   <small>เลขที่บัญชี</small><div className="bank-account"><strong>{bank.accountNumber}</strong>
   <button className="btn outline" type="button" onClick={()=>void navigator.clipboard.writeText(bank.accountNumber)}><ClipboardCopy size={15}/> คัดลอก</button></div>
   {bank.promptPayId&&<><small>พร้อมเพย์</small><b>{bank.promptPayId}</b></>}
   <small>อัปเดตล่าสุด {new Date(bank.updatedAt).toLocaleString("th-TH")}</small>
   <p className="hint"><ShieldCheck size={16}/> โปรดยืนยันชื่อและเลขที่บัญชีกับเจ้าของหอพักก่อนโอนทุกครั้ง</p>
  </div>:<div className="hint">เจ้าของยังไม่ได้เปิดช่องทางรับชำระสำหรับใบแจ้งหนี้นี้</div>}
  {summary&&<div className="payment-figures">
   <div><small>ยอดบิล</small><strong>{money(summary.totalSatang)}</strong></div>
   <div><small>เจ้าของอนุมัติแล้ว</small><strong>{money(summary.manuallyApprovedSatang)}</strong></div>
   <div><small>ยอดคงเหลือ</small><strong>{money(summary.outstandingSatang)}</strong></div>
  </div>}
  <div className="payment-review-note">ระบบไม่ตรวจสอบธนาคารอัตโนมัติ ข้อมูลยอดที่อนุมัติเป็นบันทึกการตรวจสอบด้วยมือของเจ้าของ</div>
  <h3 className="section-subtitle">ส่งหลักฐานแจ้งชำระ</h3>
  <form className="form" onSubmit={e=>void submit(e)}>
   <div className="cols2"><label className="field"><span>ยอดโอน (บาท)</span><input required type="text" inputMode="decimal" placeholder="เช่น 1200.50" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
   <label className="field"><span>วันและเวลาโอน</span><input required type="datetime-local" value={paidAt} onChange={e=>setPaidAt(e.target.value)}/></label></div>
   <label className="field"><span>เลขอ้างอิงการโอน (ถ้ามี)</span><input type="text" maxLength={80} value={reference} onChange={e=>setReference(e.target.value)} placeholder="อักษร A–Z ตัวเลข หรือขีดกลาง"/></label>
   <label className="field"><span>ภาพสลิปหรือหลักฐาน (JPEG/PNG/WebP สูงสุด 4 MB)</span><input required type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
   <button type="submit" className="btn primary" disabled={busy||!bank||!summary?.outstandingSatang}><UploadCloud size={17}/>{busy?"กำลังอัปโหลด...":"ส่งแจ้งชำระให้เจ้าของตรวจสอบ"}</button>
  </form>
  {error&&<p className="notice danger" role="alert">{error}</p>}
  {message&&<p className="notice success" role="status">{message}</p>}
  {claims.length>0&&<section className="claim-history"><h3>ประวัติแจ้งชำระ</h3>{claims.map(c=><div className="rate-row" key={c.id}>
   <div><strong>{money(c.amountSatang)}</strong><small>{new Date(c.createdAt).toLocaleString("th-TH")}</small>{c.rejectionReason&&<small>เหตุผล: {c.rejectionReason}</small>}</div>
   <div className="claim-history-right"><span className={"pill "+(c.status==="APPROVED"?"vacant":"occupied")}>{c.status==="PENDING"?"รอตรวจสอบ":c.status==="APPROVED"?"เจ้าของอนุมัติ":"ปฏิเสธ"}</span>
    <a href={"/v1/tenant/payment-claims/"+c.id+"/evidence"} target="_blank" rel="noreferrer"><FileImage size={14}/> หลักฐาน</a></div>
  </div>)}</section>}
 </div>;
}
