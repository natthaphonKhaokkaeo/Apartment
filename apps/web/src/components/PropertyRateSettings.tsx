import {useEffect,useState} from "react";
import {CalendarClock,History,ShieldCheck} from "lucide-react";

type Rate={
 id:string;effectiveFrom:string;rentSatang:number;
 waterSatangPerUnit:number;electricSatangPerUnit:number;
 reason:string;createdAt:string
};
type Props={
 propertyId:string;cadence:string;
 current:{rentSatang:number;waterSatangPerUnit:number;electricSatangPerUnit:number};
 api:<T>(path:string,options?:RequestInit)=>Promise<T>;
 post:<T>(path:string,body:unknown)=>Promise<T>;
 onSaved:()=>void
};
const thb=(satang:number)=>(satang/100).toLocaleString("th-TH",{
 minimumFractionDigits:2,maximumFractionDigits:2
});
function parseBaht(value:string):number{
 const normalized=value.trim();
 if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized))
  throw Error("กรุณาระบุราคาเป็นบาทไม่เกินสองตำแหน่งทศนิยม");
 const [whole,decimals=""]=normalized.split(".");
 const satang=Number(whole)*100+Number(decimals.padEnd(2,"0"));
 if(!Number.isSafeInteger(satang)||satang>2147483647)throw Error("ราคาสูงเกินขอบเขต");
 return satang;
}
function todayBangkok(){
 const d=new Intl.DateTimeFormat("en-GB",{
  timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"
 }).formatToParts(new Date());
 const part=(name:string)=>d.find(p=>p.type===name)?.value??"";
 return [part("year"),part("month"),part("day")].join("-");
}
export function PropertyRateSettings({propertyId,cadence,current,api,post,onSaved}:Props){
 const [versions,setVersions]=useState<Rate[]>([]);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 async function load(){
  const list=await api<Rate[]>("/properties/"+propertyId+"/rates");
  setVersions(list);
 }
 useEffect(()=>{
  let active=true;
  void api<Rate[]>("/properties/"+propertyId+"/rates").then(rows=>{
   if(active)setVersions(rows);
  }).catch(e=>{if(active)setError((e as Error).message);});
  return()=>{active=false;};
 },[propertyId,api]);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  const form=event.currentTarget;
  if(!window.confirm("ยืนยันนัดอัตรา Master ใหม่? การเพิ่มเวอร์ชันนี้ย้อนกลับไม่ได้ และใบแจ้งหนี้เดิมจะไม่ถูกแก้ไข"))return;
  const values=new FormData(form);
  setBusy(true);setError("");setNotice("");
  try{
   await post("/properties/"+propertyId+"/rates",{
    effectiveFrom:String(values.get("effectiveFrom")),
    rentSatang:parseBaht(String(values.get("rent"))),
    waterSatangPerUnit:parseBaht(String(values.get("water"))),
    electricSatangPerUnit:parseBaht(String(values.get("electric"))),
    reason:String(values.get("reason")||"").trim()
   });
   await load();
   onSaved();
   setNotice("บันทึกอัตราใหม่แล้ว โดยไม่เปลี่ยนใบแจ้งหนี้ที่ออกไปก่อนหน้า");
   form.reset();
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 return <section className="panel" aria-label="ประวัติอัตรา Master">
  <div className="panel-head"><div><h2><CalendarClock size={18}/> อัตรา Master ตามวันที่มีผล</h2>
   <p>เฉพาะ OWNER เท่านั้นที่เพิ่มเวอร์ชันใหม่ได้ · ต้องเริ่มวันแรกของรอบบิล</p>
  </div><History size={19}/></div>
  <p className="hint"><ShieldCheck size={15}/> ระบบเก็บประวัติราคาและ Audit โดยไม่เปลี่ยนบิลที่ออกแล้ว
   อัตราที่เริ่มกลางรอบบิลและราคาค่าน้ำไฟเกินเพดานที่ตรวจสอบจะถูกปฏิเสธ</p>
  <div className="rate-row"><span>อัตราที่ใช้อยู่ตอนนี้ (ค่าเช่ารายเดือน / น้ำ / ไฟ)</span>
   <b>{thb(current.rentSatang)} / {thb(current.waterSatangPerUnit)} / {thb(current.electricSatangPerUnit)} บาท</b>
  </div>
  {error&&<p className="notice danger" role="alert">{error}</p>}
  {notice&&<p className="notice success" role="status">{notice}</p>}
  <form className="form" onSubmit={e=>void submit(e)}>
   <div className="cols3">
    <label className="field"><span>วันที่เริ่มใช้อัตราใหม่</span>
     <input type="date" name="effectiveFrom" required min={todayBangkok()}/></label>
    <label className="field"><span>ค่าเช่า / เดือน (บาท)</span>
     <input name="rent" type="number" min="0" step=".01" required
      defaultValue={(current.rentSatang/100).toFixed(2)}/></label>
    <label className="field"><span>ค่าน้ำ / หน่วย (บาท)</span>
     <input name="water" type="number" min="0" step=".01" required
      defaultValue={(current.waterSatangPerUnit/100).toFixed(2)}/></label>
    <label className="field"><span>ค่าไฟ / หน่วย (บาท)</span>
     <input name="electric" type="number" min="0" step=".01" required
      defaultValue={(current.electricSatangPerUnit/100).toFixed(2)}/></label>
   </div>
   <label className="field"><span>เหตุผลประกอบการปรับราคา (อย่างน้อย 12 ตัวอักษร)</span>
    <input name="reason" minLength={12} maxLength={500} required
     placeholder="เช่น ปรับอัตราตามประกาศที่ตรวจสอบแล้ว"/></label>
   <p className="hint">{cadence==="MONTHLY"?"รายเดือน: เลือกวันที่ 1":cadence==="SEMI_MONTHLY"
    ?"เดือนละสองรอบ: เลือกวันที่ 1 หรือ 16":"ทุก 15 วัน: ต้องตรงกับรอบที่นับจากวันเริ่มต้น"}
    {" "}· การปรับย้อนหลังไม่รองรับใน Phase นี้</p>
   <button className="btn primary" type="submit" disabled={busy}>
    {busy?"กำลังบันทึก...":"นัดใช้อัตรา Master ใหม่"}</button>
  </form>
  <h3>ประวัติอัตรา Master</h3>
  <div className="table-scroll"><table>
   <thead><tr><th>เริ่มมีผล</th><th>ค่าเช่า</th><th>น้ำ</th><th>ไฟ</th><th>หมายเหตุ</th></tr></thead>
   <tbody>{versions.map(version=><tr key={version.id}>
    <td>{version.effectiveFrom==="1900-01-01"?"อัตราเริ่มต้น":version.effectiveFrom}</td>
    <td>{thb(version.rentSatang)}</td><td>{thb(version.waterSatangPerUnit)}</td>
    <td>{thb(version.electricSatangPerUnit)}</td><td>{version.reason}</td>
   </tr>)}</tbody>
  </table>{versions.length===0&&<p className="hint">ยังไม่มีประวัติอัตราที่บันทึกไว้</p>}</div>
 </section>;
}
