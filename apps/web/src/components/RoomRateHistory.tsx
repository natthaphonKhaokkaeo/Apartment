import {useState} from "react";

type Version={
 id:string;effectiveFrom:string;
 rentOverrideSatang:number|null;
 waterOverrideSatang:number|null;
 electricOverrideSatang:number|null;
 reason:string
};
type Props={
 propertyId:string;roomId:string;
 api:<T>(path:string,options?:RequestInit)=>Promise<T>
};
function display(value:number|null){
 return value===null?"สืบทอด Master":(value/100).toFixed(2)+" บาท";
}
export function RoomRateHistory({propertyId,roomId,api}:Props){
 const [items,setItems]=useState<Version[]|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 async function refresh(){
  setBusy(true);setError("");
  try{
   setItems(await api<Version[]>("/properties/"+propertyId+"/rooms/"+roomId+"/rates"));
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <div>
  <button className="btn outline" type="button" disabled={busy}
   onClick={()=>void refresh()}>{busy?"กำลังโหลด...":"ดูประวัติอัตรารายห้อง"}</button>
  {error&&<p className="notice danger">{error}</p>}
  {items&&<div className="table-scroll"><table>
   <thead><tr><th>มีผลตั้งแต่</th><th>ค่าเช่า</th><th>น้ำ</th><th>ไฟ</th><th>เหตุผล</th></tr></thead>
   <tbody>{items.map(v=><tr key={v.id}>
    <td>{v.effectiveFrom==="1900-01-01"?"อัตราเริ่มต้น":v.effectiveFrom}</td>
    <td>{display(v.rentOverrideSatang)}</td>
    <td>{display(v.waterOverrideSatang)}</td>
    <td>{display(v.electricOverrideSatang)}</td><td>{v.reason}</td>
   </tr>)}</tbody>
  </table></div>}
 </div>;
}
