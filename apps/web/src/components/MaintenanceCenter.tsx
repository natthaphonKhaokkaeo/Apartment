import {useEffect,useState} from "react";
import {ClipboardList,Wrench} from "lucide-react";
import {MaintenanceAttachments} from "./MaintenanceAttachments.js";

type Api={
 api:<T>(path:string,options?:RequestInit)=>Promise<T>;
 post:<T>(path:string,body:unknown)=>Promise<T>;
};
type Room={id:string;number:string;status:string};
type Ticket={
 id:string;roomId:string|null;roomNumber:string|null;reporterType:string;
 title:string;description:string;category:string;priority:"LOW"|"NORMAL"|"HIGH"|"URGENT";
 status:"OPEN"|"ACKNOWLEDGED"|"IN_PROGRESS"|"RESOLVED"|"CLOSED"|"CANCELLED";
 dueAt:string|null;overdue:boolean;createdAt:string;
};
const categories=[
 ["PLUMBING","ประปา/ท่อ"],["ELECTRICAL","ไฟฟ้า"],["APPLIANCE","เครื่องใช้ไฟฟ้า"],
 ["STRUCTURE","อาคาร"],["CLEANING","ทำความสะอาด"],["OTHER","อื่น ๆ"]
];
const priorities=["LOW","NORMAL","HIGH","URGENT"] as const;
const transitions:Record<Ticket["status"],Ticket["status"][]>={
 OPEN:["ACKNOWLEDGED","CANCELLED"],
 ACKNOWLEDGED:["IN_PROGRESS","CANCELLED"],
 IN_PROGRESS:["RESOLVED","CANCELLED"],
 RESOLVED:["IN_PROGRESS","CLOSED"],CLOSED:[],CANCELLED:[]
};
const statusNames:Record<Ticket["status"],string>={
 OPEN:"รับแจ้ง",ACKNOWLEDGED:"รับเรื่องแล้ว",IN_PROGRESS:"กำลังดำเนินการ",
 RESOLVED:"แก้ไขแล้ว",CLOSED:"ปิดงาน",CANCELLED:"ยกเลิก"
};
export function MaintenanceCenter({propertyId,rooms,api,post,onRoomChanged}:Api&{
 propertyId:string;rooms:Room[];onRoomChanged:()=>Promise<void>
}){
 const [tickets,setTickets]=useState<Ticket[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 async function reload(){
  setTickets(await api<Ticket[]>("/properties/"+propertyId+"/maintenance-tickets"));
 }
 useEffect(()=>{setError("");void reload().catch(e=>setError((e as Error).message));},[propertyId]);
 async function act(job:()=>Promise<unknown>){
  setBusy(true);setError("");setMessage("");
  try{await job();await reload();setMessage("บันทึกข้อมูลแล้ว");}
  catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 async function create(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();const formEl=e.currentTarget,data=new FormData(formEl);
  await act(async()=>{
   const dueAt=String(data.get("dueAt")||"");
   await post("/properties/"+propertyId+"/maintenance-tickets",{
    roomId:String(data.get("roomId")||"")||null,
    title:String(data.get("title")||"").trim(),
    description:String(data.get("description")||"").trim(),
    category:String(data.get("category")),priority:String(data.get("priority")),
    dueAt:dueAt?new Date(dueAt).toISOString():null
   });
   formEl.reset();
  });
 }
 const statusPath=(id:string)=>"/properties/"+propertyId+"/maintenance-tickets/"+id;
 return <div>
  <section className="panel">
   <div className="panel-head"><div><h2><Wrench size={19}/> เปิดงานซ่อมบำรุง</h2>
    <p>ระบุวันครบกำหนดได้ตามข้อตกลง • ไม่ส่ง LINE อัตโนมัติ</p></div></div>
   <form className="form" onSubmit={e=>void create(e)}>
    <div className="cols2">
     <label className="field"><span>ห้อง (เว้นว่างได้สำหรับพื้นที่ส่วนกลาง)</span>
      <select name="roomId" defaultValue=""><option value="">พื้นที่ส่วนกลาง</option>
       {rooms.map(r=><option key={r.id} value={r.id}>{r.number}</option>)}</select></label>
     <label className="field"><span>ประเภท</span><select name="category">
      {categories.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    <div className="cols2">
     <label className="field"><span>หัวข้อ</span><input name="title" required minLength={3} maxLength={160}/></label>
     <label className="field"><span>ความสำคัญ</span><select name="priority">
      {priorities.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
    </div>
    <label className="field"><span>รายละเอียด</span><textarea name="description" required minLength={3} maxLength={4000} rows={3}/></label>
    <label className="field"><span>กำหนดเสร็จ (ไม่บังคับ)</span><input name="dueAt" type="datetime-local"/></label>
    <button className="btn primary" disabled={busy} type="submit">เปิดรายการซ่อม</button>
   </form>
  </section>
  <section className="panel">
   <div className="panel-head"><div><h2><ClipboardList size={19}/> งานซ่อมบำรุง</h2>
    <p>รายการล่าสุดไม่เกิน 100 รายการ • สถานะที่ปิดแล้วแก้ไขไม่ได้</p></div>
    <button type="button" className="btn outline" disabled={busy} onClick={()=>void reload()}>รีเฟรช</button></div>
   {error&&<p className="notice danger" role="alert">{error}</p>}
   {message&&<p className="notice success" role="status">{message}</p>}
   <div className="claim-list">{tickets.map(t=><article className="claim-item" key={t.id}>
    <div className="claim-heading"><div><b>{t.title}</b>
     <small>{(t.roomNumber?"ห้อง "+t.roomNumber:"พื้นที่ส่วนกลาง")+" · "+t.category+" · "+t.priority+" · "+(t.reporterType==="TENANT"?"ผู้เช่าแจ้ง":"เจ้าของแจ้ง")}</small>
    </div><span className={"pill "+(t.overdue?"occupied":"")}>{statusNames[t.status]}{t.overdue?" · เกินกำหนด":""}</span></div>
    <p>{t.description}</p>
    <MaintenanceAttachments api={api} basePath={`/properties/${propertyId}/maintenance-tickets/${t.id}/attachments`} />
    <div className="actions">
     {t.dueAt&&<span className="hint">ครบกำหนด {new Date(t.dueAt).toLocaleString("th-TH")}</span>}
     {transitions[t.status].map(next=><button key={next} type="button" className="btn outline"
      disabled={busy} onClick={()=>void act(()=>api(statusPath(t.id),{
       method:"PATCH",body:JSON.stringify({status:next})
      }))}>{statusNames[next]}</button>)}
    </div>
   </article>)}</div>
   {!tickets.length&&<p className="empty">ยังไม่มีงานซ่อมบำรุง</p>}
  </section>
  <section className="panel">
   <div className="panel-head"><div><h2>สถานะห้องซ่อมบำรุง</h2>
    <p>คืนห้องเป็นสถานะว่างได้เมื่อไม่มีสัญญาใช้งานและปิดงานซ่อมทุกใบแล้ว</p></div></div>
   <div className="claim-list">{rooms.filter(r=>r.status!=="OCCUPIED").map(r=><div className="claim-item" key={r.id}>
    <div className="claim-heading"><b>ห้อง {r.number}</b><span className="pill">{r.status}</span></div>
    {r.status==="AVAILABLE"?<form className="form" onSubmit={e=>{
      e.preventDefault();const data=new FormData(e.currentTarget);
      void act(()=>post("/properties/"+propertyId+"/rooms/"+r.id+"/maintenance/enter",{
       reason:String(data.get("reason")||"")
      }).then(onRoomChanged));
     }}><label className="field"><span>เหตุผลนำห้องเข้าซ่อม</span>
      <input name="reason" required minLength={8} maxLength={500}/></label>
      <button className="btn outline" disabled={busy}>เริ่มซ่อม</button></form>:
     <button className="btn outline" disabled={busy} onClick={()=>void act(()=>
      post("/properties/"+propertyId+"/rooms/"+r.id+"/maintenance/return",{confirmed:true})
       .then(onRoomChanged)
     )}>คืนห้องเป็นห้องว่าง</button>}
   </div>)}</div>
  </section>
 </div>;
}
