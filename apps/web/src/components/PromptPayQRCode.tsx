import {useEffect,useRef,useState} from "react";
import {QrCode,Download,ShieldAlert,RefreshCw} from "lucide-react";

type Api={api:<T>(path:string,options?:RequestInit)=>Promise<T>};
type QRResponse={
 invoiceId:string;payload:string;amountSatang:number;currency:"THB";
 recipientName:string;promptPayIdMasked:string;paymentSettingsVersion:number;
 recipientVerifiedByBank:false;paymentVerifiedByBank:false;status:"DISPLAY_ONLY_MANUAL_REVIEW";
};
const baht=(n:number)=>"฿"+(n/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
export function PromptPayQRCode({invoiceId,outstandingSatang,api,endpoint}:Api&{
 invoiceId:string;outstandingSatang?:number;endpoint?:string
}){
 const [data,setData]=useState<QRResponse|null>(null);
 const [src,setSrc]=useState("");
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [nonce,setNonce]=useState(0);
 const [updatedAt,setUpdatedAt]=useState("");
 const apiRef=useRef(api);
 apiRef.current=api;
 useEffect(()=>{
  let cancelled=false;
  setData(null);setSrc("");setError("");setLoading(true);setUpdatedAt("");
  if(outstandingSatang!==undefined&&outstandingSatang<=0){setLoading(false);return()=>{cancelled=true;};}
  void (async()=>{
   try{
    const qr=await apiRef.current<QRResponse>(endpoint||"/tenant/invoices/"+invoiceId+"/promptpay-qr");
    if((outstandingSatang!==undefined&&qr.amountSatang!==outstandingSatang) || qr.status!=="DISPLAY_ONLY_MANUAL_REVIEW")
     throw new Error("ยอดใบแจ้งหนี้มีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่ก่อนสแกน");
    const QRCode=await import("qrcode");
    const png=await QRCode.toDataURL(qr.payload,{
     errorCorrectionLevel:"M",width:320,margin:4,
     color:{dark:"#152D36",light:"#FFFFFF"}
    });
    if(!cancelled){setData(qr);setSrc(png);setUpdatedAt(new Date().toLocaleString("th-TH"));}
   }catch(e){
    if(!cancelled){
     const message=(e as Error).message||"ไม่สามารถแสดง QR พร้อมเพย์ได้";
     setError(message.includes("PAYMENT_CLAIM_PENDING")
       ?"มีรายการแจ้งชำระที่รอเจ้าของตรวจสอบ กรุณารอผลก่อนโอนซ้ำ":
       message.includes("INVOICE_FULLY_RECORDED")
       ?"ยอดบิลนี้ถูกเจ้าของบันทึกรับชำระครบแล้ว":
       message);
    }
   }finally{if(!cancelled)setLoading(false);}
  })();
  return()=>{cancelled=true;};
 },[invoiceId,outstandingSatang,endpoint,nonce]);
 if(outstandingSatang!==undefined&&outstandingSatang<=0)return <p className="hint">ยอดคงเหลือตามรายการที่เจ้าของบันทึกเป็นศูนย์ จึงไม่แสดง QR รับชำระเพิ่ม</p>;
 return <section className="promptpay-panel" aria-label="PromptPay QR สำหรับใบแจ้งหนี้">
  <div className="promptpay-heading"><QrCode size={21}/><strong>สแกน PromptPay QR</strong></div>
  {loading&&<p className="hint" role="status">กำลังสร้าง QR พร้อมเพย์...</p>}
  {!loading&&data&&src&&<>
   <img className="promptpay-image" src={src} alt={"QR พร้อมเพย์ ยอด "+baht(data.amountSatang)+" ผู้รับ "+data.recipientName} width="260" height="260"/>
   <div className="promptpay-details">
    <span>ยอดชำระตามบิลคงเหลือ</span><strong>{baht(data.amountSatang)}</strong>
    <span>ชื่อบัญชีที่เจ้าของระบุ</span><b>{data.recipientName}</b>
    <span>พร้อมเพย์</span><b>{data.promptPayIdMasked}</b>
   </div>
   <small>ข้อมูลบัญชีและยอด ณ {updatedAt}</small>
   <a className="btn outline" href={src} download={"promptpay-"+invoiceId.slice(0,8)+".png"}>
    <Download size={15}/> บันทึกภาพ QR
   </a>
  </>}
  {!loading&&error&&<p className="notice danger" role="alert">ไม่สามารถแสดง QR: {error}</p>}
  <button type="button" className="btn outline" disabled={loading} onClick={()=>setNonce(n=>n+1)}><RefreshCw size={15}/> รีเฟรช QR ก่อนโอน</button>
  <p className="promptpay-disclaimer"><ShieldAlert size={17}/>
   กรุณาตรวจสอบชื่อผู้รับและจำนวนเงินอีกครั้งในแอปธนาคารก่อนกดยืนยัน
   QR นี้ไม่ยืนยันการรับเงิน และไม่ใช่ใบเสร็จรับเงิน
  </p>
 </section>;
}
