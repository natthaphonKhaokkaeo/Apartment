import {useEffect,useMemo,useState} from "react";
import {Gauge,RefreshCw} from "lucide-react";
import {meterPeriodsStartingInMonth,type Cadence} from "@apartment/domain";

type Room={id:string;number:string;status:string};
type Reading={id:string;roomId:string;kind:"WATER"|"ELECTRIC";readAt:string;value:string;createdAt:string};
type Props={propertyId:string;rooms:Room[];cadence:string;rollingAnchor?:string|null;api:<T>(path:string,options?:RequestInit)=>Promise<T>;
 post:<T>(path:string,body:unknown,headers?:HeadersInit)=>Promise<T>;onSaved:()=>void};
const currentMonth=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,7);

/** Month-only, auditable meter entry, shared by the Billing and Meter screens. */
export function MeterMonthlyEditor({propertyId,rooms,cadence,rollingAnchor,api,post,onSaved}:Props){
 const [roomId,setRoomId]=useState("");
 const [month,setMonth]=useState(currentMonth),[cycleIndex,setCycleIndex]=useState(0),[kind,setKind]=useState<"WATER"|"ELECTRIC">("WATER");
 const [rows,setRows]=useState<Reading[]>([]),[value,setValue]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{setRoomId(id=>rooms.some(r=>r.id===id)?id:rooms[0]?.id??"");},[rooms]);
 async function reload(){setLoading(true);try{setRows(await api<Reading[]>(`/properties/${propertyId}/readings`));setError("");}
  catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{let active=true;
  void api<Reading[]>(`/properties/${propertyId}/readings`).then(result=>{if(active){setRows(result);setError("");}})
   .catch(e=>{if(active)setError((e as Error).message);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[api,propertyId]);
 const cycles=useMemo(()=>{
  if(!month)return [];
  try{return meterPeriodsStartingInMonth(Number(month.slice(0,4)),Number(month.slice(5)),
   cadence as Cadence,rollingAnchor);}catch{return [];}
 },[month,cadence,rollingAnchor]);
 const activeCycle=cycles[cycleIndex];
 const selected=useMemo(()=>{
  if(!roomId||!activeCycle)return undefined;
  const filtered=rows.filter(r=>r.roomId===roomId&&r.kind===kind);
  const exact=filtered.find(r=>r.readAt===activeCycle.endExclusive);
  if(exact||cadence!=="MONTHLY")return exact;
  return filtered.filter(r=>r.readAt.slice(0,7)===month&&r.readAt<activeCycle.endExclusive)
   .sort((a,b)=>b.readAt.localeCompare(a.readAt))[0];
 },[rows,roomId,month,kind,activeCycle,cadence]);
 useEffect(()=>setValue(selected?.value??""),[selected?.id,selected?.value,roomId,month,kind]);
 async function save(){
  if(!roomId||!month||!activeCycle||!/^\d{1,11}(?:\.\d{1,3})?$/.test(value.trim())){
   setError("เลือกห้อง เดือน และเลขมิเตอร์ที่ถูกต้อง (ทศนิยมไม่เกิน 3 ตำแหน่ง)");return;
  }
  setBusy(true);setError("");setNotice("");
  try{
   await post(`/properties/${propertyId}/readings`,{roomId,kind,month,
    ...(cadence!=="MONTHLY"?{periodEndExclusive:activeCycle.endExclusive}:{}),value:value.trim()});
   onSaved();await reload();
   setNotice(`บันทึกเลข${kind==="WATER"?"น้ำ":"ไฟ"}รอบ ${month} เรียบร้อย ${selected?"(อัปเดตค่าเดิม)":"(สร้างรายการใหม่)"}`);
  }catch(e){
   const message=(e as Error).message;
   setError(message.includes("METER_READING_USED_BY_INVOICE")?
    "เลขมิเตอร์เดือนนี้ถูกใช้ในใบแจ้งหนี้ที่ออกแล้ว ไม่สามารถแก้ทับได้ กรุณาดำเนินการแก้ไขบิลตามขั้นตอนตรวจสอบ":
    message.includes("METER_REPLACEMENT_BOUNDARY_LOCKED")?
    "วันที่ปิดงวดตรงกับการเปลี่ยนมิเตอร์จริง จึงแก้เลขมิเตอร์ใหม่ทับค่าที่ระบบสร้างอัตโนมัติไม่ได้":message);
  }finally{setBusy(false);}
 }
 return <section className="panel" aria-label="แก้ไขเลขมิเตอร์รายเดือนก่อนออกบิล">
  <div className="panel-head"><div><h2><Gauge size={19}/> เลขมิเตอร์รายเดือน</h2>
   <p>เลือกเดือนและแก้ไขเลขได้ก่อนออกบิล ข้อมูลเดือนอื่นไม่ทำให้บันทึกย้อนหลังไม่สำเร็จ · เก็บประวัติผู้แก้ไขทุกครั้ง</p></div>
   <button type="button" className="btn outline" onClick={()=>void reload()} disabled={busy||loading}><RefreshCw size={15}/> โหลดเลขล่าสุด</button></div>
  <div className="cols2">
   <label className="field"><span>ห้องพัก</span><select value={roomId} onChange={e=>{setRoomId(e.target.value);setNotice("");}}>
    {rooms.length===0&&<option value="">ไม่มีห้องพัก</option>}
    {rooms.map(room=><option key={room.id} value={room.id}>{room.number}</option>)}</select></label>
   <label className="field"><span>รอบเดือน</span><input type="month" value={month} onChange={e=>{setMonth(e.target.value);setCycleIndex(0);setNotice("");}}/></label>
   {cadence!=="MONTHLY"&&<label className="field"><span>งวดบิลภายในเดือน</span>
    <select value={cycleIndex} onChange={e=>{setCycleIndex(Number(e.target.value));setNotice("");}}>
     {cycles.length===0&&<option value={0}>ไม่มีงวดบิลสำหรับเดือนนี้</option>}
     {cycles.map((cycle,i)=><option key={cycle.start} value={i}>งวด {i+1} · {cycle.start} ถึง {cycle.endExclusive} (ไม่รวมวันสิ้นสุด)</option>)}
    </select></label>}
   <label className="field"><span>ประเภทมิเตอร์</span><select value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setNotice("");}}>
    <option value="WATER">น้ำ</option><option value="ELECTRIC">ไฟ</option></select></label>
   <label className="field"><span>เลขสะสมปิดรอบเดือน</span><input inputMode="decimal" value={value}
    placeholder="เช่น 128.000" onChange={e=>setValue(e.target.value)}/></label>
  </div>
  <p className="hint">{loading?"กำลังโหลดข้อมูลเลขมิเตอร์…":selected?
   `ค่าที่บันทึก: ${selected.value} · วันที่อ้างอิง: ${selected.readAt} · ระบบจะปรับค่าเดิมเมื่อบันทึกซ้ำ`:
   "ยังไม่มีค่าเดือนนี้ หากเป็นการออกบิลครั้งแรกระบบใช้ค่าเริ่มต้น 0 (เมื่อไม่มีประวัติก่อนหน้า)"}</p>
  <div className="actions"><button className="btn primary" type="button" disabled={busy||loading||!roomId||!month||!activeCycle}
   onClick={()=>void save()}>{busy?"กำลังบันทึก…":"บันทึก / แก้ไขเลขมิเตอร์เดือนนี้"}</button></div>
  {error&&<p className="notice danger" role="alert">{error}</p>}
  {notice&&<p className="notice success" role="status">{notice}</p>}
 </section>;
}
