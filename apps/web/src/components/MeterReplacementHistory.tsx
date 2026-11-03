import {useState} from "react";

type Event={
 id:string;kind:"WATER"|"ELECTRIC";replacedAt:string;
 oldSerial:string;newSerial:string;
 oldClosingValue:string;newOpeningValue:string;
 evidenceRef:string;reason:string
};
type Props={
 propertyId:string;rooms:{id:string;number:string}[];
 api:<T>(path:string,options?:RequestInit)=>Promise<T>
};
export function MeterReplacementHistory({propertyId,rooms,api}:Props){
 const [roomId,setRoomId]=useState(rooms[0]?.id??"");
 const [items,setItems]=useState<Event[]|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 async function load(){
  if(!roomId)return;
  setBusy(true);setError("");
  try{
   setItems(await api<Event[]>(
    "/properties/"+propertyId+"/rooms/"+roomId+"/meter-replacements"));
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <section className="panel">
  <h3>ประวัติการเปลี่ยนมิเตอร์</h3>
  <div className="actions">
   <select value={roomId} onChange={v=>{
    setRoomId(v.target.value);setItems(null);
   }}>{rooms.map(r=><option key={r.id} value={r.id}>{r.number}</option>)}</select>
   <button type="button" className="btn outline"
    onClick={()=>void load()} disabled={busy||!roomId}>
    {busy?"กำลังโหลด...":"ดูประวัติ"}
   </button>
  </div>
  {error&&<p className="notice danger">{error}</p>}
  {items&&<div className="table-scroll"><table>
   <thead><tr><th>วันเปลี่ยน</th><th>ชนิด</th><th>Serial เก่า → ใหม่</th>
    <th>ปิดเก่า → เริ่มใหม่</th><th>หลักฐาน</th><th>เหตุผล</th></tr></thead>
   <tbody>{items.map(event=><tr key={event.id}>
    <td>{event.replacedAt}</td><td>{event.kind==="WATER"?"น้ำ":"ไฟ"}</td>
    <td>{event.oldSerial} → {event.newSerial}</td>
    <td>{event.oldClosingValue} → {event.newOpeningValue}</td>
    <td>{event.evidenceRef}</td><td>{event.reason}</td>
   </tr>)}</tbody>
  </table>{items.length===0&&<p className="hint">ยังไม่มีการเปลี่ยนมิเตอร์</p>}</div>}
 </section>;
}
