import {useEffect,useState} from "react";
import {BadgeCheck,Banknote,Building2,ClipboardCheck,FileImage,RefreshCcw,ShieldAlert} from "lucide-react";
import {PromptPayQRCode} from "./PromptPayQRCode.js";

type Api={api:<T>(path:string,options?:RequestInit)=>Promise<T>;post:<T>(path:string,body:unknown)=>Promise<T>};
type Bank={id:string;bankName:string;accountName:string;accountNumber:string;accountNumberMasked:string;promptPayId:string|null;active:boolean;version:number;updatedAt:string};
type Claim={id:string;invoiceId:string;tenantName:string;amountSatang:number;paidAt:string;transferReference:string|null;createdAt:string;status:"PENDING"|"APPROVED"|"REJECTED";rejectionReason:string|null};
type IssuedInvoice={id:string;roomId:string;dueDate:string;periodStart:string;periodEnd:string;amountSatang:number;status:string};
type Summary={invoiceId:string;totalSatang:number;manuallyApprovedSatang:number;outstandingSatang:number;pendingClaims:number;verification:string};
const money=(n:number)=>"฿"+(n/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});

export function PaymentCenter({propertyId,api,post}:Api&{propertyId:string}){
 const [bank,setBank]=useState<Bank|null>(null),[claims,setClaims]=useState<Claim[]>([]),[summary,setSummary]=useState<Record<string,Summary>>({});
 const [loading,setLoading]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[rejectReason,setRejectReason]=useState<Record<string,string>>({});
 const [invoices,setInvoices]=useState<IssuedInvoice[]>([]),[selectedInvoiceId,setSelectedInvoiceId]=useState("");
 async function reload(){
  const [settings,items,bills]=await Promise.all([
   api<Bank|null>("/properties/"+propertyId+"/payment-instructions"),
   api<Claim[]>("/properties/"+propertyId+"/payment-claims"),
   api<IssuedInvoice[]>("/properties/"+propertyId+"/invoices")
  ]);
  setBank(settings);setClaims(items);setInvoices(bills);
  setSelectedInvoiceId(prev=>bills.some(b=>b.id===prev)?prev:(bills[0]?.id||""));
  const invoiceIds=[...new Set(items.map(c=>c.invoiceId))];
  const balances=await Promise.all(invoiceIds.map(async id=>{
   const balance=await api<Summary>("/properties/"+propertyId+"/invoices/"+id+"/payment-summary");
   return [id,balance] as const;
  }));
  setSummary(Object.fromEntries(balances));
 }
 useEffect(()=>{setError("");setMessage("");setBank(null);setClaims([]);setInvoices([]);setSelectedInvoiceId("");void reload().catch(e=>setError((e as Error).message));},[propertyId]);
 async function act(fn:()=>Promise<void>){
  setLoading(true);setError("");setMessage("");
  try{await fn();await reload();}catch(e){setError((e as Error).message);}finally{setLoading(false);}
 }
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();const form=new FormData(event.currentTarget);
  const body={bankName:String(form.get("bankName")),accountName:String(form.get("accountName")),
   accountNumber:String(form.get("accountNumber")).trim(),promptPayId:String(form.get("promptPayId")||"").trim()||null,
   active:form.get("active")==="on",expectedVersion:bank?.version??null};
  await act(async()=>{
   await api("/properties/"+propertyId+"/payment-instructions",{method:"PUT",body:JSON.stringify(body)});
   setMessage("บันทึกข้อมูลบัญชีรับเงินแล้ว ตรวจสอบข้อมูลกับธนาคารก่อนแชร์ให้ผู้เช่า");
  });
 }
 async function decide(c:Claim,action:"APPROVE"|"REJECT"){
  await act(async()=>{
   if(action==="APPROVE"&&!window.confirm("คุณตรวจยอดเงินเข้าจากบัญชีธนาคารจริงแล้วใช่หรือไม่? ระบบไม่ตรวจบัญชีธนาคารให้อัตโนมัติ"))
    return;
   if(action==="REJECT"&&(rejectReason[c.id]||"").trim().length<5)
    throw new Error("กรุณาระบุเหตุผลปฏิเสธอย่างน้อย 5 ตัวอักษร");
   const payload=action==="APPROVE"?{action}:{action,reason:rejectReason[c.id]};
   await post("/properties/"+propertyId+"/payment-claims/"+c.id+"/decision",payload);
   setMessage(action==="APPROVE"?"บันทึกการอนุมัติด้วยมือและยอดใน Ledger แล้ว":"ปฏิเสธหลักฐานแล้ว");
  });
 }
 return <div className="payment-center">
  <div className="hero"><div><span className="hero-kicker">PAYMENT OPERATIONS</span><h2>ตรวจสอบยอดและหลักฐานรับชำระ</h2><p>ข้อมูลบัญชีแยกรายหอพัก • เจ้าของอนุมัติรายการด้วยตนเอง</p></div><Banknote size={65}/></div>
  <div className="hint payment-warning"><ShieldAlert size={20}/> ระบบยังไม่เชื่อม Bank API กรุณาตรวจสอบยอดเงินในบัญชีธนาคารจริงก่อนกดอนุมัติทุกครั้ง</div>
  {error&&<div className="notice danger" role="alert">{error}</div>}
  {message&&<div className="notice success" role="status">{message}</div>}
  <section className="panel"><div className="panel-head"><div><h2>ตั้งค่าบัญชีรับชำระ</h2><p>ผู้เช่าที่ผ่านการยืนยันตัวตนจะเห็นข้อมูลนี้เมื่อเปิดบิลของตน</p></div><Building2 size={22}/></div>
   <form className="form" key={bank?.version??"new"} onSubmit={e=>void save(e)}>
    <div className="cols2"><label className="field"><span>ชื่อธนาคาร</span><input name="bankName" required minLength={2} maxLength={120} defaultValue={bank?.bankName||""} placeholder="ธนาคาร..."/></label>
    <label className="field"><span>ชื่อบัญชีผู้รับ</span><input name="accountName" required minLength={3} maxLength={160} defaultValue={bank?.accountName||""} placeholder="ชื่อบุคคลหรือนิติบุคคล"/></label>
    <label className="field"><span>เลขบัญชี (ตัวเลข 8–20 หลัก)</span><input name="accountNumber" required pattern="[0-9]{8,20}" defaultValue={bank?.accountNumber||""} inputMode="numeric" placeholder="เลขบัญชี"/></label>
    <label className="field"><span>PromptPay ID (เบอร์มือถือ 10 หลักหรือเลขผู้เสียภาษี 13 หลัก)</span><input name="promptPayId" pattern="(?:0[689][0-9]{8}|[0-9]{13})" defaultValue={bank?.promptPayId||""} inputMode="numeric" placeholder="หมายเลขพร้อมเพย์"/></label></div>
    <label className="checkline"><input type="checkbox" name="active" defaultChecked={bank?.active??true}/> เปิดให้ผู้เช่าเห็นช่องทางรับชำระนี้</label>
    <div className="actions"><button type="submit" disabled={loading} className="btn primary">{loading?"กำลังบันทึก...":"บันทึกบัญชีรับเงิน"}</button>
      {bank&&<span className="muted-inline">ข้อมูลชุดที่ {bank.version} · {bank.accountNumberMasked}</span>}</div>
   </form>
  </section>
  {bank?.active&&bank.promptPayId&&invoices.length>0&&<section className="panel">
   <div className="panel-head"><div><h2>ตรวจสอบ QR พร้อมเพย์ของใบแจ้งหนี้</h2>
     <p>QR นี้เป็นเพียงข้อมูลสำหรับการโอน ไม่ยืนยันว่าเงินเข้าแล้ว กรุณาทดลองสแกนและตรวจชื่อบัญชีผู้รับกับธนาคาร</p></div></div>
   <label className="field"><span>เลือกใบแจ้งหนี้</span><select value={selectedInvoiceId} onChange={e=>setSelectedInvoiceId(e.target.value)}>
    {invoices.filter(b=>b.status==="ISSUED").map(b=><option key={b.id} value={b.id}>บิล {b.id.slice(0,8)} • {b.periodStart} – {b.periodEnd} • {money(b.amountSatang)}</option>)}
   </select></label>
   {selectedInvoiceId&&<PromptPayQRCode invoiceId={selectedInvoiceId}
     endpoint={"/properties/"+propertyId+"/invoices/"+selectedInvoiceId+"/promptpay-qr"} api={api}/>}
  </section>}
  <section className="panel"><div className="panel-head"><div><h2>รายการแจ้งชำระของผู้เช่า</h2><p>ยอดคงเหลือคิดจากรายการที่เจ้าของอนุมัติแล้วเท่านั้น</p></div>
   <button className="btn outline" onClick={()=>void reload().catch(e=>setError((e as Error).message))}><RefreshCcw size={16}/> โหลดใหม่</button></div>
   <div className="claim-list">{claims.map(c=><div className="claim-item" key={c.id}>
    <div className="claim-heading"><div><b>{c.tenantName}</b><small>ใบแจ้งหนี้ {c.invoiceId.slice(0,8)} · แจ้งเมื่อ {new Date(c.createdAt).toLocaleString("th-TH")}</small></div>
     <span className={"pill "+(c.status==="APPROVED"?"vacant":"occupied")}>{c.status==="PENDING"?"รอตรวจสอบ":c.status==="APPROVED"?"อนุมัติแล้ว":"ปฏิเสธแล้ว"}</span></div>
    <div className="claim-facts"><div><small>จำนวนเงินที่แจ้ง</small><strong>{money(c.amountSatang)}</strong></div>
     <div><small>รหัสอ้างอิง</small><strong>{c.transferReference||"—"}</strong></div>
     <div><small>ยอดคงเหลือในบิล</small><strong>{summary[c.invoiceId]?money(summary[c.invoiceId].outstandingSatang):"—"}</strong></div></div>
    <a href={"/v1/properties/"+propertyId+"/payment-claims/"+c.id+"/evidence"} className="evidence-link" target="_blank" rel="noreferrer"><FileImage size={16}/> เปิดหลักฐาน (ส่วนตัว)</a>
    {c.status==="PENDING"&&<div className="review-controls">
     <button type="button" disabled={loading} className="btn primary" onClick={()=>void decide(c,"APPROVE")}><BadgeCheck size={16}/> ตรวจแล้ว อนุมัติยอด</button>
     <div className="review-reject"><input placeholder="เหตุผลปฏิเสธ (อย่างน้อย 5 ตัวอักษร)" aria-label="เหตุผลปฏิเสธ" value={rejectReason[c.id]||""} onChange={e=>setRejectReason(v=>({...v,[c.id]:e.target.value}))}/>
      <button type="button" disabled={loading} className="btn outline" onClick={()=>void decide(c,"REJECT")}>ปฏิเสธ</button></div>
    </div>}
    {c.rejectionReason&&<p className="notice danger">{c.rejectionReason}</p>}
   </div>)}</div>
   {!claims.length&&<div className="empty"><ClipboardCheck size={26}/><p>ยังไม่มีการแจ้งชำระในหอพักนี้</p></div>}
  </section>
 </div>;
}
