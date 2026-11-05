import {useEffect,useRef,useState} from "react";
import {parseSatang} from "../money.js";
type Lease={id:string;tenantName:string;status:string};
type Review={id:string;kind:string;amountSatang:number;reason:string;status:string;requestedBy:string};
type Context={position:{receivedSatang:number;deductedSatang:number;balanceSatang:number;reservedSatang:number;availableSatang:number;payoutEnabled:false;bankVerified:false};entries:{id:string;kind:string;amountSatang:number;reference:string|null}[];reviews:Review[];historyLimit:number};
type Props={propertyId:string;leases:Lease[];actorId:string;api:<T>(path:string)=>Promise<T>;post:<T>(path:string,body:unknown,headers?:HeadersInit)=>Promise<T>};
const money=(n:number)=>(n/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
const kinds:Record<string,string>={DEDUCTION:"หักเงินประกัน",REFUND_REVIEW:"พิจารณาคืนเงิน (ไม่โอนจริง)",DISPUTE_REVIEW:"ตรวจสอบข้อพิพาท"};
const errors:Record<string,string>={
 DEPOSIT_EXCEEDS_AVAILABLE:"ยอดคำขอเกินเงินประกันที่ยังไม่ถูกกันไว้",
 DEPOSIT_REFERENCE_ALREADY_RECORDED:"รหัสอ้างอิงนี้บันทึกแล้ว กรุณาตรวจประวัติก่อน",
 IDEMPOTENCY_KEY_REUSED:"ข้อมูลเปลี่ยนจากคำขอเดิม กรุณาโหลดข้อมูลและตรวจประวัติ",
 SECOND_OWNER_APPROVAL_REQUIRED:"ต้องให้เจ้าของอีกบัญชีตรวจสอบรายการนี้",
 DEPOSIT_REVIEW_ALREADY_DECIDED:"รายการนี้ถูกตรวจสอบแล้ว กรุณาโหลดข้อมูลใหม่",
 DEPOSIT_ACTIVE_OWNER_REQUIRED:"ต้องเป็นเจ้าของที่ยังมีสิทธิ์ในองค์กร",
 DEPOSIT_REQUESTER_NO_LONGER_OWNER:"ผู้ขอไม่มีสิทธิ์เจ้าของแล้ว จึงอนุมัติไม่ได้",
};
export function DepositCenter({propertyId,leases,actorId,api,post}:Props){
 const [leaseId,setLeaseId]=useState(""),[data,setData]=useState<Context|null>(null);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [amount,setAmount]=useState(""),[reference,setReference]=useState(""),[receiptReason,setReceiptReason]=useState("");
 const [kind,setKind]=useState("DEDUCTION"),[reviewAmount,setReviewAmount]=useState(""),[reason,setReason]=useState("");
 const [decisions,setDecisions]=useState<Record<string,string>>({});
 const pending=useRef<Record<string,{signature:string;key:string}>>({});
 const base="/properties/"+propertyId+"/leases/"+leaseId+"/deposits";
 const scope=useRef(base);scope.current=base;
 const message=(e:unknown)=>{const text=e instanceof Error?e.message:"REQUEST_FAILED";return errors[text]||text;};
 useEffect(()=>{setLeaseId(previous=>leases.some(l=>l.id===previous)?previous:(leases[0]?.id||""));},[propertyId,leases]);
 useEffect(()=>{
  let current=true;setData(null);setError("");setNotice("");setDecisions({});setAmount("");setReference("");setReceiptReason("");setReviewAmount("");setReason("");pending.current={};
  if(!leaseId){setLoading(false);return;}
  setLoading(true);
  void api<Context>(base).then(x=>{if(current)setData(x);}).catch(e=>{if(current)setError(message(e));}).finally(()=>{if(current)setLoading(false);});
  return ()=>{current=false;};
 },[base,leaseId,api]);
 async function load(){const target=base;const result=await api<Context>(target);if(scope.current===target)setData(result);}
 async function submit(type:"receipts"|"reviews",body:unknown){
  const target=base,signature=JSON.stringify({target,body});
  const old=pending.current[type],key=old?.signature===signature?old.key:crypto.randomUUID();
  pending.current[type]={signature,key};
  setBusy(true);setError("");setNotice("");
  try{
   await post(target+"/"+type,body,{"idempotency-key":key});
   if(scope.current!==target)return;
   delete pending.current[type];
   if(type==="receipts"){setAmount("");setReference("");setReceiptReason("");}else{setReviewAmount("");setReason("");}
   setNotice(type==="receipts"?"บันทึกเงินประกันด้วยมือแล้ว ยังไม่ใช่การยืนยันจากธนาคาร":"ส่งคำขอแล้ว ต้องให้เจ้าของอีกบัญชีตรวจสอบ");
   await load();
  }catch(e){if(scope.current===target)setError(message(e));}finally{setBusy(false);}
 }
 async function decide(row:Review,action:"APPROVE"|"REJECT"){
  setBusy(true);setError("");setNotice("");
  try{
   await post(base+"/reviews/"+row.id+"/decision",{action,reason:decisions[row.id]||""});
   setNotice("บันทึกผลตรวจสอบแล้ว ไม่มีการโอนเงินอัตโนมัติ");await load();
  }catch(e){setError(message(e));}finally{setBusy(false);}
 }
 return <section className="panel" aria-label="เงินประกัน">
  <div className="panel-head"><div><h2>เงินประกันสัญญาเช่า</h2><p>บันทึกด้วยมือ ไม่ใช่ยอดธนาคารยืนยัน การอนุมัติคืนเงินเป็นการตรวจสอบเท่านั้น ไม่มีการโอนเงิน</p></div></div>
  <label className="field"><span>สัญญาเงินประกัน</span><select value={leaseId} disabled={busy} onChange={e=>setLeaseId(e.target.value)}>{leases.map(l=><option key={l.id} value={l.id}>{l.tenantName} — {l.status}</option>)}</select></label>
  {!leaseId&&<p className="empty">ยังไม่มีสัญญาเช่าสำหรับเงินประกัน</p>}
  {loading&&<p role="status">กำลังโหลดเงินประกัน...</p>}
  {error&&<p className="notice danger" role="alert">{error}</p>}
  {notice&&<p className="notice success" role="status">{notice}</p>}
  {leaseId&&<button className="btn" type="button" disabled={busy||loading} onClick={()=>void load().catch(e=>setError(message(e)))}>โหลดเงินประกันใหม่</button>}
  {data&&<>
   <div className="payment-figures"><div><small>เงินประกันคงเหลือ</small><strong>฿{money(data.position.balanceSatang)}</strong></div><div><small>กันไว้รอตรวจสอบ</small><strong>฿{money(data.position.reservedSatang)}</strong></div><div><small>ยังไม่ถูกกันไว้</small><strong>฿{money(data.position.availableSatang)}</strong></div></div>
   <form className="form" aria-label="บันทึกรับเงินประกัน" onSubmit={e=>{e.preventDefault();try{void submit("receipts",{amountSatang:parseSatang(amount),reference:reference.trim(),reason:receiptReason.trim()});}catch(err){setError(message(err));}}}>
    <h3>บันทึกรับเงินประกัน</h3>
    <label className="field"><span>เงินประกันรับเข้า (บาท)</span><input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    <label className="field"><span>รหัสอ้างอิงเงินประกันภายใน</span><input required minLength={8} maxLength={128} pattern="[A-Za-z0-9_-]+" value={reference} onChange={e=>setReference(e.target.value)}/></label>
    <small>ใช้รหัสภายในที่ไม่ซ้ำ ไม่ใส่เลขบัญชีธนาคาร</small>
    <label className="field"><span>เหตุผลรับเงินประกัน</span><input required minLength={15} maxLength={500} value={receiptReason} onChange={e=>setReceiptReason(e.target.value)}/></label>
    <button type="submit" className="btn primary" disabled={busy}>บันทึกรับเงินประกันด้วยมือ</button>
   </form>
   <form className="form" aria-label="ขอตรวจสอบเงินประกัน" onSubmit={e=>{e.preventDefault();try{void submit("reviews",{kind,amountSatang:parseSatang(reviewAmount),reason:reason.trim()});}catch(err){setError(message(err));}}}>
    <h3>ขอตรวจสอบเงินประกัน</h3>
    <label className="field"><span>ประเภทคำขอเงินประกัน</span><select value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries(kinds).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className="field"><span>ยอดขอตรวจสอบ (บาท)</span><input required inputMode="decimal" value={reviewAmount} onChange={e=>setReviewAmount(e.target.value)}/></label>
    <label className="field"><span>เหตุผลคำขอเงินประกัน</span><input required minLength={15} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <button type="submit" className="btn primary" disabled={busy}>ส่งคำขอเงินประกัน</button>
   </form>
   <h3>รายการรอตรวจสอบและประวัติ</h3>
   {data.reviews.length===0&&<p className="empty">ยังไม่มีคำขอเงินประกัน</p>}
   {data.reviews.map(row=><div className="room-detail" key={row.id}><p>{kinds[row.kind]||row.kind} ฿{money(row.amountSatang)} — {row.status}</p><p>{row.reason}</p>
    {row.status==="PENDING"&&(row.requestedBy===actorId?<p>ต้องให้เจ้าของอีกบัญชีตรวจสอบ</p>:<><label className="field"><span>เหตุผลตรวจสอบ {row.id.slice(0,8)}</span><input minLength={15} maxLength={500} value={decisions[row.id]||""} onChange={e=>setDecisions(v=>({...v,[row.id]:e.target.value}))}/></label><button type="button" className="btn" disabled={busy||(decisions[row.id]||"").trim().length<15} onClick={()=>void decide(row,"APPROVE")}>อนุมัติคำขอเงินประกัน</button><button type="button" className="btn" disabled={busy||(decisions[row.id]||"").trim().length<15} onClick={()=>void decide(row,"REJECT")}>ปฏิเสธคำขอเงินประกัน</button></>)}
   </div>)}
   <h3>สมุดรายการเงินประกัน</h3>
   {data.entries.map(row=><p key={row.id}>{row.kind==="RECEIVED"?"รับเข้าด้วยมือ":"หักตามคำขออนุมัติ"} ฿{money(row.amountSatang)} {row.reference||""}</p>)}
   <small>แสดงประวัติล่าสุด {data.historyLimit} รายการ ยอดรวมคำนวณจากทุกรายการ</small>
  </>}
 </section>;
}
