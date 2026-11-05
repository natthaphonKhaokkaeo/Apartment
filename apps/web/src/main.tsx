import {PrivacyCenter} from "./components/PrivacyCenter.js";
import {MeterEvidenceCenter} from "./components/MeterEvidenceCenter.js";
import {DepositCenter} from "./components/DepositCenter.js";
import {parseSatang} from "./money.js";
import React,{useEffect,useState,useCallback} from "react";
import {createRoot} from "react-dom/client";
import liff from "@line/liff";
import {Building2,LayoutDashboard,DoorOpen,ReceiptText,Gauge,Settings,ShieldCheck,LogOut,ChevronDown,CheckCircle2,AlertTriangle,Wallet,Users,Menu,Wrench,UserRound} from "lucide-react";
import {OwnerInvitations} from "./components/OwnerInvitations.js";
import {TenantPortal} from "./components/TenantPortal.js";
import {PropertyOperationsReports} from "./components/PropertyOperationsReports.js";
import {LineOperationsAdmin} from "./components/LineOperationsAdmin.js";
import {PropertyRateSettings} from "./components/PropertyRateSettings.js";
import {RoomRateHistory} from "./components/RoomRateHistory.js";
import {MeterReplacementHistory} from "./components/MeterReplacementHistory.js";
import {PaymentCenter} from "./components/PaymentCenter.js";
import {StaffManagement,StaffInviteClaim,StaffMeterReadings} from "./components/StaffManagement.js";
import {MaintenanceCenter} from "./components/MaintenanceCenter.js";
import {BulkBillingCenter} from "./components/BulkBillingCenter.js";
import "./styles.css";
type Organization={id:string;name:string;status:string};
type Property={id:string;name:string;organizationId:string;address:string;rentSatang:number;waterSatangPerUnit:number;electricSatangPerUnit:number;cadence:string;rollingAnchor:string|null;complianceReviewedAt:string|null};
type Lease={id:string;roomId:string;tenantName:string;startDate:string;
 endDate:string|null;status:string};
type Room={id:string;number:string;floor:number;status:string;rentOverrideSatang:number|null;waterOverrideSatang:number|null;electricOverrideSatang:number|null};
type Invoice={id:string;roomId:string;amountSatang:number;periodStart:string;periodEnd:string;dueDate:string;status:string;createdAt:string};
type Me={id:string;name:string;role:string;memberships?:{organizationId:string;role:"OWNER"|"MANAGER"|"STAFF"}[];
 propertyGrants?:{propertyId:string;level:"VIEWER"|"METER_READER"}[]};
type Section="overview"|"rooms"|"meter"|"billing"|"payments"|"maintenance"|"invites"|"staff"|"tenant"|"settings"|"admin"|"profile";
const sections:[Section,string,React.ReactNode][]=[
 ["overview","ภาพรวม",<LayoutDashboard size={19}/>],["rooms","ห้องพัก",<DoorOpen size={19}/>],
 ["meter","จดมิเตอร์",<Gauge size={19}/>],["billing","ออกบิล",<ReceiptText size={19}/>],
 ["payments","รับชำระเงิน",<Wallet size={19}/>],["maintenance","ซ่อมบำรุง",<Wrench size={19}/>],
 ["invites","เชิญผู้เช่า",<Users size={19}/>],
 ["staff","จัดการพนักงาน",<Users size={19}/>],["tenant","สำหรับผู้เช่า",<DoorOpen size={19}/>],
 ["settings","ตั้งค่า",<Settings size={19}/>],["admin","Super Admin",<ShieldCheck size={19}/>],["profile","โปรไฟล์",<UserRound size={19}/>]];
const sectionFromUrl=():Section|null=>{const value=new URLSearchParams(window.location.search).get("section");return sections.some(([id])=>id===value)?value as Section:null;};
const money=(n:number|undefined|null)=>"฿"+((n??0)/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
const satang=parseSatang;
function dateNow(){return new Date(Date.now()+7*3600000).toISOString().slice(0,10);}
const labels:Record<string,string>={
 INVALID_MOVE_OUT_PARTIAL_PERIOD:"บิลย้ายออกกลางรอบต้องเริ่มต้นรอบหรือวันเริ่มสัญญา และสิ้นสุดไม่เกินวันนี้",
 METER_REPLACEMENT_OWNER_REQUIRED:"เปลี่ยนมิเตอร์ได้เฉพาะ Owner ขององค์กร",
 METER_REPLACEMENT_CONFLICTS_WITH_READING:"มีเลขอ่านวันที่เท่ากันหรือใหม่กว่าวันเปลี่ยนมิเตอร์",
 METER_OLD_CLOSING_BELOW_LAST_READING:"เลขปิดมิเตอร์เก่าต้องไม่น้อยกว่าเลขอ่านล่าสุด",
 METER_SERIAL_CHAIN_INVALID:"หมายเลขมิเตอร์ไม่ต่อเนื่อง หรือวันเปลี่ยนซ้ำกับประวัติ",
 METER_SERIAL_UNCHANGED:"มิเตอร์เก่าและใหม่ต้องมีหมายเลขต่างกัน",
 METER_REPLACEMENT_FUTURE_DATE:"ไม่อนุญาตบันทึกเหตุการณ์เปลี่ยนมิเตอร์ในอนาคต",
 METER_REPLACEMENT_AFTER_INVOICE_ISSUED:"มีใบแจ้งหนี้ที่ออกครอบคลุมช่วงนี้แล้ว",
 METER_REPLACEMENT_INCONSISTENT:"ค่าการใช้มิเตอร์ไม่สอดคล้องกับข้อมูลเปลี่ยนมิเตอร์",
 INVALID_MOVE_IN_PARTIAL_PERIOD:"บิลย้ายเข้ากลางรอบต้องเริ่มตรงวันเริ่มสัญญาและสิ้นสุดตรงปลายรอบบิลเท่านั้น",
 PERIOD_OVERLAP_ALREADY_BILLED:"ช่วงวันที่เลือกทับกับใบแจ้งหนี้ที่ออกไปแล้ว",
 ROOM_OVERRIDE_REQUIRES_EFFECTIVE_DATE:"ต้องนัดเปลี่ยนราคาโดยระบุวันเริ่มมีผลและเหตุผล",
 ROOM_RATE_OWNER_REQUIRED:"การปรับอัตรารายห้องต้องให้ Owner ขององค์กรดำเนินการ",
 ROOM_RATE_BACKDATE_FORBIDDEN:"ไม่รองรับการเปลี่ยนอัตรารายห้องย้อนหลัง",
 ROOM_RATE_NOT_PERIOD_START:"วันที่มีผลต้องตรงกับวันเริ่มรอบบิล",
 ROOM_RATE_ALREADY_SCHEDULED:"มีอัตรารายห้องที่วันมีผลนี้หรือวันหลังจากนั้นแล้ว",
 ROOM_RATE_UNCHANGED:"อัตรารายห้องไม่เปลี่ยนจากเวอร์ชันก่อนหน้า",
 ROOM_RATE_FUTURE_BILL_EXISTS:"มีบิลอนาคตที่ออกแล้ว ห้ามเปลี่ยนอัตราให้กระทบบิลเดิม",
 ROOM_RATE_COMPLIANCE_REQUIRED:"ต้องผ่านการตรวจอัตราค่าน้ำไฟก่อน",
 ROOM_RATE_ABOVE_REVIEWED_LIMIT:"ค่าน้ำหรือค่าไฟสูงกว่าเพดานที่ผ่านการตรวจสอบ",
 ROOM_RATE_CHANGE_WITHIN_BILLING_PERIOD:"มีการเปลี่ยนอัตรารายห้องกลางรอบ ต้องแยกบิลตามรอบ",
 ROOM_RATE_HISTORY_MISSING:"ไม่พบประวัติราคาห้อง",
 PROPERTY_RATE_OWNER_REQUIRED:"ปรับราคา Master ได้เฉพาะ OWNER ขององค์กร",
 RATE_BACKDATE_FORBIDDEN:"ไม่สามารถนัดอัตราใหม่ย้อนหลังได้",
 RATE_EFFECTIVE_DATE_NOT_PERIOD_START:"วันที่เริ่มใช้อัตราต้องตรงกับวันเริ่มรอบบิล",
 RATE_COMPLIANCE_REVIEW_REQUIRED:"ต้องผ่านการตรวจอัตราค่าน้ำไฟโดย Super Admin ก่อน",
 RATE_ABOVE_REVIEWED_LIMIT:"ค่าน้ำหรือค่าไฟสูงกว่าเพดานที่ผ่านการตรวจสอบ",
 RATE_EFFECTIVE_DATE_ALREADY_SCHEDULED:"วันที่นี้มีอัตรานัดไว้แล้ว หรือมีอัตราในอนาคตที่ใหม่กว่า",
 RATE_UNCHANGED:"อัตราที่กรอกเท่ากับอัตราก่อนหน้า",
 RATE_ALREADY_ISSUED_FUTURE_BILLS:"มีใบแจ้งหนี้ในอนาคตที่ออกไปแล้ว ต้องตรวจสอบก่อนนัดอัตราใหม่",
 RATE_HISTORY_MISSING:"ไม่พบประวัติอัตรา Master",
 RATE_CHANGE_WITHIN_BILLING_PERIOD:"ไม่รองรับการเปลี่ยนราคากลางรอบบิล",
 LEASE_MOVE_OUT_OWNER_REQUIRED:"การปิดสัญญาต้องให้ Owner ขององค์กรดำเนินการ",
 LEASE_ALREADY_ENDED:"สัญญานี้ปิดแล้ว",
 MOVE_OUT_FINAL_METERS_REQUIRED:"ต้องจดมิเตอร์น้ำและไฟ ณ วันสิ้นสุดสัญญาก่อน",
 MOVE_OUT_FINAL_INVOICE_REQUIRED:"ยังไม่มีบิลรอบสุดท้ายที่จบตรงวันสิ้นสุดสัญญา",
 MOVE_OUT_UNSETTLED_INVOICES:"ยังมีใบแจ้งหนี้ที่ค้างชำระ",
 MOVE_OUT_PENDING_PAYMENT:"ยังมีคำขอแจ้งชำระรอตรวจสอบ",
 MOVE_OUT_PENDING_FINANCE:"ยังมีคำขอปรับปรุงยอดเงินที่รอตรวจสอบ",
 MOVE_OUT_FUTURE_INVOICE_EXISTS:"มีใบแจ้งหนี้ที่ออกเกินวันสิ้นสุดที่เลือก",
 MOVE_OUT_BOUNDARY_OUT_OF_RANGE:"วันสิ้นสุดต้องอยู่หลังวันเริ่มสัญญาและไม่เกินวันนี้",
 MAINTENANCE_TRANSITION_INVALID:"เปลี่ยนสถานะงานซ่อมข้ามขั้นตอนที่อนุญาตไม่ได้",
 TENANT_LEASE_NOT_FOUND:"แจ้งซ่อมได้เฉพาะสัญญาที่เชื่อมกับบัญชีนี้และยังใช้งานอยู่",
 ROOM_NOT_AVAILABLE_FOR_MAINTENANCE:"เริ่มซ่อมได้เฉพาะห้องว่าง",
 ROOM_NOT_IN_MAINTENANCE:"ห้องนี้ไม่ได้อยู่ในสถานะซ่อมบำรุง",
 ROOM_HAS_ACTIVE_LEASE:"ห้องยังมีสัญญาเช่าที่ใช้งานอยู่",
 ROOM_MAINTENANCE_TICKETS_OPEN:"ต้องปิดงานซ่อมของห้องทั้งหมดก่อนคืนห้อง",
 ROOM_NOT_OCCUPIED:"สถานะห้องไม่สอดคล้องกับสัญญาที่ใช้งาน",
 UNAUTHENTICATED:"กรุณาเข้าสู่ระบบ",COMPLIANCE_REVIEW_REQUIRED:"ต้องให้ Super Admin ตรวจอัตราน้ำไฟก่อนออกบิล",
 TARIFF_ABOVE_REVIEWED_LIMIT:"อัตราค่าน้ำหรือค่าไฟเกินวงเงินที่ตรวจสอบแล้ว",
 METER_BOUNDARY_READING_REQUIRED:"ต้องมีเลขมิเตอร์ทั้งวันเริ่มต้นและวันสิ้นสุดรอบบิล",
 FULL_PERIOD_ACTIVE_LEASE_REQUIRED:"ต้องมีสัญญาเช่าที่มีผลตลอดรอบบิล",
 INVALID_BILLING_PERIOD:"ช่วงวันที่ไม่ตรงกับรอบบิลของหอพัก",PERIOD_ALREADY_BILLED:"ออกบิลสำหรับรอบนี้แล้ว",
 ROOM_NOT_AVAILABLE:"ห้องนี้ไม่ว่าง",IDEMPOTENCY_KEY_REUSED:"รหัสคำขอถูกใช้กับบิลอื่นแล้ว",
 ORG_ACCESS_DENIED:"ไม่มีสิทธิ์เข้าถึงหอพักนี้", INVITATION_NOT_FOUND:"รหัสเชิญไม่ถูกต้อง หมดอายุ หรือถูกใช้แล้ว",
 INVITATION_NOT_APPROVABLE:"คำขอเชิญนี้ยังไม่พร้อมอนุมัติ", LEASE_ALREADY_LINKED:"สัญญานี้ผูกบัญชีแล้ว", LEASE_NOT_INVITABLE:"สัญญานี้ยังเชิญผู้เช่าไม่ได้"};
async function api<T>(path:string, options:RequestInit={}):Promise<T>{
 const headers=new Headers(options.headers);
 if(!(options.body instanceof FormData)&&!headers.has("content-type"))headers.set("content-type","application/json");
 const response=await fetch("/v1"+path,{...options,credentials:"include",headers});
 let data:unknown;try{data=await response.json();}catch{data={error:"NETWORK_ERROR"};}
 if(!response.ok){const code=(data as {error?:string})?.error||"REQUEST_FAILED";throw new Error(labels[code]||code);}
 return data as T;
}
async function post<T>(url:string,body:unknown,headers?:HeadersInit){return api<T>(url,{method:"POST",body:JSON.stringify(body),headers});}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}</label>;}
function Panel({title,subtitle,children,action}:{title:string;subtitle?:string;children:React.ReactNode;action?:React.ReactNode}){return <section className="panel"><div className="panel-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>{children}</section>;}
function App(){
 const [me,setMe]=useState<Me|null>(null),[orgs,setOrgs]=useState<Organization[]>([]),[props,setProps]=useState<Property[]>([]);
 const [orgId,setOrgId]=useState(""),[propertyId,setPropertyId]=useState(""),[section,setSection]=useState<Section>(sectionFromUrl()??"overview");
 const [rooms,setRooms]=useState<Room[]>([]),[leases,setLeases]=useState<Lease[]>([]),
 [invoices,setInvoices]=useState<Invoice[]>([]);
 const [overview,setOverview]=useState<{rooms:number;occupied:number;available:number;totalBilledSatang:number;issuedInvoices:number;manuallyApprovedSatang:number;outstandingSatang:number;overdueSatang:number;overdueInvoiceCount:number}|null>(null);
 const [admin,setAdmin]=useState<{organizationCount:number;propertyCount:number;roomCount:number;invoiceCount:number}|null>(null);
 const [error,setError]=useState(""),[success,setSuccess]=useState(""),[busy,setBusy]=useState(false),[menu,setMenu]=useState(false);
 const [lineBusy,setLineBusy]=useState(false),[hasTenantLease,setHasTenantLease]=useState(false);
 const property=props.find(p=>p.id===propertyId);
 const orgRole=me?.memberships?.find(m=>m.organizationId===orgId)?.role;
 const isStaff=orgRole==="STAFF";
 const staffGrantLevel=me?.propertyGrants?.find(g=>g.propertyId===propertyId)?.level;
 const notify=(message:string)=>{setError("");setSuccess(message);};
 const loadMe=useCallback(async()=>{
  try{const result=await api<Me>("/me");setMe(result);return result;}catch{return null;}
 },[]);
 const loadOrgs=useCallback(async()=>{const items=await api<Organization[]>("/organizations");setOrgs(items);setOrgId(v=>items.some(o=>o.id===v)?v:(items[0]?.id||""));return items;},[]);
 const loadTenantLeases=useCallback(async()=>{try{const items=await api<{leaseId:string}[]>("/tenant/leases");setHasTenantLease(items.length>0);return items;}catch{setHasTenantLease(false);return [] as {leaseId:string}[];}},[]);
 const loadProps=useCallback(async(org:string)=>{const data=await api<Property[]>("/organizations/"+org+"/properties");
  setProps(data);setPropertyId(prev=>data.some(p=>p.id===prev)?prev:(data[0]?.id||""));},[]);
 const loadProperty=useCallback(async(p:string,staff=false)=>{
  if(staff){
   const rs=await api<Room[]>("/properties/"+p+"/rooms");
   setRooms(rs);setInvoices([]);setOverview(null);setLeases([]);return;
  }
  const [rs,ins,ov,ls]=await Promise.all([
    api<Room[]>("/properties/"+p+"/rooms"),
    api<Invoice[]>("/properties/"+p+"/invoices"),
    api<typeof overview>("/properties/"+p+"/overview"),
    api<Lease[]>("/properties/"+p+"/leases")
  ]);
  setRooms(rs);setInvoices(ins);setOverview(ov);setLeases(ls);
 },[]);
 useEffect(()=>{void (async()=>{const user=await loadMe();if(!user)return;const [,tenantLeases]=await Promise.all([loadOrgs(),loadTenantLeases()]);const hasWorkspace=user.role==="SUPER_ADMIN"||(user.memberships?.length??0)>0;const requested=sectionFromUrl();if(!requested||(requested==="overview"&&!hasWorkspace&&tenantLeases.length>0))setSection(hasWorkspace?"overview":tenantLeases.length>0?"tenant":"overview");})();},[loadMe,loadOrgs,loadTenantLeases]);
 useEffect(()=>{if(orgId)void loadProps(orgId).catch(e=>setError(e.message));else {setProps([]);setPropertyId("");}},[orgId,loadProps]);
 useEffect(()=>{if(propertyId)void loadProperty(propertyId,isStaff).catch(e=>setError(e.message));else {setRooms([]);setLeases([]);setInvoices([]);setOverview(null);}},[propertyId,isStaff,loadProperty]);
 useEffect(()=>{if(isStaff&&!["rooms","meter","tenant"].includes(section))setSection("rooms");},[isStaff,section]);
 useEffect(()=>{if(section==="admin"&&me?.role==="SUPER_ADMIN")void api<typeof admin>("/admin/overview").then(setAdmin).catch(e=>setError(e.message));},[section,me?.role]);
 async function run(task:()=>Promise<void>){setBusy(true);setError("");setSuccess("");try{await task();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function login(){
  setLineBusy(true);setError("");
  try{
   const id=import.meta.env.VITE_LIFF_ID as string|undefined;
   if(!id)throw new Error("ยังไม่ได้ตั้งค่า VITE_LIFF_ID บนเว็บ");
   await liff.init({liffId:id});
   if(!liff.isLoggedIn()){liff.login({redirectUri:window.location.href});return;}
   const refreshExpiredLineToken=()=>{
    const key="apartment.liff.expired-token-refresh";
    if(sessionStorage.getItem(key)==="1"){sessionStorage.removeItem(key);return false;}
    sessionStorage.setItem(key,"1");
    const inLiffBrowser=liff.isInClient();
    liff.logout();
    if(inLiffBrowser)window.location.reload();
    else liff.login({redirectUri:window.location.href});
    return true;
   };
   const decoded=liff.getDecodedIDToken();
   if(typeof decoded?.exp==="number"&&decoded.exp*1000<=Date.now()){
    if(refreshExpiredLineToken())return;
    throw new Error("LINE ID Token หมดอายุ กรุณาปิดแล้วเปิด LIFF ใหม่อีกครั้ง");
   }
   const token=liff.getIDToken();
   if(!token)throw new Error("LINE Login ต้องเปิด scope openid เพื่อรับ ID Token");
   try{await post("/auth/line/exchange",{idToken:token});}
   catch(e){
    if((e as Error).message==="LINE_ID_TOKEN_EXPIRED"){
     if(refreshExpiredLineToken())return;
     throw new Error("LINE ID Token หมดอายุ กรุณาปิดแล้วเปิด LIFF ใหม่อีกครั้ง");
    }
    throw e;
   }
   sessionStorage.removeItem("apartment.liff.expired-token-refresh");
   const user=await loadMe();
   if(!user)throw new Error("LINE ยืนยันตัวตนแล้ว แต่สร้างเซสชันเว็บไม่สำเร็จ กรุณาลองอีกครั้ง");
   const [orgItems,tenantLeases]=await Promise.all([loadOrgs(),loadTenantLeases()]);
   const hasWorkspace=user.role==="SUPER_ADMIN"||(user.memberships?.length??0)>0||orgItems.length>0;
   const requested=sectionFromUrl();
   setSection(requested&&!(requested==="overview"&&!hasWorkspace&&tenantLeases.length>0)?requested:hasWorkspace?"overview":tenantLeases.length>0?"tenant":"overview");
   setMenu(false);notify("เข้าสู่ระบบเรียบร้อย");
  }catch(e){setError((e as Error).message);}finally{setLineBusy(false);}
 }
 async function createOrg(form:FormData){await run(async()=>{await post("/organizations",{name:String(form.get("name"))});await loadMe();await loadOrgs();notify("เพิ่มบัญชีเจ้าของหอพักเรียบร้อย");});}
 async function createProperty(form:FormData){if(!orgId)return;await run(async()=>{
  await post("/organizations/"+orgId+"/properties",{name:String(form.get("name")),address:String(form.get("address")),
   rentSatang:satang(String(form.get("rent"))),waterSatangPerUnit:satang(String(form.get("water"))),
   electricSatangPerUnit:satang(String(form.get("electric"))),cadence:String(form.get("cadence")),
   rollingAnchor:form.get("cadence")==="EVERY_15_DAYS"?String(form.get("anchor")):null,dueDays:7});
  await loadProps(orgId);notify("เพิ่มหอพักเรียบร้อย");
 });}
 async function createRoom(form:FormData){if(!property)return;await run(async()=>{
  await post("/properties/"+property.id+"/rooms",{number:String(form.get("number")),floor:Number(form.get("floor"))});
  await loadProperty(property.id);notify("เพิ่มห้องพักแล้ว");
 });}
 async function overrideRoom(form:FormData){if(!property)return;await run(async()=>{
  const id=String(form.get("roomId"));const b:Record<string,number|null>={};
  for(const k of ["rent","water","electric"]){const raw=String(form.get(k)??"").trim();
    b[k+"OverrideSatang"]=raw===""?null:satang(raw);}
  await post("/properties/"+property.id+"/rooms/"+id+"/rates",{
   ...b,effectiveFrom:String(form.get("effectiveFrom")),
   reason:String(form.get("reason")||"").trim()
  });
  await loadProperty(property.id);notify("บันทึกอัตราห้องตามวันที่มีผลแล้ว โดยไม่แก้ไขบิลเก่า");
 });}
 async function createLease(form:FormData){if(!property)return;await run(async()=>{
  await post("/properties/"+property.id+"/leases",{roomId:String(form.get("roomId")),
   tenantName:String(form.get("name")),startDate:String(form.get("start"))});
  await loadProperty(property.id);notify("บันทึกสัญญาเช่าแล้ว");
 });}
 async function moveOut(form:FormData){
  if(!property)return;
  const leaseId=String(form.get("leaseId"));
  const lease=leases.find(l=>l.id===leaseId);
  if(!lease||!window.confirm("ยืนยันปิดสัญญา "+lease.tenantName+
    " หลังตรวจยอดคงค้างและส่งมอบห้องแล้ว? การดำเนินการนี้ย้อนกลับไม่ได้"))return;
  await run(async()=>{
   await post("/properties/"+property.id+"/leases/"+leaseId+"/move-out",{
    endExclusive:String(form.get("endExclusive")),
    roomDisposition:String(form.get("roomDisposition")),
    confirmedHandover:true
   });
   await loadProperty(property.id);
   notify("ปิดสัญญาและปรับสถานะห้องเรียบร้อย ข้อมูลบิลเดิมยังอยู่");
  });
 }
 async function reading(form:FormData){if(!property)return;await run(async()=>{
  await post("/properties/"+property.id+"/readings",{roomId:String(form.get("roomId")),kind:String(form.get("kind")),
   readAt:String(form.get("day")),value:String(form.get("value"))});
  notify("บันทึกเลขมิเตอร์เรียบร้อย");
 });}
 async function meterSwap(form:FormData){
  if(!property)return;
  if(!window.confirm("ยืนยันเปลี่ยนมิเตอร์จริง? ระบบจะเก็บค่าปิดมิเตอร์เก่าและค่าเปิดมิเตอร์ใหม่เป็นประวัติถาวร"))return;
  await run(async()=>{
   const roomId=String(form.get("roomId"));
   await post("/properties/"+property.id+"/rooms/"+roomId+"/meter-replacements",{
    roomId,kind:String(form.get("kind")),replacedAt:String(form.get("replacedAt")),
    oldSerial:String(form.get("oldSerial")),newSerial:String(form.get("newSerial")),
    oldClosingValue:String(form.get("oldClosingValue")),
    newOpeningValue:String(form.get("newOpeningValue")),
    evidenceRef:String(form.get("evidenceRef")),reason:String(form.get("reason"))
   });
   notify("บันทึกการเปลี่ยนมิเตอร์พร้อมค่าปิดเก่า/ค่าเริ่มใหม่แล้ว");
  });
 }
 async function preview(form:FormData,issue:boolean){if(!property)return;await run(async()=>{
  const partialMode=String(form.get("partialMode")||"");
  const payload={roomId:String(form.get("roomId")),start:String(form.get("start")),
   endExclusive:String(form.get("end")),
   ...(partialMode==="MOVE_IN"||partialMode==="MOVE_OUT"?
    {partialMode:partialMode as "MOVE_IN"|"MOVE_OUT"}:{})};
  if(issue){const key=crypto.randomUUID();
   const result=await post<{invoice:Invoice}>("/properties/"+property.id+"/bills/issue",payload,{"idempotency-key":key});
   notify("ออกบิลสำเร็จ "+money(result.invoice.amountSatang));await loadProperty(property.id);
  }else {const result=await post<{totalSatang:number;lines:{description:string;amountSatang:number}[]}>("/properties/"+property.id+"/bills/preview",payload);
   notify("ยอดทดลอง "+money(result.totalSatang)+" | "+result.lines.map(l=>l.description+" "+money(l.amountSatang)).join(" · "));
  }
 });}
 async function compliance(form:FormData){if(!property)return;await run(async()=>{
  await post("/admin/properties/"+property.id+"/compliance",{evidenceRef:String(form.get("evidence")),
   waterAllowedMax:satang(String(form.get("waterMax"))),electricAllowedMax:satang(String(form.get("electricMax")))});
  await loadProps(orgId);notify("บันทึกการตรวจสอบอัตราแล้ว");
 });}
 async function logout(){await run(async()=>{await post("/auth/logout",{});setMe(null);setOrgs([]);setOrgId("");setPropertyId("");notify("ออกจากระบบแล้ว");});}
 const form=(fn:(data:FormData)=>Promise<void>,content:React.ReactNode)=>(
  <form className="form" onSubmit={e=>{e.preventDefault();void fn(new FormData(e.currentTarget));}}>{content}<button className="btn primary" disabled={busy} type="submit">{busy?"กำลังบันทึก...":"บันทึกข้อมูล"}</button></form>);
 return <div className="shell">
  {me&&<aside className={"sidebar "+(menu?"expanded":"")}><div className="brand"><div className="brand-symbol"><Building2 size={23}/></div><span>Apartment<span className="brand-dot">.</span><small>PROPERTY MANAGEMENT</small></span></div>
   <div className="nav-caption">WORKSPACE</div>
   <nav aria-label="เมนูหลัก">{sections.filter(([id])=>{
    if(id==="admin")return me.role==="SUPER_ADMIN";
    if(id==="staff")return orgRole==="OWNER";
    if(id==="profile")return true;
    if(hasTenantLease&&!me.memberships?.length&&me.role!=="SUPER_ADMIN")return id==="tenant";
    if(isStaff)return ["rooms","meter","tenant"].includes(id);
    return true;
   }).map(([id,label,icon])=><button key={id} onClick={()=>{setSection(id);setMenu(false);setError("");setSuccess("");}} className={"nav-item "+(section===id?"selected":"")}>{icon}<span>{label}</span></button>)}</nav>
   <div className="aside-bottom"><div className="avatar">{me.name.slice(0,1).toUpperCase()}</div><div><b>{me.name}</b><small>{me.role==="SUPER_ADMIN"?"Super Admin":isStaff?"พนักงาน":orgRole==="OWNER"?"เจ้าของ":"ผู้จัดการ"}</small></div><button onClick={()=>void logout()} aria-label="ออกจากระบบ" className="logout"><LogOut size={18}/></button></div>
  </aside>}
  <div className="workspace">
   <header className="topbar"><div className="top-left">{me&&<button className="menu-btn" onClick={()=>setMenu(!menu)} aria-label="เมนู"><Menu size={23}/></button>}<div><div className="eyebrow">APARTMENT CONSOLE</div><h1>{me?(sections.find(s=>s[0]===section)?.[1]||"ภาพรวม"):"ยินดีต้อนรับ"}</h1></div></div>
    {me&&<div className="selectors"><label><span>บัญชีเจ้าของ</span><select value={orgId} onChange={e=>setOrgId(e.target.value)}>{orgs.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select></label>
      <label><span>หอพัก</span><select value={propertyId} onChange={e=>setPropertyId(e.target.value)}>{props.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label></div>}
   </header>
   <main className="content">
    {error&&<div className="notice danger" role="alert"><AlertTriangle size={18}/>{error}</div>}
    {success&&<div className="notice success" role="status"><CheckCircle2 size={18}/>{success}</div>}
    {!me?<div className="welcome"><div className="welcome-art"><Building2 size={48}/></div><h2>หอพักของคุณ จัดการง่ายในที่เดียว</h2><p>ดูห้องพัก จดน้ำไฟ ออกบิลใน LINE OA อย่างเป็นระบบและปลอดภัย</p><button className="btn primary large" disabled={lineBusy} onClick={()=>void login()}>{lineBusy?"กำลังเชื่อมต่อ...":"เข้าสู่ระบบด้วย LINE"}</button><small>ระบบจะตรวจสอบ LINE ID Token จากฝั่งเซิร์ฟเวอร์ก่อนเข้าสู่ระบบ</small></div>:
    <>
    {orgs.length===0&&section==="overview"&&<Panel title="สร้างบัญชีเจ้าของหอพัก" subtitle="ผู้ใช้หนึ่งคนสามารถมีหลายบัญชีและหลายหอพักได้">{form(createOrg,<Field label="ชื่อบัญชีเจ้าของ"><input name="name" required minLength={2} placeholder="เช่น บริษัท บ้านรุ่งเรือง"/></Field>)}</Panel>}
    {orgId&&props.length===0&&!isStaff&&section!=="tenant"&&<Panel title="เพิ่มหอพักแห่งแรก" subtitle="ตั้งราคา Master ที่ทุกห้องจะได้รับโดยอัตโนมัติ">{form(createProperty,<><Field label="ชื่อหอพัก"><input name="name" required placeholder="บ้านสุขใจ"/></Field><Field label="ที่อยู่"><input name="address" placeholder="ที่อยู่หอพัก"/></Field>
      <div className="cols3"><Field label="ค่าเช่า / เดือน (บาท)"><input name="rent" type="number" step=".01" min="0" required defaultValue="4000"/></Field><Field label="ค่าน้ำ / หน่วย (บาท)"><input name="water" type="number" step=".01" min="0" required defaultValue="18"/></Field><Field label="ค่าไฟ / หน่วย (บาท)"><input name="electric" type="number" step=".01" min="0" required defaultValue="4"/></Field></div>
      <Field label="รอบบิล"><select name="cadence" defaultValue="MONTHLY"><option value="MONTHLY">รายเดือน</option><option value="SEMI_MONTHLY">เดือนละ 2 รอบ</option><option value="EVERY_15_DAYS">ทุก 15 วัน (ต้องระบุ Anchor)</option></select></Field><Field label="วันที่ Anchor (เมื่อใช้ทุก 15 วัน)"><input name="anchor" type="date"/></Field></>)}</Panel>}
    {property&&section==="overview"&&<>
      <div className="hero"><div><span className="hero-kicker">YOUR PROPERTY AT A GLANCE</span><h2>สวัสดี, {me.name} <span>✦</span></h2><p>จัดการ {property.name} ให้เป็นเรื่องง่ายในทุกวัน</p></div><div className="hero-building"><Building2 size={68}/></div></div>
      <div className="stats">
       <div className="stat"><span>ห้องพักทั้งหมด <DoorOpen size={17}/></span><strong>{overview?.rooms??"—"}</strong><small>ห้องในระบบ</small></div>
       <div className="stat"><span>ห้องมีผู้เช่า <Users size={17}/></span><strong>{overview?.occupied??"—"}</strong><small>ห้องที่มีสัญญาเช่า</small></div>
       <div className="stat"><span>ห้องว่าง <Building2 size={17}/></span><strong>{overview?.available??"—"}</strong><small>พร้อมเปิดเช่า</small></div>
       <div className="stat"><span>ยอดออกบิลสะสม <Wallet size={17}/></span><strong>{money(overview?.totalBilledSatang)}</strong><small>ยังไม่ใช่ยอดรับชำระ</small></div>
      </div><Panel title="ภาพรวมห้องพัก" subtitle="สถานะห้องทั้งหมดในหอพัก"><div className="room-grid">{rooms.map(r=><div className="room-tile" key={r.id}><div className="room-icon"><DoorOpen size={19}/></div><b>{r.number}</b><small>ชั้น {r.floor}</small><span className={"pill "+(r.status==="OCCUPIED"?"occupied":"vacant")}>{r.status==="OCCUPIED"?"มีผู้เช่า":r.status==="AVAILABLE"?"ว่าง":"ซ่อมบำรุง"}</span></div>)}</div>{rooms.length===0&&<p className="empty">ยังไม่มีห้องพัก เริ่มสร้างจากเมนูห้องพัก</p>}</Panel>
      <Panel title="ภาพรวมยอดเรียกเก็บและรับชำระ" subtitle="ยอดอนุมัติเป็นการตรวจสอบด้วยมือของเจ้าของหอพัก ไม่ใช่หลักฐานจาก Bank API"><div className="payment-figures"><div><small>อนุมัติรับชำระสะสม</small><strong>{money(overview?.manuallyApprovedSatang)}</strong></div><div><small>ยอดบิลคงเหลือทั้งหมด</small><strong>{money(overview?.outstandingSatang)}</strong></div><div><small>ยอดเลยกำหนด ({overview?.overdueInvoiceCount??0} ใบ)</small><strong>{money(overview?.overdueSatang)}</strong></div></div></Panel>
      <div className="two-col"><Panel title="ค่าบริการเริ่มต้น" subtitle="ห้องพักสามารถกำหนดราคาเฉพาะของตัวเอง"><div className="rate-row"><span>ค่าเช่ารายเดือน</span><b>{money(property.rentSatang)}</b></div><div className="rate-row"><span>ค่าน้ำ / หน่วย</span><b>{money(property.waterSatangPerUnit)}</b></div><div className="rate-row"><span>ค่าไฟ / หน่วย</span><b>{money(property.electricSatangPerUnit)}</b></div></Panel>
      <Panel title="สถานะออกบิล" subtitle="ความพร้อมก่อนส่งใบแจ้งหนี้"><div className="rate-row"><span>รอบบิล</span><b>{property.cadence}</b></div><div className="rate-row"><span>การยืนยันอัตราค่าน้ำไฟ</span><span className={"pill "+(property.complianceReviewedAt?"vacant":"occupied")}>{property.complianceReviewedAt?"ตรวจแล้ว":"รออนุมัติ"}</span></div><div className="rate-row"><span>ใบแจ้งหนี้ที่ออก</span><b>{overview?.issuedInvoices??0} ใบ</b></div></Panel></div>
      {!isStaff&&<PropertyOperationsReports api={api} propertyId={property.id}/>}
    </>}
    {property&&section==="rooms"&&isStaff&&<Panel title="ห้องพักที่ได้รับสิทธิ์" subtitle="แสดงเฉพาะหอพักที่เจ้าของอนุญาต ไม่มีข้อมูลค่าเช่าหรือข้อมูลส่วนตัวผู้เช่า">
      <div className="room-grid">{rooms.map(r=><div className="room-tile" key={r.id}>
       <b>{r.number}</b><small>ชั้น {r.floor}</small><span className="pill">{r.status}</span>
      </div>)}</div>{rooms.length===0&&<p className="empty">ยังไม่มีห้องพัก</p>}
     </Panel>}
    {property&&section==="rooms"&&!isStaff&&<><Panel title="เพิ่มห้องพักใหม่" subtitle="ห้องใหม่จะใช้ราคา Master จนกว่าจะกำหนดราคาเฉพาะห้อง">{form(createRoom,<div className="cols2"><Field label="หมายเลขห้อง"><input name="number" required placeholder="A101"/></Field><Field label="ชั้น"><input name="floor" type="number" min="0" defaultValue="1" required/></Field></div>)}</Panel>
      <Panel title="รายการห้องพัก" subtitle="นัดเปลี่ยนอัตรารายห้องตามวันที่เริ่มรอบบิล: เว้นว่างเพื่อสืบทอด Master"><div className="room-list">{rooms.map(r=><details className="room-detail" key={r.id}><summary><span className="room-number"><DoorOpen size={20}/>{r.number} <small>ชั้น {r.floor}</small></span><span className={"pill "+(r.status==="OCCUPIED"?"occupied":"vacant")}>{r.status==="OCCUPIED"?"มีผู้เช่า":r.status==="AVAILABLE"?"ว่าง":"ซ่อมบำรุง"}</span><ChevronDown size={17}/></summary>
      {orgRole==="OWNER"&&form(overrideRoom,<><input name="roomId" type="hidden" value={r.id}/><div className="cols3"><Field label="ค่าเช่า (บาท)"><input name="rent" type="number" min="0" step=".01" placeholder={String(property.rentSatang/100)} defaultValue={r.rentOverrideSatang===null?"":String(r.rentOverrideSatang/100)}/></Field><Field label="ค่าน้ำ (บาท)"><input name="water" type="number" min="0" step=".01" placeholder={String(property.waterSatangPerUnit/100)} defaultValue={r.waterOverrideSatang===null?"":String(r.waterOverrideSatang/100)}/></Field><Field label="ค่าไฟ (บาท)"><input name="electric" type="number" min="0" step=".01" placeholder={String(property.electricSatangPerUnit/100)} defaultValue={r.electricOverrideSatang===null?"":String(r.electricOverrideSatang/100)}/></Field></div><div className="cols3"><Field label="วันที่มีผล (วันเริ่มรอบบิล)">
       <input name="effectiveFrom" required type="date" min={dateNow()}/>
      </Field><Field label="เหตุผลปรับราคา">
       <input name="reason" required minLength={12} maxLength={500}
        placeholder="ระบุเหตุผลการเปลี่ยนอัตราห้อง"/>
      </Field></div></>)}{orgRole==="OWNER"&&<RoomRateHistory propertyId={property.id}
        roomId={r.id} api={api}/>}</details>)}</div></Panel>
      <Panel title="เปิดสัญญาเช่าห้อง" subtitle="เริ่มต้นผูกผู้เช่าเข้ากับห้องว่างก่อนจดมิเตอร์และออกบิล">{form(createLease,<div className="cols3"><Field label="ห้องว่าง"><select name="roomId" required>{rooms.filter(r=>r.status==="AVAILABLE").map(r=><option key={r.id} value={r.id}>{r.number}</option>)}</select></Field><Field label="ชื่อผู้เช่า"><input name="name" placeholder="ชื่อ-นามสกุล" required/></Field><Field label="วันเริ่มสัญญา"><input name="start" type="date" required defaultValue={dateNow()}/></Field></div>)}</Panel></>}
    {property&&section==="rooms"&&orgRole==="OWNER"&&
      <Panel title="สิ้นสุดสัญญาและย้ายออก (Owner)"
       subtitle="ต้องมีเลขมิเตอร์วันสิ้นสุด บิลรอบสุดท้าย และชำระยอดครบทุกใบก่อนคืนห้อง">
       {leases.some(l=>l.status==="ACTIVE")?
        form(moveOut,<div className="cols3">
         <Field label="สัญญาที่ต้องการปิด"><select required name="leaseId">
          {leases.filter(l=>l.status==="ACTIVE").map(l=><option key={l.id} value={l.id}>
           {rooms.find(r=>r.id===l.roomId)?.number??"ห้อง"} — {l.tenantName}
          </option>)}
         </select></Field>
         <Field label="วันสิ้นสุด (ไม่รวมวันนี้)"><input required type="date"
          name="endExclusive" max={dateNow()} defaultValue={dateNow()}/></Field>
         <Field label="สถานะห้องหลังส่งมอบ"><select required name="roomDisposition">
          <option value="MAINTENANCE">รอตรวจ/ซ่อมบำรุง</option>
          <option value="AVAILABLE">ว่าง พร้อมให้เช่า</option>
         </select></Field>
         <p className="hint">ต้องตรวจสอบการคืนเงินประกันและภาระผูกพันตามสัญญานอกระบบก่อนยืนยัน
          ระบบจะไม่ตัดยอดหนี้หรือคืนเงินให้อัตโนมัติ</p>
        </div>):<p className="hint">ไม่มีสัญญาเช่าที่กำลังใช้งาน</p>}
      </Panel>}
    {property&&section==="meter"&&<>{(!isStaff||staffGrantLevel==="METER_READER")&&<Panel title="จดเลขมิเตอร์" subtitle="กรอกเลขมิเตอร์น้ำและไฟ พร้อมวันที่อ่านจริง เลขต้องไม่ลดลง">{form(reading,<div className="cols2"><Field label="ห้องพัก"><select name="roomId">{rooms.map(r=><option key={r.id} value={r.id}>{r.number}</option>)}</select></Field><Field label="ประเภท"><select name="kind"><option value="WATER">ค่าน้ำ</option><option value="ELECTRIC">ค่าไฟ</option></select></Field><Field label="วันที่อ่าน"><input type="date" name="day" required defaultValue={dateNow()}/></Field><Field label="เลขมิเตอร์"><input name="value" required inputMode="decimal" placeholder="1234.000"/></Field></div>)}</Panel>}{orgRole==="OWNER"&&<Panel title="เปลี่ยนมิเตอร์น้ำ/ไฟ (Owner)"
       subtitle="บันทึกหมายเลขเครื่อง ค่าปิดเก่า ค่าเริ่มใหม่ และเลขอ้างอิงหลักฐาน">
       {form(meterSwap,<div className="cols2">
        <Field label="ห้อง"><select name="roomId">
         {rooms.map(r=><option key={r.id} value={r.id}>{r.number}</option>)}
        </select></Field>
        <Field label="ประเภท"><select name="kind">
         <option value="WATER">น้ำ</option><option value="ELECTRIC">ไฟ</option>
        </select></Field>
        <Field label="วันที่เปลี่ยน"><input type="date" required
         name="replacedAt" max={dateNow()} defaultValue={dateNow()}/></Field>
        <Field label="Serial มิเตอร์เก่า"><input name="oldSerial" required minLength={3}/></Field>
        <Field label="Serial มิเตอร์ใหม่"><input name="newSerial" required minLength={3}/></Field>
        <Field label="เลขปิดมิเตอร์เก่า"><input name="oldClosingValue" required
         inputMode="decimal" placeholder="123.000"/></Field>
        <Field label="เลขเริ่มมิเตอร์ใหม่"><input name="newOpeningValue" required
         inputMode="decimal" placeholder="0.000"/></Field>
        <Field label="เลขอ้างอิงหลักฐานการส่งมอบ"><input name="evidenceRef" required minLength={8}
         placeholder="เลขเอกสารหรือ ID รูปที่จัดเก็บ"/></Field>
        <Field label="เหตุผล"><input name="reason" required minLength={12}
         maxLength={500}/></Field>
       </div>)}
      </Panel>}
      <MeterEvidenceCenter key={property.id} propertyId={property.id} rooms={rooms} canUpload={!isStaff||staffGrantLevel==="METER_READER"} canReview={orgRole==="OWNER"} api={api} post={post}/>
      {orgRole==="OWNER"&&<MeterReplacementHistory propertyId={property.id} rooms={rooms} api={api}/>}
      {isStaff&&<StaffMeterReadings key={property.id} propertyId={property.id} rooms={rooms} api={api}/>}
      {!isStaff&&<div className="hint"><Gauge size={19}/> ระบบบันทึกค่าเริ่มใหม่ในวันที่เปลี่ยนโดยอัตโนมัติ และรวมหน่วยการใช้งานข้ามมิเตอร์ก่อนออกบิล ต้องมีค่าที่ต้นและปลายรอบบิลด้วย</div>}</>}
    {property&&section==="billing"&&<>{orgRole==="OWNER"&&<BulkBillingCenter propertyId={property.id} cadence={property.cadence} api={api} post={post} onIssued={()=>loadProperty(property.id)}/>}<Panel title="ออกใบแจ้งหนี้รายห้อง" subtitle="ทดลองคำนวณก่อน แล้วจึงกดออกบิลจริงภายหลังตรวจความถูกต้อง"><form className="form" onSubmit={e=>{e.preventDefault();void preview(new FormData(e.currentTarget),false);}}><div className="cols3"><Field label="ห้องพัก"><select name="roomId">{rooms.filter(r=>r.status==="OCCUPIED").map(r=><option key={r.id} value={r.id}>{r.number}</option>)}</select></Field><Field label="วันเริ่มรอบ"><input name="start" required type="date"/></Field><Field label="วันสิ้นสุด (ไม่รวมวันนี้)"><input name="end" required type="date"/></Field></div><Field label="ประเภทการออกบิล">
       <select name="partialMode" defaultValue="">
        <option value="">รอบบิลเต็มตามปกติ</option>
        <option value="MOVE_IN">ย้ายเข้ากลางรอบ (เริ่มตรงวันเริ่มสัญญาเท่านั้น)</option>
        <option value="MOVE_OUT">บิลสุดท้ายย้ายออกกลางรอบ (ถึงวันส่งมอบจริง)</option>
       </select>
      </Field><p className="hint">บิลย้ายเข้ากลางรอบต้องมีเลขมิเตอร์น้ำและไฟ ณ วันเริ่มสัญญาและวันสิ้นรอบบิล
       ระบบจะคิดค่าเช่าตามจำนวนวันที่พักจริง รวมหน่วยมิเตอร์ก่อนและหลังการเปลี่ยนมิเตอร์ และไม่อนุญาตให้ออกบิลซ้อนช่วงที่เรียกเก็บแล้ว</p>
      <div className="actions"><button className="btn outline" disabled={busy} type="submit">คำนวณยอดก่อนออกบิล</button><button className="btn primary" disabled={busy} type="button" onClick={e=>{const f=e.currentTarget.closest("form");if(f&&window.confirm("ยืนยันออกบิลจริงสำหรับห้องและรอบวันที่เลือก?"))void preview(new FormData(f),true);}}>ยืนยันออกบิล</button></div></form></Panel>
      <Panel title="ใบแจ้งหนี้ที่ออกแล้ว" subtitle="ยอดเป็นหนี้ตั้งต้น; การรับชำระตรวจโดยเจ้าของจากหลักฐาน และยังไม่เชื่อม Bank API"><div className="table-scroll"><table><thead><tr><th>หมายเลขห้อง</th><th>รอบบิล</th><th>ครบกำหนด</th><th>ยอดเงิน</th><th>สถานะ</th><th>PDF</th></tr></thead><tbody>{invoices.map(i=><tr key={i.id}><td><b>{rooms.find(r=>r.id===i.roomId)?.number??"-"}</b></td><td>{i.periodStart} → {i.periodEnd}</td><td>{i.dueDate}</td><td>{money(i.amountSatang)}</td><td><span className="pill occupied">{i.status}</span></td><td><a className="btn outline" href={"/v1/properties/"+property.id+"/invoices/"+i.id+"/billing-notice.pdf"} target="_blank" rel="noopener noreferrer">ดาวน์โหลด PDF</a></td></tr>)}</tbody></table>{invoices.length===0&&<p className="empty">ยังไม่มีบิล</p>}</div></Panel></>}
    {property&&section==="payments"&&<>{orgRole==="OWNER"?<><PaymentCenter key={property.id} propertyId={property.id} api={api} post={post}/><DepositCenter key={"deposit-"+property.id} propertyId={property.id} leases={leases} actorId={me.id} api={api} post={post}/></>:<Panel title="การเงินสำหรับเจ้าของหอพัก" subtitle="ผู้จัดการสามารถดูสถานะการดำเนินงานจากเจ้าของที่มีสิทธิ์ตรวจสอบการชำระเงิน"><p>การตั้งค่าบัญชี รายการแจ้งชำระ และการปรับปรุงบัญชีต้องดำเนินการโดยเจ้าของ</p></Panel>}</>}
    {property&&section==="maintenance"&&!isStaff&&<MaintenanceCenter key={property.id} propertyId={property.id} rooms={rooms} api={api} post={post} onRoomChanged={()=>loadProperty(property.id,isStaff)}/>}
    {property&&section==="invites"&&<OwnerInvitations key={property.id} propertyId={property.id} canApprove={orgRole==="OWNER"} api={api} post={post}/>}
    {section==="staff"&&orgRole==="OWNER"&&<StaffManagement key={orgId} orgId={orgId} properties={props} api={api} post={post}/>}
    {section==="profile"&&me&&<Panel title="โปรไฟล์ของฉัน" subtitle="ข้อมูลบัญชีที่ยืนยันผ่าน LINE"><div className="profile-summary"><div className="profile-avatar">{me.name.slice(0,1).toUpperCase()}</div><div><h2>{me.name}</h2><p>{me.role==="SUPER_ADMIN"?"ผู้ดูแลระบบ":hasTenantLease&&!me.memberships?.length?"ผู้เช่า":orgRole==="OWNER"?"เจ้าของหอพัก":orgRole==="STAFF"?"พนักงาน":"สมาชิก"}</p></div></div><div className="profile-actions"><button className="btn outline" onClick={()=>void logout()}>ออกจากระบบ</button></div></Panel>}
    {section==="tenant"&&<><StaffInviteClaim post={post}/><TenantPortal api={api} post={post}/></>}
    {property&&section==="settings"&&orgRole==="OWNER"&&<PropertyRateSettings key={property.id} propertyId={property.id} cadence={property.cadence} current={property} api={api} post={post} onSaved={()=>void loadProps(orgId)}/>}
    {property&&section==="settings"&&<Panel title="ข้อมูล Master ของหอพัก" subtitle="สำหรับการตั้งค่าที่มีผลต่อการสร้างบิลใหม่เท่านั้น"><div className="rate-row"><span>ชื่อหอพัก</span><b>{property.name}</b></div><div className="rate-row"><span>ที่อยู่</span><b>{property.address||"—"}</b></div><div className="rate-row"><span>รอบออกบิล</span><b>{property.cadence}</b></div><div className="rate-row"><span>ค่าเช่า Master</span><b>{money(property.rentSatang)}</b></div><div className="rate-row"><span>ค่าน้ำ Master</span><b>{money(property.waterSatangPerUnit)}/หน่วย</b></div><div className="rate-row"><span>ค่าไฟ Master</span><b>{money(property.electricSatangPerUnit)}/หน่วย</b></div><div className="hint">การแก้ไข Master หลังสร้างเริ่มต้น จะเปิดใช้งานเมื่อเพิ่ม Pricing History แบบมีวันมีผล เพื่อป้องกันบิลย้อนหลังเปลี่ยนแปลง</div></Panel>}
    {section==="admin"&&me.role==="SUPER_ADMIN"&&<><PrivacyCenter admin api={api} post={post}/><LineOperationsAdmin organizationId={orgId} api={api} post={post}/><div className="stats"><div className="stat"><span>เจ้าของทั้งหมด</span><strong>{admin?.organizationCount??"—"}</strong></div><div className="stat"><span>หอพักทั้งหมด</span><strong>{admin?.propertyCount??"—"}</strong></div><div className="stat"><span>ห้องทั้งหมด</span><strong>{admin?.roomCount??"—"}</strong></div><div className="stat"><span>ใบแจ้งหนี้</span><strong>{admin?.invoiceCount??"—"}</strong></div></div>
      {property&&<Panel title="ตรวจสอบข้อกำหนดค่าน้ำและค่าไฟ" subtitle="Super Admin เท่านั้น — ระบุหลักฐานอัตราที่กฎหมายและผู้ให้บริการอนุญาตก่อนเปิดออกบิล">{form(compliance,<><Field label="อ้างอิงหลักฐาน/เอกสารการตรวจสอบ"><input name="evidence" required minLength={8} placeholder="เอกสาร/URL/เลขอ้างอิง"/></Field><div className="cols2"><Field label="เพดานค่าน้ำ / หน่วย (บาท)"><input name="waterMax" required type="number" step=".01" min="0"/></Field><Field label="เพดานค่าไฟ / หน่วย (บาท)"><input name="electricMax" required type="number" step=".01" min="0"/></Field></div></>)}</Panel>}</>}
    </>}
   </main><footer className="footer">Apartment SaaS · Development Build · ข้อมูลทางการเงินต้องผ่านการตรวจสอบก่อนใช้งานจริง</footer>
  </div>
 </div>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
