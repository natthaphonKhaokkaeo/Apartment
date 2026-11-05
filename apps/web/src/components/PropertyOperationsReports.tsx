import {useEffect,useState} from "react";
import {BarChart3,Download,AlertTriangle,RefreshCw} from "lucide-react";

type OccupancyReport={
 propertyId:string;totalRooms:number;occupiedRooms:number;
 availableRooms:number;maintenanceRooms:number;occupancyPercent:number;
 activeLeaseCount:number;occupiedWithoutActiveLease:number;
 activeLeaseInNonOccupiedRoom:number;roomsWithMultipleActiveLeases:number;
};
type FinancialReport={
 totals:{invoiceCount:number;totalBilledSatang:number;grossManualApprovedSatang:number;
  netManualApprovedSatang:number;internalCreditSatang:number;outstandingSatang:number};
};
type Props={
 propertyId:string;
 api:<T>(path:string,options?:RequestInit)=>Promise<T>;
};
/** Read-only owner overview for occupancy and receivables reporting. */
export function PropertyOperationsReports({propertyId,api}:Props){
 const [data,setData]=useState<OccupancyReport|null>(null);
 const [financial,setFinancial]=useState<FinancialReport|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 useEffect(()=>{
  let cancelled=false;
  setLoading(true);setError("");setData(null);setFinancial(null);
  void Promise.all([
   api<OccupancyReport>(`/properties/${propertyId}/occupancy-report`),
   api<FinancialReport>(`/properties/${propertyId}/financial-report`),
  ]).then(([report,finance])=>{if(!cancelled){setData(report);setFinancial(finance);}})
   .catch(err=>{if(!cancelled)setError((err as Error).message);})
   .finally(()=>{if(!cancelled)setLoading(false);});
  return()=>{cancelled=true;};
 },[api,propertyId]);
 const anomalyCount=data?
  data.occupiedWithoutActiveLease+data.activeLeaseInNonOccupiedRoom+
  data.roomsWithMultipleActiveLeases:0;
 return <section className="panel" aria-label="รายงานจำนวนห้องและยอดลูกหนี้">
  <div className="panel-head">
   <div><h2><BarChart3 size={19}/> รายงานห้องพักและยอดลูกหนี้</h2>
    <p>ตรวจสอบสถานะห้องเทียบสัญญาที่ใช้งาน และดาวน์โหลดรายงานยอดเงินเป็นสตางค์</p>
   </div>
   <a className="btn outline" href={`/v1/properties/${propertyId}/receivables.csv`}
    download={`receivables-${propertyId}.csv`}>
    <Download size={16}/> ส่งออก CSV
   </a>
  </div>
  {loading&&<p role="status"><RefreshCw size={16}/> กำลังโหลดรายงาน...</p>}
  {error&&<p className="notice danger" role="alert">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
  {data&&<div className="rate-row">
   <span>ห้องพักทั้งหมด {data.totalRooms} ห้อง</span>
   <b>มีผู้เช่า {data.occupiedRooms} · ว่าง {data.availableRooms} · ซ่อมบำรุง {data.maintenanceRooms}</b>
  </div>}
  {data&&<div className="rate-row">
   <span>อัตราการเข้าพัก</span>
   <b>{data.occupancyPercent.toLocaleString("th-TH",{maximumFractionDigits:2})}%</b>
  </div>}
  {financial&&<div className="rate-row">
   <span>ยอดออกบิล {financial.totals.invoiceCount} ใบ</span>
   <b>ยอดรวม {formatBaht(financial.totals.totalBilledSatang)} · คงค้าง {formatBaht(financial.totals.outstandingSatang)}</b>
  </div>}
  {financial&&<p className="muted">ยอดรับตาม ledger {formatBaht(financial.totals.netManualApprovedSatang)} · เครดิตภายใน {formatBaht(financial.totals.internalCreditSatang)} · ยอดนี้ยังไม่ใช่การยืนยันจากธนาคาร</p>}
  {data&&anomalyCount>0&&<p role="alert" className="notice danger">
   <AlertTriangle size={16}/> พบสถานะห้องและสัญญาไม่สอดคล้องกัน {anomalyCount} รายการ
   โปรดตรวจสอบก่อนเรียกเก็บเงินหรือเปิดห้องให้เช่า
  </p>}
  {data&&anomalyCount===0&&<p className="notice success" role="status">
   ไม่พบความไม่สอดคล้องระหว่างห้องกับสัญญาที่ใช้งาน
  </p>}
 </section>;
}

function formatBaht(satang:number){return new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB"}).format(satang/100);}
