import {useCallback,useEffect,useState} from "react";
import {Check} from "lucide-react";

type Item={id:string;kind:string;title:string;body:string;readAt:string|null;createdAt:string};
type Api=<T>(path:string,options?:RequestInit)=>Promise<T>;
export function NotificationsInbox({api}:{api:Api}){
 const [items,setItems]=useState<Item[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{setLoading(true);setError("");try{const result=await api<{items:Item[]}>("/notifications?limit=50");setItems(result.items);}catch(e){setError(e instanceof Error?e.message:"โหลดการแจ้งเตือนไม่สำเร็จ");}finally{setLoading(false);}},[api]);
 useEffect(()=>{void load();},[load]);
 const markRead=async(id:string)=>{try{await api(`/notifications/${id}/read`,{method:"POST"});setItems(rows=>rows.map(row=>row.id===id?{...row,readAt:new Date().toISOString()}:row));}catch(e){setError(e instanceof Error?e.message:"อัปเดตสถานะไม่สำเร็จ");}};
 return <section className="panel"><div className="panel-head"><div><h2>การแจ้งเตือน</h2><p>บิล ห้องพัก และการเปลี่ยนสิทธิในองค์กรของคุณ</p></div><button className="btn outline" onClick={()=>void load()} disabled={loading}>รีเฟรช</button></div>
  {error&&<div role="alert" className="notice error">{error}</div>}{loading?<p>กำลังโหลด…</p>:items.length===0?<p className="hint">ยังไม่มีการแจ้งเตือน</p>:<div className="notification-list">{items.map(item=><article key={item.id} className={"notification-item "+(item.readAt?"read":"unread")}><div><b>{item.title}</b><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString("th-TH")}</small></div>{!item.readAt&&<button className="btn outline" onClick={()=>void markRead(item.id)} aria-label="ทำเครื่องหมายว่าอ่านแล้ว"><Check size={16}/> อ่านแล้ว</button>}</article>)}</div>}
 </section>;
}
