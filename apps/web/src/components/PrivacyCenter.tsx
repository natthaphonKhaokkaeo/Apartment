import {useEffect,useRef,useState} from "react";
type RequestRow={id:string;userId?:string;status:string;reason:string;reviewReason:string|null;createdAt:string};
type View={requests:RequestRow[];executionEnabled:boolean};
type Preview={canExecute:boolean;blocker:string|null};
type Props={admin?:boolean;api:<T>(path:string,options?:RequestInit)=>Promise<T>;post:<T>(path:string,body:unknown)=>Promise<T>};
const explanations:Record<string,string>={
 PRIVACY_POLICY_NOT_APPROVED:"ยังไม่เปิดการดำเนินการจริง รอนโยบายที่ผู้ดูแลอนุมัติ",
 PRIVACY_PROTECTED_ACCOUNT:"บัญชีระบบที่ได้รับการป้องกัน ไม่สามารถล้างโปรไฟล์ผ่านช่องทางนี้",
 PRIVACY_OWNER_HANDOFF_REQUIRED:"ต้องส่งมอบบทบาทเจ้าของหอพักก่อน",
 PRIVACY_ACTIVE_LEASE:"ยังมีสัญญาเช่าที่ไม่สิ้นสุด",
 PRIVACY_PAYMENT_REVIEW_PENDING:"ยังมีรายการชำระเงินรอตรวจสอบ",
 PRIVACY_RETENTION_NOT_ELAPSED:"ยังไม่ครบระยะเก็บข้อมูลตามนโยบายที่อนุมัติ",
 PRIVACY_REQUEST_ALREADY_OPEN:"มีคำขอที่กำลังดำเนินการอยู่แล้ว",
};
export function PrivacyCenter({admin=false,api,post}:Props){
 const base=admin?"/admin/privacy/requests":"/tenant/privacy/requests";
 const [data,setData]=useState<View|null>(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [reason,setReason]=useState(""),[ack,setAck]=useState(false),[decisions,setDecisions]=useState<Record<string,string>>({}),[previews,setPreviews]=useState<Record<string,Preview>>({});
 const [executionAck,setExecutionAck]=useState<Record<string,boolean>>({});
 const pending=useRef({signature:"",key:""});
 const explain=(e:unknown)=>{const message=e instanceof Error?e.message:String(e);return explanations[message]||message;};
 useEffect(()=>{
  let current=true;setData(null);setLoading(true);
  void api<View>(base).then(x=>{if(current)setData(x);}).catch(e=>{if(current)setError(explain(e));}).finally(()=>{if(current)setLoading(false);});
  return ()=>{current=false;};
 },[api,base]);
 async function load(){setData(await api<View>(base));}
 async function run(action:()=>Promise<void>){setBusy(true);setError("");setNotice("");try{await action();await load();}catch(e){setError(explain(e));}finally{setBusy(false);}}
 async function submit(){
  const body={reason:reason.trim(),acknowledgedProfileOnly:true},signature=JSON.stringify(body);
  if(pending.current.signature!==signature)pending.current={signature,key:crypto.randomUUID()};
  await api(base,{method:"POST",headers:{"idempotency-key":pending.current.key},body:JSON.stringify(body)});
  pending.current={signature:"",key:""};setReason("");setAck(false);setNotice("ส่งคำขอแล้ว ยังไม่มีการล้างข้อมูลโปรไฟล์");
 }
 return <section className="panel" aria-label={admin?"ตรวจสอบคำขอ privacy":"คำขอข้อมูลส่วนบุคคล"}>
  <div className="panel-head"><div><h2>{admin?"ตรวจสอบคำขอข้อมูลส่วนบุคคล":"คำขอจัดการโปรไฟล์"}</h2><p>คำขอนี้ครอบคลุมโปรไฟล์และการเชื่อมบัญชี ไม่ลบเอกสารการเงิน ประวัติที่ต้องเก็บ หรือสำเนา backup ทันที การดำเนินการต้องผ่านผู้ดูแลและนโยบายที่อนุมัติ</p></div></div>
  {loading&&<p role="status">กำลังโหลดคำขอ...</p>}
  {error&&<p className="notice danger" role="alert">{error}</p>}
  {notice&&<p className="notice success" role="status">{notice}</p>}
  {data&&!data.executionEnabled&&<p className="notice">ยังไม่เปิดการล้างโปรไฟล์จริง สามารถยื่นและตรวจสอบคำขอได้</p>}
  <button type="button" className="btn" disabled={busy||loading} onClick={()=>void run(async()=>{})}>โหลดสถานะคำขอใหม่</button>
  {!admin&&<form className="form" aria-label="ยื่นคำขอจัดการโปรไฟล์" onSubmit={e=>{e.preventDefault();void run(submit);}}>
   <label className="field"><span>เหตุผลคำขอจัดการโปรไฟล์</span><textarea required minLength={15} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/> ฉันเข้าใจว่าเป็นคำขอเกี่ยวกับโปรไฟล์ ต้องตรวจสิทธิ์ สัญญา และนโยบายเก็บข้อมูลก่อน ไม่ใช่การลบเอกสารการเงินทั้งหมด</label>
   <button className="btn primary" type="submit" disabled={busy||!ack}>ยื่นคำขอจัดการโปรไฟล์</button>
  </form>}
  {data?.requests.length===0&&<p className="empty">ยังไม่มีคำขอจัดการโปรไฟล์</p>}
  {data?.requests.map(row=><div className="room-detail" key={row.id}><b>{row.status}</b><p>รหัสคำขอ {row.id}</p><p>{row.reason}</p>{row.reviewReason&&<p>{row.reviewReason}</p>}
   {!admin&&["REQUESTED","APPROVED"].includes(row.status)&&<button className="btn" type="button" disabled={busy} onClick={()=>void run(async()=>{await post(base+"/"+row.id+"/cancel",{});setNotice("ยกเลิกคำขอแล้ว");})}>ยกเลิกคำขอโปรไฟล์</button>}
   {admin&&row.status==="REQUESTED"&&<><label className="field"><span>เหตุผลตรวจคำขอ {row.id.slice(0,8)}</span><input minLength={15} maxLength={500} value={decisions[row.id]||""} onChange={e=>setDecisions(x=>({...x,[row.id]:e.target.value}))}/></label>{(["APPROVE","REJECT"] as const).map(action=><button key={action} type="button" className="btn" disabled={busy||(decisions[row.id]||"").trim().length<15} onClick={()=>void run(async()=>{await post(base+"/"+row.id+"/decision",{action,reason:decisions[row.id]});setNotice("บันทึกผลตรวจแล้ว ยังไม่ล้างโปรไฟล์");})}>{action==="APPROVE"?"อนุมัติให้ตรวจเงื่อนไข":"ปฏิเสธคำขอ"}</button>)}</>}
   {admin&&row.status==="APPROVED"&&<><button type="button" className="btn" disabled={busy} onClick={()=>void run(async()=>{const preview=await api<Preview>(base+"/"+row.id+"/preview");setPreviews(x=>({...x,[row.id]:preview}));})}>ตรวจเงื่อนไขก่อนดำเนินการ</button>
    {previews[row.id]&&<p>{previews[row.id].blocker?explain(previews[row.id].blocker):"ผ่านเงื่อนไขปัจจุบัน ระบบจะตรวจซ้ำขณะดำเนินการ"}</p>}
    {data.executionEnabled&&previews[row.id]?.canExecute&&<><label><input type="checkbox" checked={!!executionAck[row.id]} onChange={e=>setExecutionAck(x=>({...x,[row.id]:e.target.checked}))}/> ยืนยันล้างเฉพาะโปรไฟล์ ตัดการเชื่อมบัญชีและ session โดยเก็บเอกสารการเงินตามนโยบาย</label><button type="button" className="btn" disabled={busy||!executionAck[row.id]} onClick={()=>void run(async()=>{await post(base+"/"+row.id+"/execute",{confirmedProfileOnly:true});setNotice("ล้างข้อมูลโปรไฟล์แล้ว เอกสารการเงินและ backup อยู่ภายใต้นโยบายเก็บข้อมูล");})}>ดำเนินการเฉพาะโปรไฟล์</button></>}
   </>}
  </div>)}
 </section>;
}
