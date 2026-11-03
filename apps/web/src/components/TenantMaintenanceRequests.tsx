import {useEffect,useState} from "react";
import {ClipboardList,Wrench} from "lucide-react";

type Api={
 api:<T>(path:string,options?:RequestInit)=>Promise<T>;
 post:<T>(path:string,body:unknown)=>Promise<T>;
};
type Lease={leaseId:string;roomNumber:string;propertyName:string};
type Ticket={id:string;title:string;description:string;category:string;
 status:string;createdAt:string;roomId:string|null};
const categories=[
 ["PLUMBING","ประปา/ท่อ"],["ELECTRICAL","ไฟฟ้า"],["APPLIANCE","เครื่องใช้ไฟฟ้า"],
 ["STRUCTURE","อาคาร"],["CLEANING","ทำความสะอาด"],["OTHER","อื่น ๆ"]
];
const labels:Record<string,string>={
 OPEN:"รับแจ้งแล้ว",ACKNOWLEDGED:"เจ้าของรับเรื่องแล้ว",
 IN_PROGRESS:"กำลังดำเนินการ",RESOLVED:"แจ้งว่าแก้ไขแล้ว",
 CLOSED:"ปิดงานแล้ว",CANCELLED:"ยกเลิก"
};
export function TenantMaintenanceRequests({leases,api,post}:Api&{leases:Lease[]}){
 const [rows,setRows]=useState<Ticket[]>([]),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 async function reload(){setRows(await api<Ticket[]>("/tenant/maintenance-tickets"));}
 useEffect(()=>{void reload().catch(e=>setError((e as Error).message));},[]);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();const form=e.currentTarget,data=new FormData(form),leaseId=String(data.get("leaseId")||"");
  setBusy(true);setError("");setMessage("");
  try{
   await post("/tenant/leases/"+leaseId+"/maintenance-tickets",{
    title:String(data.get("title")||"").trim(),
    description:String(data.get("description")||"").trim(),
    category:String(data.get("category"))
   });
   form.reset();await reload();setMessage("ส่งคำขอซ่อมบำรุงให้เจ้าของแล้ว");
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 return <section className="panel">
  <div className="panel-head"><div><h2><Wrench size={19}/> แจ้งซ่อมบำรุง</h2>
   <p>ข้อมูลจะส่งถึงเจ้าของห้องที่เชื่อมกับบัญชีนี้เท่านั้น</p></div></div>
  {leases.length>0?<form className="form" onSubmit={e=>void submit(e)}>
   <label className="field"><span>สัญญาเช่า</span><select name="leaseId">
    {leases.map(l=><option key={l.leaseId} value={l.leaseId}>{l.propertyName} · ห้อง {l.roomNumber}</option>)}
   </select></label>
   <div className="cols2">
    <label className="field"><span>หัวข้อ</span><input name="title" required minLength={3} maxLength={160}/></label>
    <label className="field"><span>ประเภท</span><select name="category">
     {categories.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   </div>
   <label className="field"><span>รายละเอียดอาการ</span>
    <textarea name="description" rows={3} required minLength={3} maxLength={4000}/></label>
   <button className="btn primary" disabled={busy}>ส่งคำขอ</button>
  </form>:<p className="hint">แจ้งซ่อมได้เมื่อเจ้าของยืนยันสัญญาเช่ากับบัญชีนี้แล้ว</p>}
  {error&&<p className="notice danger" role="alert">{error}</p>}
  {message&&<p className="notice success" role="status">{message}</p>}
  <h3 className="section-subtitle"><ClipboardList size={17}/> คำขอของฉัน</h3>
  <div className="claim-list">{rows.map(row=><article className="claim-item" key={row.id}>
   <div className="claim-heading"><b>{row.title}</b>
    <span className="pill">{labels[row.status]||row.status}</span></div>
   <p>{row.description}</p><small>{row.category} · {new Date(row.createdAt).toLocaleDateString("th-TH")}</small>
  </article>)}</div>
  {!rows.length&&<p className="empty">ยังไม่มีคำขอซ่อมบำรุง</p>}
 </section>;
}
