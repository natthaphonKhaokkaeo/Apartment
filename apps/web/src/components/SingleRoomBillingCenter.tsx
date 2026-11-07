import {useEffect,useMemo,useRef,useState} from "react";
import {CheckCircle2,ReceiptText,TriangleAlert} from "lucide-react";
import {initialPeriod} from "./BulkBillingCenter.js";

type Room={id:string;number:string;status:string};
type PreviewLine={type:string;description:string;amountSatang:number;unitsMilli:number|null;tariffSatang:number|null;
 snapshot?:{startAssumedZero?:boolean;start?:string;end?:string}};
type BillPreview={room:{id:string;number:string};lease:{tenantName:string};periodStart:string;
 periodEnd:string;totalSatang:number;lines:PreviewLine[]};
type Issued={invoice:{id:string;roomId:string;amountSatang:number};replayed?:boolean};
type Input={roomId:string;start:string;endExclusive:string;partialMode?:"MOVE_IN"|"MOVE_OUT";note:string};
type Props={propertyId:string;cadence:string;rooms:Room[];
 post:<T>(path:string,body:unknown,headers?:HeadersInit)=>Promise<T>;
 onIssued:()=>Promise<void>};
const money=(n:number)=>"฿"+(n/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
export function SingleRoomBillingCenter({propertyId,cadence,rooms,post,onIssued}:Props){
 const initial=useMemo(()=>initialPeriod(cadence),[cadence]);
 const occupied=rooms.filter(room=>room.status==="OCCUPIED");
 const [roomId,setRoomId]=useState(""),[start,setStart]=useState(initial.start),[endExclusive,setEndExclusive]=useState(initial.endExclusive);
 const [partialMode,setPartialMode]=useState<""|"MOVE_IN"|"MOVE_OUT">(""),[note,setNote]=useState("");
 const [preview,setPreview]=useState<BillPreview|null>(null),[previewInput,setPreviewInput]=useState("");
 const [issued,setIssued]=useState<Issued|null>(null),[busy,setBusy]=useState(false),
  [error,setError]=useState(""),[notice,setNotice]=useState("");
 const issueKey=useRef("");
 useEffect(()=>{setRoomId(current=>rooms.some(room=>room.status==="OCCUPIED"&&room.id===current)?current:(rooms.find(room=>room.status==="OCCUPIED")?.id??""));},[rooms]);
 useEffect(()=>{setPreview(null);setPreviewInput("");setIssued(null);issueKey.current="";},[propertyId]);
 useEffect(()=>{setStart(initial.start);setEndExclusive(initial.endExclusive);setPreview(null);setPreviewInput("");},[initial.start,initial.endExclusive]);
 const payload:Input={roomId,start,endExclusive,note:note.trim(),...(partialMode?{partialMode}:{})};
 const signature=JSON.stringify(payload);
 const ready=preview!==null&&previewInput===signature&&!issued;
 const invalidate=()=>{setPreview(null);setPreviewInput("");setIssued(null);issueKey.current="";setNotice("");setError("");};
 async function calculate(){
  if(!roomId||!start||!endExclusive||start>=endExclusive){setError("เลือกห้องและช่วงวันที่ให้ถูกต้องก่อนคำนวณ");return;}
  setBusy(true);setError("");setNotice("");setPreview(null);setIssued(null);setPreviewInput("");
  try{
   const quote=await post<BillPreview>(`/properties/${propertyId}/bills/preview`,payload);
   if(!quote.lines.length||quote.lines.reduce((sum,line)=>sum+line.amountSatang,0)!==quote.totalSatang)
    throw new Error("ยอดรวมไม่ตรงกับรายการ กรุณาลองใหม่หรือติดต่อผู้ดูแล");
   setPreview(quote);setPreviewInput(signature);issueKey.current=crypto.randomUUID();
   setNotice("คำนวณสำเร็จ โปรดตรวจทุกรายการก่อนยืนยันออกบิลจริง");
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 async function issue(){
  if(!ready||!preview)return;
  if(!window.confirm(`ยืนยันออกบิลห้อง ${preview.room.number} ผู้เช่า ${preview.lease.tenantName} รวม ${money(preview.totalSatang)}?`))return;
  setBusy(true);setError("");setNotice("");
  try{
   if(!issueKey.current)issueKey.current=crypto.randomUUID();
   const result=await post<Issued>(`/properties/${propertyId}/bills/issue`,payload,{"idempotency-key":issueKey.current});
   setIssued(result);setPreview(null);setPreviewInput("");
   setNotice(result.replayed?"พบคำขอเดิม: บิลนี้ออกแล้ว ไม่ได้สร้างซ้ำ":`ออกใบแจ้งหนี้สำเร็จ ${money(result.invoice.amountSatang)} และบันทึกในรายการบิลแล้ว`);
   try{await onIssued();}catch{setError("ออกบิลสำเร็จแล้ว แต่โหลดรายการไม่สำเร็จ กรุณารีเฟรชหน้าจอ (ไม่ต้องออกบิลซ้ำ)");}
  }catch(e){setError((e as Error).message+" · หากไม่แน่ใจว่าออกบิลสำเร็จแล้ว ให้ตรวจรายการบิลก่อนลองใหม่");}
  finally{setBusy(false);}
 }
 return <section className="panel" aria-label="ออกใบแจ้งหนี้รายห้อง">
  <div className="panel-head"><div><h2><ReceiptText size={20}/> ออกใบแจ้งหนี้รายห้อง</h2>
   <p>1. เลือกห้องและรอบบิล → 2. คำนวณและตรวจ Preview → 3. ยืนยันออกบิลจริง</p></div></div>
  <div className="form"><div className="cols3">
   <label className="field"><span>ห้องพัก</span><select value={roomId} onChange={e=>{setRoomId(e.target.value);invalidate();}}>
    {occupied.length===0&&<option value="">ยังไม่มีห้องที่มีผู้เช่า</option>}
    {occupied.map(room=><option key={room.id} value={room.id}>{room.number}</option>)}</select></label>
   <label className="field"><span>วันเริ่มรอบบิล</span><input type="date" value={start} onChange={e=>{setStart(e.target.value);invalidate();}}/></label>
   <label className="field"><span>วันสิ้นสุด (ไม่รวมวันเลือก)</span><input type="date" value={endExclusive} onChange={e=>{setEndExclusive(e.target.value);invalidate();}}/></label>
  </div>
  <label className="field"><span>ประเภทบิล</span><select value={partialMode} onChange={e=>{setPartialMode(e.target.value as typeof partialMode);invalidate();}}>
   <option value="">รอบปกติ</option><option value="MOVE_IN">ย้ายเข้ากลางรอบ</option><option value="MOVE_OUT">ย้ายออกกลางรอบ</option>
  </select></label>
  <label className="field"><span>หมายเหตุบนบิล (ไม่บังคับ · ยอด 0 บาท)</span><textarea maxLength={300} rows={2} value={note}
   onChange={e=>{setNote(e.target.value);invalidate();}} placeholder="ข้อความเพิ่มเติมสำหรับผู้เช่า"/></label>
  <p className="hint">เลขมิเตอร์ต้นรอบแรกจะถือเป็น 0 หากไม่มีประวัติก่อนหน้า ส่วนรอบถัดไปต้องใช้ค่าที่บันทึกไว้จริง</p>
  <div className="actions"><button className="btn outline" type="button" disabled={busy||!roomId||start>=endExclusive} onClick={()=>void calculate()}>
   {busy?"กำลังดำเนินการ…":"คำนวณยอดก่อนออกบิล"}</button>
   <button className="btn primary" type="button" disabled={busy||!ready} onClick={()=>void issue()}>ยืนยันออกบิล</button></div></div>
  {error&&<p className="notice danger" role="alert"><TriangleAlert size={18}/>{error}</p>}
  {notice&&<p className="notice success" role="status"><CheckCircle2 size={18}/>{notice}</p>}
  {preview&&previewInput===signature&&<article className="claim-item" aria-label="ตัวอย่างรายการบิลรายห้อง" aria-live="polite">
   <div className="claim-heading"><div><h3>ตัวอย่างใบแจ้งหนี้ · ห้อง {preview.room.number}</h3>
    <small>ผู้เช่า {preview.lease.tenantName} · รอบ {preview.periodStart} ถึง {preview.periodEnd}</small></div>
    <strong>{money(preview.totalSatang)}</strong></div>
   <div className="table-scroll"><table><thead><tr><th>รายการ</th><th>หน่วยใช้จริง</th><th>อัตรา</th><th>จำนวนเงิน</th></tr></thead>
    <tbody>{preview.lines.map((line,index)=><tr key={`${line.type}-${index}`}><td>{line.type==="NOTE"?`หมายเหตุ: ${line.description}`:line.description}
     {line.snapshot?.startAssumedZero&&<small style={{display:"block"}}>ใช้ค่าเริ่มต้นมิเตอร์ 0 (ครั้งแรก)</small>}</td>
     <td>{line.unitsMilli===null?"—":(line.unitsMilli/1000).toLocaleString("th-TH")}</td>
     <td>{line.tariffSatang===null?"—":money(line.tariffSatang)}</td>
     <td>{line.type==="NOTE"?"—":money(line.amountSatang)}</td></tr>)}</tbody>
    <tfoot><tr><th colSpan={3}>รวมยอดเรียกเก็บ</th><th>{money(preview.totalSatang)}</th></tr></tfoot></table></div>
   <p className="hint">นี่เป็นเพียงตัวอย่าง ยังไม่มีการสร้างใบแจ้งหนี้ จนกด “ยืนยันออกบิล”</p>
  </article>}
  {issued&&<p className="notice success" role="status">บิล #{issued.invoice.id} ออกสำเร็จ · ตรวจในตารางใบแจ้งหนี้ด้านล่าง</p>}
  {!preview&&!issued&&!error&&<p className="hint">กรุณากดคำนวณยอดเพื่อดูรายการและตรวจสอบก่อนออกบิลจริง</p>}
 </section>;
}
