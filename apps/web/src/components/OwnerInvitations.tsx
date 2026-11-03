import {useEffect,useState} from "react";
import {Copy,Link2,ShieldCheck,RotateCcw,XCircle} from "lucide-react";

type Api={api:<T>(path:string,options?:RequestInit)=>Promise<T>;post:<T>(path:string,body:unknown)=>Promise<T>};
type Lease={id:string;roomId:string;tenantName:string;tenantLineSubject:string|null;status:string};
type Invite={id:string;expiresAt:string;claimedAt:string|null;approvedAt:string|null;revokedAt:string|null;claimantName:string|null;createdAt:string};
type NewInvite={id:string;token:string;expiresAt:string};
export function OwnerInvitations({propertyId,api,post}:Api&{propertyId:string}){
 const [leases,setLeases]=useState<Lease[]>([]),[selected,setSelected]=useState(""),[invites,setInvites]=useState<Invite[]>([]);
 const [code,setCode]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 async function loadLeases(){
  const data=await api<Lease[]>("/properties/"+propertyId+"/leases");
  setLeases(data);setSelected(prev=>data.some(l=>l.id===prev)?prev:data[0]?.id||"");
 }
 async function loadInvites(leaseId:string){
  if(!leaseId){setInvites([]);return;}
  setInvites(await api<Invite[]>("/properties/"+propertyId+"/leases/"+leaseId+"/invitations"));
 }
 useEffect(()=>{setCode("");setSelected("");setInvites([]);void loadLeases().catch(e=>setError((e as Error).message));},[propertyId]);
 useEffect(()=>{setCode("");void loadInvites(selected).catch(e=>setError((e as Error).message));},[selected,propertyId]);
 async function perform(action:()=>Promise<void>){
  setBusy(true);setError("");setMessage("");
  try{await action();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const path=(invId?:string)=>"/properties/"+propertyId+"/leases/"+selected+"/invitations"+(invId?"/"+invId:"");
 const lease=leases.find(l=>l.id===selected);
 return <div className="panel">
   <div className="panel-head"><div><h2>เชิญผู้เช่าเข้าใช้งาน LINE</h2><p>ส่งรหัสให้ผู้เช่า แล้วอนุมัติบัญชี LINE ที่มารับสิทธิ์ก่อนจึงจะอ่านบิลได้</p></div><Link2 size={22}/></div>
   <div className="form"><label className="field"><span>สัญญาเช่า / ผู้เช่า</span><select value={selected} onChange={e=>setSelected(e.target.value)}>
     {leases.map(l=><option key={l.id} value={l.id}>{l.tenantName} · {l.status}{l.tenantLineSubject?" (ผูกบัญชีแล้ว)":""}</option>)}
   </select></label>
   <button type="button" className="btn primary" disabled={busy||!selected||!!lease?.tenantLineSubject||lease?.status!=="ACTIVE"} onClick={()=>void perform(async()=>{
    if(!window.confirm("สร้างรหัสใหม่จะยกเลิกรหัสที่ยังไม่ได้อนุมัติทั้งหมดของสัญญานี้ ยืนยันหรือไม่?"))return;
    const response=await post<NewInvite>(path(),{});setCode(response.token);setMessage("สร้างรหัสใหม่แล้ว มีอายุ 24 ชั่วโมงและใช้งานได้ครั้งเดียว");
    await loadInvites(selected);
   })}>สร้าง Invite Code ใหม่</button>
   {code&&<div className="invite-code"><strong>รหัสลับสำหรับส่งให้ผู้เช่า (แสดงครั้งเดียว)</strong><code>{code}</code><button type="button" className="btn outline" onClick={()=>void navigator.clipboard.writeText(code).then(()=>setMessage("คัดลอกรหัสแล้ว")).catch(()=>setError("คัดลอกไม่ได้ กรุณาเลือกข้อความเอง"))}><Copy size={16}/> คัดลอก Invite Code</button></div>}
   {error&&<p className="notice danger" role="alert">{error}</p>}{message&&<p className="notice success" role="status">{message}</p>}
   <div className="invite-grid">{invites.map(i=><div className="invite-item" key={i.id}>
     <div><strong>{i.claimantName||"รอผู้เช่ารับรหัส"}</strong><small>{i.approvedAt?"อนุมัติและผูก LINE แล้ว":i.revokedAt?"ถูกยกเลิก":i.claimedAt?"รอเจ้าของยืนยันบัญชี":"รอผู้เช่ากรอกรหัส"}</small>
       <small>วันหมดอายุ {new Date(i.expiresAt).toLocaleString("th-TH")}</small></div>
     <div className="actions">
      {i.claimedAt&&!i.approvedAt&&!i.revokedAt&&<button type="button" className="btn primary" disabled={busy}
        onClick={()=>void perform(async()=>{if(!window.confirm("ตรวจสอบตัวตนผู้เช่าชื่อ "+i.claimantName+" แล้วใช่หรือไม่?"))return;
         await post(path(i.id)+"/approve",{});await loadInvites(selected);await loadLeases();setMessage("อนุมัติ LINE ของผู้เช่าแล้ว");})}><ShieldCheck size={16}/> อนุมัติ</button>}
      {!i.approvedAt&&!i.revokedAt&&<button type="button" className="btn outline" disabled={busy} onClick={()=>void perform(async()=>{
        if(!window.confirm("ยกเลิกรหัสหรือคำขอผูกบัญชีนี้?"))return;
        await post(path(i.id)+"/revoke",{});await loadInvites(selected);setMessage("ยกเลิกคำเชิญแล้ว");})}><XCircle size={16}/> ยกเลิก</button>}
     </div>
   </div>)}</div>
   {!invites.length&&<p className="empty">ยังไม่มีคำเชิญสำหรับสัญญาที่เลือก</p>}
   <p className="hint"><RotateCcw size={18}/> หากส่งรหัสผิดคน ให้สร้างรหัสใหม่ทันที และตรวจสอบชื่อ LINE ก่อนกดอนุมัติ</p>
   </div>
  </div>;
}
