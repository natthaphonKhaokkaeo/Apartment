import {useEffect,useState} from "react";
import {Bell,ShieldCheck,ShieldOff} from "lucide-react";

type Api={api:<T>(path:string,options?:RequestInit)=>Promise<T>};
type Preference={
 leaseId:string;propertyName:string;enabled:boolean;available:boolean;
 grantedAt:string|null;revokedAt:string|null;outboundActive:boolean;policyVersion:string
};
export function TenantNotificationPreferences({api,leaseKey}:Api&{leaseKey:string}){
 const [preferences,setPreferences]=useState<Preference[]>([]);
 const [confirmed,setConfirmed]=useState<Record<string,boolean>>({});
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{
  let cancelled=false;
  void api<Preference[]>("/tenant/notification-consents").then(rows=>{
   if(!cancelled)setPreferences(rows);
  }).catch(e=>{if(!cancelled)setError((e as Error).message);});
  return()=>{cancelled=true;};
 },[api,leaseKey]);
 async function changeConsent(item:Preference,enabled:boolean){
  setBusy(item.leaseId);setError("");setNotice("");
  try{
   const body=enabled
    ?{enabled:true,policyVersion:"2026-11-v1",acknowledgedPurpose:true}
    :{enabled:false};
   await api("/tenant/leases/"+item.leaseId+"/notification-consent",{
    method:"PUT",body:JSON.stringify(body)
   });
   const rows=await api<Preference[]>("/tenant/notification-consents");
   setPreferences(rows);setConfirmed(v=>({...v,[item.leaseId]:false}));
   setNotice(enabled
    ?"บันทึกความยินยอมแล้ว เมื่อระบบเปิดการแจ้งเตือนจริงจึงจะเริ่มส่งข้อความ"
    :"ยกเลิกความยินยอมแล้ว จะไม่สร้างข้อความใหม่และระงับรายการที่รอส่ง");
  }catch(e){setError((e as Error).message);}
  finally{setBusy(null);}
 }
 if(!preferences.length&&!error)return null;
 return <section className="panel" aria-label="ตั้งค่าการแจ้งเตือน LINE">
  <div className="panel-head"><div>
   <h2><Bell size={19}/> การแจ้งเตือนผ่าน LINE</h2>
   <p>เลือกรับข่าวสารเกี่ยวกับใบแจ้งหนี้ วันครบกำหนดชำระ และสถานะงานซ่อมจากหอพักของคุณ</p>
  </div><ShieldCheck size={22}/></div>
  <p className="hint">การเปิดรับเป็นความสมัครใจ ไม่กระทบสิทธิ์การดูใบแจ้งหนี้ และยกเลิกได้ทุกเมื่อ โดยไม่ต้องติดต่อเจ้าของหอพัก</p>
  {error&&<p role="alert" className="notice danger">{error}</p>}
  {notice&&<p role="status" className="notice success">{notice}</p>}
  {preferences.map(item=><div key={item.leaseId} className="notification-consent-item">
   <div><b>{item.propertyName}</b>
    <p className="hint">{item.enabled
     ?"ยินยอมรับการแจ้งเตือนแล้ว"
     :item.available?"ยังไม่ได้ให้ความยินยอม":"LINE OA ของหอพักนี้ยังไม่พร้อมเปิดรับการแจ้งเตือน"}</p>
    {item.enabled&&item.grantedAt&&
     <small>ให้ความยินยอมเมื่อ {new Date(item.grantedAt).toLocaleString("th-TH")}</small>}
    {!item.outboundActive&&<small>การส่งข้อความ LINE จริงยังไม่เปิดใช้งาน</small>}
   </div>
   {item.enabled?
    <button type="button" className="btn outline" disabled={busy!==null}
     onClick={()=>void changeConsent(item,false)}>
     <ShieldOff size={15}/> ยกเลิกความยินยอม
    </button>:
    <div className="consent-action">
     <label className="consent-ack">
      <input type="checkbox" disabled={!item.available||busy!==null}
       checked={!!confirmed[item.leaseId]}
       onChange={e=>setConfirmed(v=>({...v,[item.leaseId]:e.target.checked}))}/>
      <span>ฉันยินยอมให้หอพักนี้ส่งข้อความแจ้งเตือนผ่าน LINE OA ไปยังบัญชี LINE ที่ผูกไว้ โดยใช้เพื่อแจ้งบิล กำหนดชำระ และงานซ่อมเท่านั้น</span>
     </label>
     <button type="button" className="btn primary"
      disabled={!item.available||!confirmed[item.leaseId]||busy!==null}
      onClick={()=>void changeConsent(item,true)}>
      <Bell size={15}/> ยินยอมรับการแจ้งเตือน
     </button>
    </div>}
  </div>)}
 </section>;
}
