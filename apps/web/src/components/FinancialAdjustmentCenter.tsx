import {useEffect,useState} from "react";
import {ShieldCheck} from "lucide-react";

type Invoice={id:string;status:string;amountSatang:number};
type Adjustment={id:string;kind:string;amountSatang:number;status:string;reason:string;invoiceId:string;requestedBy:string;reviewReason:string|null};
type Context={position:{netManualApprovedSatang:number;internalCreditSatang:number;outstandingSatang:number};reversiblePayments:{id:string;amountSatang:number}[]};
type Props={
 propertyId:string;invoices:Invoice[];
 api:<T>(path:string,options?:RequestInit)=>Promise<T>;
 post:<T>(path:string,body:unknown)=>Promise<T>;
};
const kinds=[
 ["INTERNAL_CREDIT","เครดิตลดหนี้ภายใน"],["REVERSE_MANUAL_PAYMENT","กลับรายการรับชำระที่บันทึกผิด"],
 ["REFUND_REVIEW","ตรวจสอบคำขอคืนเงิน (ไม่มีการโอนจริง)"],["DISPUTE_REVIEW","ตรวจสอบข้อพิพาท (ไม่เปลี่ยนยอด)"]
] as const;
const money=(n:number)=>(n/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
function toSatang(value:string){
 if(!/^\d{1,8}(\.\d{1,2})?$/.test(value.trim()))throw Error("จำนวนเงินต้องมีทศนิยมไม่เกิน 2 ตำแหน่ง");
 const [a,b=""]=value.trim().split(".");
 const amount=Number(a)*100+Number(b.padEnd(2,"0"));
 if(!Number.isSafeInteger(amount)||amount<=0||amount>2147483647)throw Error("จำนวนเงินไม่ถูกต้อง");
 return amount;
}
export function FinancialAdjustmentCenter({propertyId,invoices,api,post}:Props){
 const [invoiceId,setInvoiceId]=useState("");
 const [rows,setRows]=useState<Adjustment[]>([]);
 const [context,setContext]=useState<Context|null>(null);
 const [kind,setKind]=useState<string>("INTERNAL_CREDIT");
 const [amount,setAmount]=useState(""),[ledgerId,setLedgerId]=useState("");
 const [reason,setReason]=useState(""),[review,setReview]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
 const [owner,setOwner]=useState(true);
 const base="/properties/"+propertyId;
 async function load(id:string){
  const [data,ctx]=await Promise.all([
   api<Adjustment[]>(base+"/finance-adjustments"),
   id?api<Context>(base+"/invoices/"+id+"/finance-context"):Promise.resolve(null)
  ]);
  setRows(data);setContext(ctx);setOwner(true);
 }
 useEffect(()=>{
  const candidates=invoices.filter(i=>i.status==="ISSUED");
  setInvoiceId(old=>candidates.some(i=>i.id===old)?old:(candidates[0]?.id||""));
 },[invoices,propertyId]);
 useEffect(()=>{
  setError("");setRows([]);setContext(null);
  void load(invoiceId).catch(e=>{
   const m=(e as Error).message;
   if(m.includes("403")||m.includes("SECOND_LEVEL_FINANCE_OWNER_REQUIRED"))setOwner(false);
   else setError(m);
  });
 },[invoiceId,propertyId]);
 async function action(job:()=>Promise<void>){
  setBusy(true);setError("");setNotice("");
  try{await job();await load(invoiceId);}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  await action(async()=>{
   const posting=context?.reversiblePayments.find(x=>x.id===ledgerId);
   if(kind==="REVERSE_MANUAL_PAYMENT"&&!posting)throw Error("เลือกรายการรับชำระที่จะกลับ");
   const value=kind==="REVERSE_MANUAL_PAYMENT"?posting!.amountSatang:toSatang(amount);
   await api(base+"/invoices/"+invoiceId+"/finance-adjustments",{
    method:"POST",headers:{"idempotency-key":crypto.randomUUID()},
    body:JSON.stringify({kind,amountSatang:value,reason, ...(posting&&kind==="REVERSE_MANUAL_PAYMENT"?{originalLedgerId:posting.id}:{})})
   });
   setNotice("ส่งคำขอแล้ว ต้องรอเจ้าของอีกบัญชีอนุมัติ");
   setReason("");setAmount("");setLedgerId("");
  });
 }
 async function decide(row:Adjustment,operation:"APPROVE"|"REJECT"){
  await action(async()=>{
   const reviewReason=(review[row.id]||"").trim();
   if(reviewReason.length<15)throw Error("ต้องระบุเหตุผลตรวจสอบอย่างน้อย 15 ตัวอักษร");
   if(operation==="APPROVE"&&!window.confirm("ยืนยันว่าตรวจเอกสารแล้วและเป็นเจ้าของคนละคนกับผู้ขอ ไม่มีการโอนเงินจริง"))return;
   await post(base+"/finance-adjustments/"+row.id+"/decision",{action:operation,reviewReason});
   setNotice("บันทึกผลตรวจสอบแล้ว ไม่มีการโอนเงินจริง");
  });
 }
 if(!owner)return <section className="panel"><h2>ปรับปรุงบัญชี</h2>
  <p className="hint">เฉพาะสมาชิกที่เป็นเจ้าของหอพักเท่านั้น</p></section>;
 return <section className="panel">
  <div className="panel-head"><div><h2><ShieldCheck size={19}/> ตรวจสอบและปรับปรุงยอด</h2>
   <p>ผู้ขอและผู้อนุมัติต้องเป็นเจ้าของคนละบัญชี • ไม่แก้ Ledger เดิม</p></div></div>
  {error&&<p className="notice danger">{error}</p>}
  {notice&&<p className="notice success">{notice}</p>}
  <form className="form" onSubmit={e=>void submit(e)}>
   <label className="field"><span>ใบแจ้งหนี้</span>
    <select value={invoiceId} onChange={e=>setInvoiceId(e.target.value)}>
     {invoices.filter(i=>i.status==="ISSUED").map(i=><option key={i.id} value={i.id}>บิล {i.id.slice(0,8)} • ฿{money(i.amountSatang)}</option>)}
    </select></label>
   {context&&<div className="payment-figures">
    <div><small>รับชำระสุทธิ</small><strong>฿{money(context.position.netManualApprovedSatang)}</strong></div>
    <div><small>เครดิตภายใน</small><strong>฿{money(context.position.internalCreditSatang)}</strong></div>
    <div><small>ยอดคงเหลือ</small><strong>฿{money(context.position.outstandingSatang)}</strong></div>
   </div>}
   <label className="field"><span>ประเภทคำขอ</span>
    <select value={kind} onChange={e=>setKind(e.target.value)}>
     {kinds.map(([id,name])=><option value={id} key={id}>{name}</option>)}
    </select></label>
   {kind==="REVERSE_MANUAL_PAYMENT"?
    <label className="field"><span>รายการรับชำระที่ต้องกลับ (เต็มจำนวนเท่านั้น)</span>
     <select required value={ledgerId} onChange={e=>setLedgerId(e.target.value)}>
      <option value="">เลือกต้นทาง</option>
      {(context?.reversiblePayments||[]).map(p=><option key={p.id} value={p.id}>{p.id.slice(0,8)} • ฿{money(p.amountSatang)}</option>)}
     </select></label>:
    <label className="field"><span>ยอด (บาท)</span>
     <input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="1000.00"/></label>}
   <label className="field"><span>เหตุผลและหลักฐาน (อย่างน้อย 15 ตัวอักษร)</span>
    <textarea required minLength={15} maxLength={500} rows={3} value={reason} onChange={e=>setReason(e.target.value)} /></label>
   <button type="submit" className="btn primary" disabled={!invoiceId||busy}>ส่งคำขอให้เจ้าของอีกบัญชี</button>
  </form>
  <h3 className="section-subtitle">คำขอปรับปรุงล่าสุด</h3>
  <div className="claim-list">{rows.map(row=><div className="claim-item" key={row.id}>
   <div className="claim-heading"><div><b>{kinds.find(k=>k[0]===row.kind)?.[1]||row.kind}</b>
    <small>บิล {row.invoiceId.slice(0,8)} • ผู้ขอ {row.requestedBy.slice(0,8)}</small></div>
    <span className="pill occupied">{row.status}</span></div>
   <p>{row.reason} • ฿{money(row.amountSatang)}</p>
   {row.reviewReason&&<p className="hint">ความเห็นผู้ตรวจสอบ: {row.reviewReason}</p>}
   {row.status==="PENDING"&&<div className="review-controls">
    <input style={{flex:1,minWidth:200}} placeholder="เหตุผลอนุมัติ/ปฏิเสธ (15 ตัวอักษร)" value={review[row.id]||""}
     onChange={e=>setReview(prev=>({...prev,[row.id]:e.target.value}))}/>
    <button type="button" className="btn primary" disabled={busy} onClick={()=>void decide(row,"APPROVE")}>อนุมัติ</button>
    <button type="button" className="btn outline" disabled={busy} onClick={()=>void decide(row,"REJECT")}>ปฏิเสธ</button>
   </div>}
  </div>)}</div>
  <p className="hint">คำขอคืนเงินหรือข้อพิพาทเป็นการตรวจสอบภายในเท่านั้น ไม่มีโอนเงินหรือออกใบลดหนี้ทางภาษีอัตโนมัติ</p>
 </section>;
}
