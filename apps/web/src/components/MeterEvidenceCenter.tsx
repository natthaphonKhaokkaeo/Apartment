import {useEffect,useRef,useState} from "react";
import {readingToMilli} from "@apartment/domain";
type Photo={id:string;scanVerdict:string};
type Reading={id:string;kind:string;readAt:string;value:string;photos:Photo[];reviews:{id:string;action:string;reason:string;assessment:{kind:string}}[]};
type Props={propertyId:string;rooms:{id:string;number:string}[];canUpload:boolean;canReview:boolean;api:<T>(path:string,options?:RequestInit)=>Promise<T>;post:<T>(path:string,body:unknown,headers?:HeadersInit)=>Promise<T>};
export function MeterEvidenceCenter({propertyId,rooms,canUpload,canReview,api,post}:Props){
 const [roomId,setRoomId]=useState(""),[kind,setKind]=useState("WATER"),[rows,setRows]=useState<Reading[]>([]),[readingId,setReadingId]=useState("");
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [file,setFile]=useState<File|null>(null),[viewed,setViewed]=useState(""),[threshold,setThreshold]=useState(""),[reason,setReason]=useState(""),[action,setAction]=useState("REQUIRES_CORRECTION");
 const fileInput=useRef<HTMLInputElement>(null),uploadKey=useRef(""),reviewKey=useRef({signature:"",key:""});
 const base="/properties/"+propertyId+"/rooms/"+roomId+"/meter-records";
 const active=useRef(base+"?kind="+kind);active.current=base+"?kind="+kind;
 const selected=rows.find(r=>r.id===readingId);
 useEffect(()=>{setRoomId(previous=>rooms.some(r=>r.id===previous)?previous:(rooms[0]?.id||""));},[rooms,propertyId]);
 useEffect(()=>{
  let current=true;setRows([]);setReadingId("");setViewed("");setError("");setNotice("");setFile(null);uploadKey.current="";
  if(!roomId){setLoading(false);return;}
  setLoading(true);
  void api<{readings:Reading[]}>(base+"?kind="+kind).then(result=>{if(current){setRows(result.readings);setReadingId(result.readings[0]?.id||"");}}).catch(e=>{if(current)setError((e as Error).message);}).finally(()=>{if(current)setLoading(false);});
  return ()=>{current=false;};
 },[api,base,kind,roomId]);
 useEffect(()=>{setViewed("");setFile(null);uploadKey.current="";setReason("");if(fileInput.current)fileInput.current.value="";},[readingId]);
 async function load(){
  const target=base+"?kind="+kind,result=await api<{readings:Reading[]}>(target);
  if(active.current===target){setRows(result.readings);setReadingId(previous=>result.readings.some(r=>r.id===previous)?previous:(result.readings[0]?.id||""));}
 }
 async function upload(){
  if(!file||!readingId)return;
  setBusy(true);setError("");setNotice("");
  try{
   if(file.size>4_000_000)throw Error("รูปต้องไม่เกิน 4 MB");
   if(!uploadKey.current)uploadKey.current=crypto.randomUUID();
   const form=new FormData();form.set("photo",file);
   await api(base+"/"+readingId+"/photos",{method:"POST",body:form,headers:{"idempotency-key":uploadKey.current}});
   uploadKey.current="";setFile(null);if(fileInput.current)fileInput.current.value="";
   setNotice("บันทึกรูปมิเตอร์แบบส่วนตัวแล้ว");await load();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function review(){
  if(!readingId)return;
  setBusy(true);setError("");setNotice("");
  try{
   const maxDailyMilli=readingToMilli(threshold.trim());
   if(!maxDailyMilli)throw Error("เกณฑ์การใช้ต่อวันต้องมากกว่า 0");
   const body={action,maxDailyMilli,reason:reason.trim()},signature=JSON.stringify({base,readingId,body});
   if(reviewKey.current.signature!==signature)reviewKey.current={signature,key:crypto.randomUUID()};
   await post(base+"/"+readingId+"/reviews",body,{"idempotency-key":reviewKey.current.key});
   reviewKey.current={signature:"",key:""};setReason("");setNotice("บันทึกผลตรวจแล้ว ไม่เปลี่ยนเลขมิเตอร์หรือบิลเดิม");await load();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <section className="panel" aria-label="หลักฐานมิเตอร์">
  <div className="panel-head"><div><h2>รูปมิเตอร์และผลตรวจความผิดปกติ</h2><p>รูปถูกแปลงเป็น WebP ส่วนตัวและตัดข้อมูลภาพเดิมออก ผลตรวจเป็นคำแนะนำ ไม่แก้ไขมิเตอร์หรือยอดบิลอัตโนมัติ</p></div></div>
  <div className="cols2"><label className="field"><span>ห้องสำหรับหลักฐานมิเตอร์</span><select disabled={busy} value={roomId} onChange={e=>setRoomId(e.target.value)}>{rooms.map(r=><option key={r.id} value={r.id}>{r.number}</option>)}</select></label><label className="field"><span>ประเภทหลักฐานมิเตอร์</span><select disabled={busy} value={kind} onChange={e=>setKind(e.target.value)}><option value="WATER">น้ำ</option><option value="ELECTRIC">ไฟ</option></select></label></div>
  {!!roomId&&<button type="button" className="btn" disabled={busy||loading} onClick={()=>void load().catch(e=>setError((e as Error).message))}>โหลดเลขมิเตอร์และหลักฐานใหม่</button>}
  {loading&&<p role="status">กำลังโหลดหลักฐานมิเตอร์...</p>}
  {error&&<p className="notice danger" role="alert">{error}</p>}
  {notice&&<p className="notice success" role="status">{notice}</p>}
  {!loading&&!rows.length&&<p className="empty">ยังไม่มีเลขมิเตอร์ที่บันทึกในห้องและประเภทนี้</p>}
  {!!rows.length&&<><label className="field"><span>เลขมิเตอร์ที่แนบหลักฐาน</span><select disabled={busy} value={readingId} onChange={e=>setReadingId(e.target.value)}>{rows.map(r=><option key={r.id} value={r.id}>{r.readAt} — {r.value}</option>)}</select></label>
   {canUpload&&<form className="form" aria-label="แนบรูปมิเตอร์" onSubmit={e=>{e.preventDefault();void upload();}}><label className="field"><span>รูปหลักฐานมิเตอร์</span><input ref={fileInput} type="file" required accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]||null);uploadKey.current="";}}/></label><button className="btn primary" disabled={busy||!file} type="submit">บันทึกรูปมิเตอร์</button></form>}
   {selected?.photos.length===0&&<p className="empty">เลขมิเตอร์นี้ยังไม่มีรูปหลักฐาน</p>}
   {selected?.photos.map(photo=><div key={photo.id}><p>{photo.scanVerdict==="CLEAN"?"ผ่านเครื่องมือตรวจมัลแวร์":"ยังไม่ได้ตรวจมัลแวร์ (DEV)"}</p><button className="btn" type="button" onClick={()=>setViewed(viewed===photo.id?"":photo.id)}>เปิด/ปิดรูปหลักฐาน</button>{viewed===photo.id&&<img src={"/v1"+base+"/"+readingId+"/photos/"+photo.id+"/content"} alt="รูปหลักฐานเลขมิเตอร์ที่เลือก" style={{maxWidth:"100%",maxHeight:360,objectFit:"contain"}}/>}</div>)}
   {canReview&&<form className="form" aria-label="ตรวจความผิดปกติมิเตอร์" onSubmit={e=>{e.preventDefault();void review();}}><h3>ผลตรวจโดยเจ้าของ</h3><label className="field"><span>เกณฑ์การใช้สูงสุดต่อวัน (หน่วย)</span><input required inputMode="decimal" value={threshold} onChange={e=>setThreshold(e.target.value)}/></label><small>เจ้าของต้องตรวจเกณฑ์ตามชนิดมิเตอร์ก่อนบันทึก ระบบจะเก็บเกณฑ์นี้พร้อมผลประเมิน</small><label className="field"><span>ผลตรวจมิเตอร์</span><select value={action} onChange={e=>setAction(e.target.value)}><option value="REQUIRES_CORRECTION">ต้องตรวจและแก้ไขผ่านขั้นตอนมิเตอร์</option><option value="ACKNOWLEDGED">รับทราบผลตรวจ</option></select></label><label className="field"><span>เหตุผลตรวจมิเตอร์</span><input required minLength={15} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label><button type="submit" className="btn primary" disabled={busy}>บันทึกผลตรวจมิเตอร์</button></form>}
   {selected?.reviews.map(row=><div className="room-detail" key={row.id}><b>{row.action} — {row.assessment.kind}</b><p>{row.reason}</p></div>)}
  </>}
 </section>;
}
