import {useEffect,useState} from "react";

type Api={api:<T>(path:string,options?:RequestInit)=>Promise<T>};
type Attachment={id:string;contentType:string;contentLength:number;createdAt:string};
const MAX_BYTES=2*1024*1024;

export function MaintenanceAttachments({api,basePath}:Api&{basePath:string}){
 const [items,setItems]=useState<Attachment[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function reload(){setItems(await api<Attachment[]>(basePath));}
 useEffect(()=>{let active=true;void api<Attachment[]>(basePath).then(v=>{if(active)setItems(v);}).catch(e=>{if(active)setError((e as Error).message);});return()=>{active=false;};},[api,basePath]);
 async function upload(e:React.ChangeEvent<HTMLInputElement>){
  const input=e.currentTarget;const file=input.files?.[0];if(!file)return;
  setError("");
  if(file.size===0||file.size>MAX_BYTES){setError("เลือกภาพขนาดไม่เกิน 2 MB");input.value="";return;}
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setError("รองรับไฟล์ JPG, PNG หรือ WebP");input.value="";return;}
  setBusy(true);
  try{
   const dataBase64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error("อ่านไฟล์ไม่สำเร็จ"));reader.onload=()=>resolve(String(reader.result).split(",",2)[1]??"");reader.readAsDataURL(file);});
   await api(basePath,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contentType:file.type,dataBase64})});
   await reload();
  }catch(err){setError((err as Error).message||"อัปโหลดภาพไม่สำเร็จ");}
  finally{setBusy(false);input.value="";}
 }
 return <section className="maintenance-attachments" aria-label="รูปประกอบงานซ่อม">
  <h4>รูปประกอบ</h4>
  <label className="maintenance-attachment-upload">เพิ่มรูป (JPG, PNG, WebP ไม่เกิน 2 MB)
   <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={busy} />
  </label>
  {busy&&<p role="status">กำลังอัปโหลดรูป…</p>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  {items.length>0&&<ul>{items.map(item=><li key={item.id}><a href={`/v1${basePath}/${item.id}`} aria-label={`ดาวน์โหลดรูปประกอบงานซ่อม ${new Date(item.createdAt).toLocaleDateString("th-TH")}`}>ดาวน์โหลดรูป ({Math.ceil(item.contentLength/1024)} KB)</a></li>)}</ul>}
 </section>;
}
