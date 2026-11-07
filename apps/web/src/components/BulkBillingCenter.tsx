import {useCallback,useEffect,useMemo,useState} from "react";
import {Layers3,RefreshCw,ShieldCheck,TriangleAlert} from "lucide-react";

type RoomPreview={roomId:string;roomNumber:string;leaseId:string|null;status:"READY"|"SKIPPED";
 amountSatang:number|null;lines:Array<{type:string;description:string;amountSatang:number}>;reason:string|null};
type Run={id:string;status:"PREVIEWED"|"COMPLETED"|"STALE";previewHash:string;
 periodStart:string;periodEnd:string;issuedCount:number;createdAt:string;completedAt:string|null;
 previewSnapshot:{start:string;endExclusive:string;rooms:RoomPreview[]}};
type Props={propertyId:string;cadence:string;
 api:<T>(path:string,options?:RequestInit)=>Promise<T>;
 post:<T>(path:string,body:unknown,headers?:HeadersInit)=>Promise<T>;
 onIssued:()=>Promise<void>;
};
const money=(n:number)=>(n/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
function monthStart(d:Date){return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)).toISOString().slice(0,10);}
function nextMonthStart(d:Date){return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)).toISOString().slice(0,10);}
function initialPeriod(cadence:string){
 const local=new Date(Date.now()+7*60*60*1000),day=local.getUTCDate();
 if(cadence==="SEMI_MONTHLY"){
  if(day<=15)return {start:monthStart(local),endExclusive:new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),16)).toISOString().slice(0,10)};
  return {start:new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),16)).toISOString().slice(0,10),endExclusive:nextMonthStart(local)};
 }
 return {start:monthStart(local),endExclusive:nextMonthStart(local)};
}
const reasonText:Record<string,string>={
 FULL_PERIOD_ACTIVE_LEASE_REQUIRED:"ไม่มีสัญญาที่ใช้งานตลอดรอบบิล",
 METER_BOUNDARY_READING_REQUIRED:"ยังไม่มีเลขมิเตอร์ต้นหรือปลายรอบ",
 COMPLIANCE_REVIEW_REQUIRED:"อัตราค่าน้ำ/ไฟยังไม่ผ่านการตรวจสอบ",
 TARIFF_ABOVE_REVIEWED_LIMIT:"อัตราค่าน้ำ/ไฟเกินเพดานที่อนุมัติ",
 PERIOD_ALREADY_BILLED:"มีใบแจ้งหนี้รอบนี้แล้ว",
 PERIOD_OVERLAP_ALREADY_BILLED:"ช่วงรอบบิลซ้อนกับใบแจ้งหนี้เดิม",
 INVALID_BILLING_PERIOD:"วันที่ไม่ตรงรอบบิลของที่พัก"
};

export function BulkBillingCenter({propertyId,cadence,api,post,onIssued}:Props){
 const initial=useMemo(()=>initialPeriod(cadence),[cadence]);
 const [start,setStart]=useState(initial.start),[endExclusive,setEndExclusive]=useState(initial.endExclusive),[note,setNote]=useState("");
 const [runs,setRuns]=useState<Run[]>([]),[active,setActive]=useState<Run|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const path="/properties/"+propertyId+"/billing-batch-runs";
 const reload=useCallback(async()=>setRuns(await api<Run[]>(path)),[api,path]);
 useEffect(()=>{setStart(initial.start);setEndExclusive(initial.endExclusive);},[initial.start,initial.endExclusive]);
 useEffect(()=>{let live=true;void api<Run[]>(path).then(rows=>{if(live)setRuns(rows);})
  .catch(e=>{if(live)setError((e as Error).message);});return()=>{live=false;};},[api,path]);
 const ready=active?.previewSnapshot.rooms.filter(r=>r.status==="READY")??[];
 const total=ready.reduce((sum,r)=>sum+(r.amountSatang??0),0);
 async function preview(){
  setBusy(true);setError("");setNotice("");
  try{
   const result=await post<Run>(path+"/preview",{start,endExclusive,note:note.trim()},{"idempotency-key":crypto.randomUUID()});
   setActive(result);await reload();setNotice("สร้างตัวอย่างแล้ว โปรดตรวจยอดและห้องที่ข้ามก่อนอนุมัติ");
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function approve(run:Run){
  if(!window.confirm(`ยืนยันออกใบแจ้งหนี้ ${run.previewSnapshot.rooms.filter(r=>r.status==="READY").length} ห้อง รวม ฿${money(run.previewSnapshot.rooms.filter(r=>r.status==="READY").reduce((n,r)=>n+(r.amountSatang??0),0))}? ระบบจะออกทั้งชุดในธุรกรรมเดียว และย้อนกลับอัตโนมัติไม่ได้`))return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await post<{run:Run;replayed:boolean}>(path+"/"+run.id+"/approve",{confirmed:true,previewHash:run.previewHash});
   setActive(result.run);await reload();await onIssued();
   setNotice(result.replayed?"ชุดนี้ออกใบแจ้งหนี้ไปแล้ว แสดงผลการทำรายการเดิม":"ออกใบแจ้งหนี้ครบชุดแล้ว");
  }catch(e){setError((e as Error).message);await reload().catch(()=>{});}
  finally{setBusy(false);}
 }
 return <section className="panel" aria-label="ออกบิลหลายห้อง">
  <div className="panel-head"><div><h2><Layers3 size={19}/> ออกบิลหลายห้อง</h2>
   <p>ขั้นที่ 1 เลือกรอบบิล → ขั้นที่ 2 ตรวจยอดแต่ละห้อง → ขั้นที่ 3 ยืนยันออกบิล · สามารถเริ่มรอบใหม่ได้ทุกเมื่อ แต่ห้ามออกซ้ำรอบเดิม</p></div>
   <button className="btn outline" type="button" disabled={busy} onClick={()=>void reload()}><RefreshCw size={15}/> โหลดประวัติ</button></div>
  <div className="form"><p className="hint">เลือกช่วงวันที่ต้องการคิดค่าเช่าได้ ไม่จำเป็นต้องรอวันสิ้นเดือน ระบบจะตรวจสอบห้องที่ออกบิลไปแล้วก่อนเสมอ</p><div className="cols2">
   <label className="field"><span>วันเริ่มรอบ</span><input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
   <label className="field"><span>วันสิ้นสุดรอบ (ไม่รวมวันที่เลือก)</span><input type="date" value={endExclusive} onChange={e=>setEndExclusive(e.target.value)}/></label>
  </div><label className="field"><span>ข้อความเพิ่มเติมบนบิล (ไม่บังคับ · ใช้เหมือนกันทุกห้องในชุดนี้)</span><textarea rows={2} maxLength={300} value={note} onChange={e=>{setNote(e.target.value);setActive(null);}} placeholder="เช่น กรุณาชำระก่อนวันที่กำหนด หรือแจ้งข้อมูลเพิ่มเติมแก่ผู้เช่า"/></label><p className="hint"><ShieldCheck size={15}/> ระบบออกบิลเฉพาะห้องที่มีสัญญาและข้อมูลครบ ห้องที่ขาดมิเตอร์หรือมีบิลแล้วจะแสดงสาเหตุและไม่ถูกรวมในชุด</p>
   <button className="btn primary" type="button" disabled={busy||!start||!endExclusive||endExclusive<=start} onClick={()=>void preview()}>{busy?"กำลังคำนวณ…":"คำนวณตัวอย่างทุกห้อง"}</button>{endExclusive<=start&&<p className="notice danger">วันสิ้นสุดต้องอยู่หลังวันเริ่มรอบ</p>}</div>
  {error&&<p className="notice danger" role="alert">{error}</p>}{notice&&<p className="notice success" role="status">{notice}</p>}
  {active&&<div className="claim-list" aria-live="polite">
   <article className="claim-item"><div className="claim-heading"><div><b>รอบ {active.periodStart} – {active.periodEnd}</b>
    <small>พร้อมออก {ready.length} ห้อง · ข้าม {active.previewSnapshot.rooms.length-ready.length} ห้อง · ยอดรวม ฿{money(total)}</small></div>
    {active.status==="PREVIEWED"&&<button className="btn primary" type="button" disabled={busy||ready.length===0} onClick={()=>void approve(active)}>อนุมัติและออกทั้งชุด</button>}
    {active.status==="COMPLETED"&&<span className="pill occupied">ออกแล้ว {active.issuedCount} ห้อง</span>}
    {active.status==="STALE"&&<span className="pill">ตัวอย่างเปลี่ยนแปลงแล้ว</span>}
   </div>
   {active.status==="PREVIEWED"&&<p className="hint"><TriangleAlert size={15}/> ตัวอย่างหมดอายุใน 15 นาที หากข้อมูลเปลี่ยนระบบจะยกเลิกการอนุมัติทั้งชุดและต้องคำนวณใหม่</p>}
   <div className="table-scroll"><table><thead><tr><th>ห้อง</th><th>ผลตรวจ</th><th>รายการ</th><th>ยอด</th></tr></thead><tbody>
    {active.previewSnapshot.rooms.map(room=><tr key={room.roomId}><td><b>{room.roomNumber}</b></td>
     <td>{room.status==="READY"?"พร้อมออก":"ข้าม: "+(reasonText[room.reason??""]??room.reason??"ข้อมูลไม่พร้อม")}</td>
     <td>{room.lines.map(line=>line.description+" ฿"+money(line.amountSatang)).join(" · ")||"—"}</td>
     <td>{room.amountSatang===null?"—":"฿"+money(room.amountSatang)}</td></tr>)}
    {active.previewSnapshot.rooms.length===0&&<tr><td colSpan={4}>ไม่พบห้องที่มีสถานะพักอาศัยในรอบนี้</td></tr>}
   </tbody></table></div></article>
  </div>}
  <p className="hint"><TriangleAlert size={15}/> หากออกบิลผิด ห้ามออกซ้ำเพื่อทับบิลเดิม: ต้องตรวจสถานะการชำระและใช้ขั้นตอนยกเลิก/ปรับปรุงบิลที่มีประวัติตรวจสอบก่อน</p>
  <div className="claim-list"><h3>ประวัติชุดออกบิล</h3>{runs.map(run=><button key={run.id} type="button" className="claim-item" onClick={()=>setActive(run)}>
   <span><b>{run.periodStart} – {run.periodEnd}</b><small>{run.previewSnapshot.rooms.filter(r=>r.status==="READY").length} ห้องพร้อม · {run.previewSnapshot.rooms.length-run.previewSnapshot.rooms.filter(r=>r.status==="READY").length} ห้องถูกข้าม · {new Date(run.createdAt).toLocaleString("th-TH")}</small></span>
   <span className="pill">{run.status==="PREVIEWED"?"รออนุมัติ":run.status==="COMPLETED"?`ออกแล้ว ${run.issuedCount}`:"ต้องคำนวณใหม่"}</span>
  </button>)}{runs.length===0&&<p className="empty">ยังไม่มีประวัติชุดออกบิล</p>}</div>
 </section>;
}
