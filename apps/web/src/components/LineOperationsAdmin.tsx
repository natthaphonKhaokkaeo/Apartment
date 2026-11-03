import {useEffect,useState} from "react";
import {Activity,AlertTriangle,RefreshCcw,ShieldCheck} from "lucide-react";

type Api={
 api:<T>(path:string,options?:RequestInit)=>Promise<T>;
 post:<T>(path:string,body:unknown)=>Promise<T>
};
type Status="QUEUED"|"SENDING"|"RETRY"|"ACCEPTED"|"SIMULATED"|"DEAD";
type Overview={
 counts:Record<Status,number>;quotaWindowUsed:number;quotaPerMinute:number;
 unreviewedDeadCount:number;
 expiredSendingLeaseCount:number;oldestActiveAgeSeconds:number|null;
 oldestUnreviewedDeadAgeSeconds:number|null;checkedAt:string;notice:string
};
type Dead={id:string;status:Status;templateKey:string;attempts:number;
 createdAt:string;reviewedAt:string|null;lastErrorCode:string|null};
type Alert={id:string;kind:string;openedAt:string;lastSeenAt:string;
 resolvedAt:string|null;acknowledgedAt:string|null};
const alertLabels:Record<string,string>={
 DEAD_UNREVIEWED:"มี Dead-letter ที่ยังไม่ตรวจสอบ",
 EXPIRED_SENDING_LEASE:"มีงาน SENDING ที่หมดอายุ Lease",
 QUEUE_BACKLOG:"มีคิวรอส่งนานเกิน 15 นาที"
};
const statusLabels:Record<Status,string>={
 QUEUED:"รอส่ง",SENDING:"กำลังดำเนินการ",RETRY:"รอ Retry",
 ACCEPTED:"Provider รับคำขอ",SIMULATED:"จำลอง (ไม่ได้ส่ง)",DEAD:"หยุดส่ง"
};
export function LineOperationsAdmin({organizationId,api,post}:Api&{organizationId:string}){
 const [overview,setOverview]=useState<Overview|null>(null);
 const [dead,setDead]=useState<Dead[]>([]);
 const [alerts,setAlerts]=useState<Alert[]>([]);
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [working,setWorking]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function reload(){
  if(!organizationId){setOverview(null);setDead([]);setAlerts([]);return;}
  const [stats,records,incidents]=await Promise.all([
   api<Overview>("/admin/line-operations/overview?organizationId="+organizationId),
   api<Dead[]>("/admin/line-operations/dead-letters?organizationId="+organizationId+"&limit=40"),
   api<Alert[]>("/admin/line-operations/alerts?organizationId="+organizationId+"&limit=40")
  ]);
  setOverview(stats);setDead(records);setAlerts(incidents);
 }
 useEffect(()=>{
  let cancelled=false;setOverview(null);setDead([]);setAlerts([]);setError("");
  if(organizationId){
   void Promise.all([
    api<Overview>("/admin/line-operations/overview?organizationId="+organizationId),
    api<Dead[]>("/admin/line-operations/dead-letters?organizationId="+organizationId+"&limit=40"),
    api<Alert[]>("/admin/line-operations/alerts?organizationId="+organizationId+"&limit=40")
   ]).then(([stats,records,incidents])=>{
    if(!cancelled){setOverview(stats);setDead(records);setAlerts(incidents);}
   })
   .catch(e=>{if(!cancelled)setError((e as Error).message);});
  }
  return()=>{cancelled=true;};
 },[organizationId,api]);
 async function review(id:string){
  setWorking(true);setError("");setNotice("");
  try{
   const reviewReason=(notes[id]||"").trim();
   if(reviewReason.length<15)throw Error("กรุณาระบุเหตุผลตรวจสอบอย่างน้อย 15 ตัวอักษร");
   await post("/admin/line-operations/dead-letters/"+id+"/acknowledge",{
    organizationId,reviewReason
   });
   await reload();setNotice("บันทึกการรับทราบแล้ว โดยไม่ได้ส่งข้อความซ้ำ");
  }catch(e){setError((e as Error).message);}
  finally{setWorking(false);}
 }
 async function acknowledgeAlert(id:string){
  setWorking(true);setError("");setNotice("");
  try{
   await post("/admin/line-operations/alerts/"+id+"/acknowledge",{organizationId});
   await reload();
   setNotice("รับทราบ Alert แล้ว ไม่มีการส่งข้อความ LINE และ Alert ยังอยู่จนกว่าสาเหตุหมดไป");
  }catch(e){setError((e as Error).message);}
  finally{setWorking(false);}
 }
 return <section className="panel">
  <div className="panel-head"><div><h2><Activity size={20}/> LINE Outbox Monitoring</h2>
   <p>เฉพาะผู้ดูแลระบบ · ข้อมูลรวมขององค์กรที่เลือก · ไม่แสดงข้อความหรือ LINE User ID</p></div>
   <button type="button" className="btn outline" disabled={working} onClick={()=>void reload().catch(e=>setError((e as Error).message))}>
    <RefreshCcw size={16}/> โหลดใหม่
   </button></div>
  {!organizationId&&<p className="hint">เลือกองค์กรเพื่อดูสถานะแจ้งเตือน</p>}
  {error&&<p className="notice danger">{error}</p>}
  {notice&&<p className="notice success">{notice}</p>}
  {overview&&<>
   <div className="stats">{(Object.entries(overview.counts) as [Status,number][]).map(([status,total])=>
    <div className="stat" key={status}><span>{statusLabels[status]}</span><strong>{total}</strong></div>)}</div>
   <div className="rate-row"><span>LINE Send Reservations / 60 วินาที (องค์กรนี้)</span>
    <b>{overview.quotaWindowUsed} / {overview.quotaPerMinute}</b></div>
   <div className="rate-row"><span>Dead-letter ที่ยังไม่ตรวจสอบ</span><b>{overview.unreviewedDeadCount}</b></div>
   <div className="rate-row"><span>งาน SENDING ที่หมด Lease</span><b>{overview.expiredSendingLeaseCount}</b></div>
   <p className="hint"><ShieldCheck size={15}/> ACCEPTED หมายถึง LINE API รับคำขอ ไม่ใช่ผู้รับอ่านแล้ว ส่วน SIMULATED ไม่เคยส่งจริง</p>
   {overview.unreviewedDeadCount>0&&<p className="notice danger"><AlertTriangle size={16}/> มีรายการที่ต้องตรวจสอบก่อนดำเนินการต่อ</p>}
   <h3>Incident Alerts ขององค์กรนี้ (ไม่ส่งออกภายนอก)</h3>
   {alerts.filter(alert=>!alert.resolvedAt).map(alert=><div className="notification-consent-item" key={alert.id}>
    <div><b><AlertTriangle size={15}/> {alertLabels[alert.kind]||alert.kind}</b>
     <p className="hint">เริ่มตรวจพบ {new Date(alert.openedAt).toLocaleString("th-TH")}</p>
     <small>ตรวจล่าสุด {new Date(alert.lastSeenAt).toLocaleString("th-TH")}</small>
    </div>
    {alert.acknowledgedAt?<span className="pill vacant">รับทราบแล้ว</span>:
     <button className="btn outline" type="button" disabled={working}
      onClick={()=>void acknowledgeAlert(alert.id)}>รับทราบ Alert</button>}
   </div>)}
   {!alerts.some(alert=>!alert.resolvedAt)&&<p className="hint">ไม่มี Alert ที่เปิดอยู่ในองค์กรนี้</p>}
   <h3>Dead-letter ล่าสุด (สูงสุด 40 รายการ)</h3>
   {dead.map(item=><div key={item.id} className="notification-consent-item">
    <div><b>{item.templateKey}</b>
     <p className="hint">{statusLabels[item.status]} · ลองแล้ว {item.attempts} ครั้ง · {item.lastErrorCode||"ไม่มีรหัส"}</p>
     <small>{new Date(item.createdAt).toLocaleString("th-TH")}</small>
    </div>
    {item.reviewedAt?<span className="pill vacant">ตรวจสอบแล้ว</span>:
     <div className="consent-action">
      <label className="field"><span>เหตุผลที่รับทราบ (ไม่ควรระบุข้อมูลส่วนตัว)</span>
       <input minLength={15} maxLength={500} value={notes[item.id]||""}
        onChange={e=>setNotes(prev=>({...prev,[item.id]:e.target.value}))}/>
      </label>
      <button type="button" className="btn outline" disabled={working}
       onClick={()=>void review(item.id)}>บันทึกรับทราบ (ไม่ส่งซ้ำ)</button>
     </div>}
   </div>)}
   {!dead.length&&<p className="hint">ไม่มี Dead-letter ในองค์กรนี้</p>}
  </>}
 </section>;
}
