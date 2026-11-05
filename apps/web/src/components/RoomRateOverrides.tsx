import {useState} from "react";

type PropertyDefaults={rentSatang:number;waterSatangPerUnit:number;electricSatangPerUnit:number};
type RateKey="rent"|"water"|"electric";
const rates:{key:RateKey;label:string;unit:string;amount:(p:PropertyDefaults)=>number}[]=[
 {key:"rent",label:"ค่าเช่า / เดือน",unit:"บาท / เดือน",amount:p=>p.rentSatang},
 {key:"water",label:"ค่าน้ำ / หน่วย",unit:"บาท / หน่วย",amount:p=>p.waterSatangPerUnit},
 {key:"electric",label:"ค่าไฟ / หน่วย",unit:"บาท / หน่วย",amount:p=>p.electricSatangPerUnit},
];

/** Room creation starts by inheriting the property's rates; custom amounts are explicit opt-outs. */
export function RoomRateOverrides({property}:{property:PropertyDefaults}){
 const [inherit,setInherit]=useState<Record<RateKey,boolean>>({rent:true,water:true,electric:true});
 return <div className="room-rate-overrides" aria-label="อัตราค่าบริการรายห้อง">
  <p className="hint">ค่าเริ่มต้นของหอพักถูกเลือกไว้ให้แล้ว หากห้องนี้ราคาแตกต่าง ให้เอาเครื่องหมายค่าเริ่มต้นออกแล้วกรอกราคาเฉพาะห้อง</p>
  <div className="room-rate-grid">{rates.map(rate=>{
   const checked=inherit[rate.key];
   const defaultAmount=(rate.amount(property)/100).toFixed(2);
   return <div className="room-rate-field" key={rate.key}>
    <span className="room-rate-label">{rate.label}</span>
    <label className="room-rate-default">
     <input type="checkbox" name={`${rate.key}Default`} checked={checked}
      onChange={e=>{const checked=e.currentTarget.checked;setInherit(previous=>({...previous,[rate.key]:checked}));}}/>
     <span>ใช้ค่าเริ่มต้นหอพัก ({defaultAmount} {rate.unit})</span>
    </label>
    <input aria-label={`${rate.label} เฉพาะห้อง`} name={rate.key} type="number" min="0" step="0.01"
     defaultValue={defaultAmount} disabled={checked} required={!checked}/>
   </div>;
  })}</div>
 </div>;
}
