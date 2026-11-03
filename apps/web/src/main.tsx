import React,{useEffect,useState,useCallback} from "react";
import {createRoot} from "react-dom/client";
import liff from "@line/liff";
import {Building2,LayoutDashboard,DoorOpen,ReceiptText,Gauge,Settings,ShieldCheck,LogOut,Plus,ChevronDown,CheckCircle2,AlertTriangle,Wallet,Users,Menu} from "lucide-react";
import {OwnerInvitations} from "./components/OwnerInvitations.js";
import {TenantPortal} from "./components/TenantPortal.js";
import "./styles.css";
type Organization={id:string;name:string;status:string};
type Property={id:string;name:string;organizationId:string;address:string;rentSatang:number;waterSatangPerUnit:number;electricSatangPerUnit:number;cadence:string;rollingAnchor:string|null;complianceReviewedAt:string|null};
type Room={id:string;number:string;floor:number;status:string;rentOverrideSatang:number|null;waterOverrideSatang:number|null;electricOverrideSatang:number|null};
type Invoice={id:string;roomId:string;amountSatang:number;periodStart:string;periodEnd:string;dueDate:string;status:string;createdAt:string};
type Me={id:string;name:string;role:string};
type Section="overview"|"rooms"|"meter"|"billing"|"invites"|"tenant"|"settings"|"admin";
const sections:[Section,string,React.ReactNode][]=[
 ["overview","ภาพรวม",<LayoutDashboard size={19}/>],["rooms","ห้องพัก",<DoorOpen size={19}/>],
 ["meter","จดมิเตอร์",<Gauge size={19}/>],["billing","ออกบิล",<ReceiptText size={19}/>],
 ["invites","เชิญผู้เช่า",<Users size={19}/>],["tenant","สำหรับผู้เช่า",<DoorOpen size={19}/>],
 ["settings","ตั้งค่า",<Settings size={19}/>],["admin","Super Admin",<ShieldCheck size={19}/>]];
const money=(n:number|undefined|null)=>"฿"+((n??0)/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
const satang=(s:string)=>Math.round(Number(s)*100);
function dateNow(){return new Date(Date.now()+7*3600000).toISOString().slice(0,10);}
const labels:Record<string,string>={
 UNAUTHENTICATED:"กรุณาเข้าสู่ระบบ",COMPLIANCE_REVIEW_REQUIRED:"ต้องให้ Super Admin ตรวจอัตราน้ำไฟก่อนออกบิล",
 TARIFF_ABOVE_REVIEWED_LIMIT:"อัตราค่าน้ำหรือค่าไฟเกินวงเงินที่ตรวจสอบแล้ว",
 METER_BOUNDARY_READING_REQUIRED:"ต้องมีเลขมิเตอร์ทั้งวันเริ่มต้นและวันสิ้นสุดรอบบิล",
 FULL_PERIOD_ACTIVE_LEASE_REQUIRED:"ต้องมีสัญญาเช่าที่มีผลตลอดรอบบิล",
 INVALID_BILLING_PERIOD:"ช่วงวันที่ไม่ตรงกับรอบบิลของหอพัก",PERIOD_ALREADY_BILLED:"ออกบิลสำหรับรอบนี้แล้ว",
 ROOM_NOT_AVAILABLE:"ห้องนี้ไม่ว่าง",IDEMPOTENCY_KEY_REUSED:"รหัสคำขอถูกใช้กับบิลอื่นแล้ว",
 ORG_ACCESS_DENIED:"ไม่มีสิทธิ์เข้าถึงหอพักนี้", INVITATION_NOT_FOUND:"รหัสเชิญไม่ถูกต้อง หมดอายุ หรือถูกใช้แล้ว",
 INVITATION_NOT_APPROVABLE:"คำขอเชิญนี้ยังไม่พร้อมอนุมัติ", LEASE_ALREADY_LINKED:"สัญญานี้ผูกบัญชีแล้ว", LEASE_NOT_INVITABLE:"สัญญานี้ยังเชิญผู้เช่าไม่ได้"};
async function api<T>(path:string, options:RequestInit={}):Promise<T>{
 const response=await fetch("/v1"+path,{...options,credentials:"include",headers:{"content-type":"application/json",...options.headers}});
 let data:unknown;try{data=await response.json();}catch{data={error:"NETWORK_ERROR"};}
 if(!response.ok){const code=(data as {error?:string})?.error||"REQUEST_FAILED";throw new Error(labels[code]||code);}
 return data as T;
}
async function post<T>(url:string,body:unknown,headers?:HeadersInit){return api<T>(url,{method:"POST",body:JSON.stringify(body),headers});}
function IconButton({children,onClick,className=""}:{children:React.ReactNode;onClick:()=>void;className?:string}){return <button onClick={onClick} className={"btn "+className}>{children}</button>;}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}</label>;}
function Panel({title,subtitle,children,action}:{title:string;subtitle?:string;children:React.ReactNode;action?:React.ReactNode}){return <section className="panel"><div className="panel-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>{children}</section>;}
function App(){
 const [me,setMe]=useState<Me|null>(null),[orgs,setOrgs]=useState<Organization[]>([]),[props,setProps]=useState<Property[]>([]);
 const [orgId,setOrgId]=useState(""),[propertyId,setPropertyId]=useState(""),[section,setSection]=useState<Section>("overview");
 const [rooms,setRooms]=useState<Room[]>([]),[invoices,setInvoices]=useState<Invoice[]>([]);
 const [overview,setOverview]=useState<{rooms:number;occupied:number;available:number;totalBilledSatang:number;issuedInvoices:number}|null>(null);
 const [admin,setAdmin]=useState<{organizationCount:number;propertyCount:number;roomCount:number;invoiceCount:number}|null>(null);
 const [error,setError]=useState(""),[success,setSuccess]=useState(""),[busy,setBusy]=useState(false),[menu,setMenu]=useState(false);
 const [lineBusy,setLineBusy]=useState(false);
 const org=orgs.find(o=>o.id===orgId),property=props.find(p=>p.id===propertyId);
 const notify=(message:string)=>{setError("");setSuccess(message);};
 const loadMe=useCallback(async()=>{
  try{const result=await api<Me>("/me");setMe(result);return result;}catch{return null;}
 },[]);
 const loadOrgs=useCallback(async()=>{const items=await api<Organization[]>("/organizations");setOrgs(items);setOrgId(v=>items.some(o=>o.id===v)?v:(items[0]?.id||""));if(items.length===0)setSection("tenant");},[]);
 const loadProps=useCallback(async(org:string)=>{const data=await api<Property[]>("/organizations/"+org+"/properties");
  setProps(data);setPropertyId(prev=>data.some(p=>p.id===prev)?prev:(data[0]?.id||""));},[]);
 const loadProperty=useCallback(async(p:string)=>{
  const [rs,ins,ov]=await Promise.all([api<Room[]>("/properties/"+p+"/rooms"),api<Invoice[]>("/properties/"+p+"/invoices"),
    api<typeof overview>("/properties/"+p+"/overview")]);
  setRooms(rs);setInvoices(ins);setOverview(ov);
 },[]);
 useEffect(()=>{void loadMe().then(user=>{if(user)void loadOrgs();});},[loadMe,loadOrgs]);
 useEffect(()=>{if(orgId)void loadProps(orgId).catch(e=>setError(e.message));else {setProps([]);setPropertyId("");}},[orgId,loadProps]);
 useEffect(()=>{if(propertyId)void loadProperty(propertyId).catch(e=>setError(e.message));else {setRooms([]);setInvoices([]);setOverview(null);}},[propertyId,loadProperty]);
 useEffect(()=>{if(section==="admin"&&me?.role==="SUPER_ADMIN")void api<typeof admin>("/admin/overview").then(setAdmin).catch(e=>setError(e.message));},[section,me?.role]);
 async function run(task:()=>Promise<void>){setBusy(true);setError("");setSuccess("");try{await task();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function login(){
  setLineBusy(true);setError("");
  try{
   const id=import.meta.env.VITE_LIFF_ID as string|undefined;
   if(!id)throw new Error("ยังไม่ได้ตั้งค่า VITE_LIFF_ID บนเว็บ");
   await liff.init({liffId:id});
   if(!liff.isLoggedIn()){liff.login({redirectUri:window.location.href});return;}
   const token=liff.getIDToken();
   if(!token)throw new Error("LINE Login ต้องเปิด scope openid เพื่อรับ ID Token");
   await post("/auth/line/exchange",{idToken:token});
   const user=await loadMe();if(user)await loadOrgs();
  }catch(e){setError((e as Error).message);}finally{setLineBusy(false);}
 }
 async function createOrg(form:FormData){await run(async()=>{await post("/organizations",{name:String(form.get("name"))});await loadOrgs();notify("เพิ่มบัญชีเจ้าของหอพักเรียบร้อย");});}
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
  await api("/properties/"+property.id+"/rooms/"+id,{method:"PATCH",body:JSON.stringify(b)});
  await loadProperty(property.id);notify("บันทึกราคาห้องแล้ว");
 });}
 async function createLease(form:FormData){if(!property)return;await run(async()=>{
  await post("/properties/"+property.id+"/leases",{roomId:String(form.get("roomId")),
   tenantName:String(form.get("name")),startDate:String(form.get("start"))});
  await loadProperty(property.id);notify("บันทึกสัญญาเช่าแล้ว");
 });}
 async function reading(form:FormData){if(!property)return;await run(async()=>{
  await post("/properties/"+property.id+"/readings",{roomId:String(form.get("roomId")),kind:String(form.get("kind")),
   readAt:String(form.get("day")),value:String(form.get("value"))});
  notify("บันทึกเลขมิเตอร์เรียบร้อย");
 });}
 async function preview(form:FormData,issue:boolean){if(!property)return;await run(async()=>{
  const payload={roomId:String(form.get("roomId")),start:String(form.get("start")),endExclusive:String(form.get("end"))};
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
   <nav aria-label="เมนูหลัก">{sections.filter(s=>s[0]!=="admin"||me.role==="SUPER_ADMIN").map(([id,label,icon])=><button key={id} onClick={()=>{setSection(id);setMenu(false);setError("");setSuccess("");}} className={"nav-item "+(section===id?"selected":"")}>{icon}<span>{label}</span></button>)}</nav>
   <div className="aside-bottom"><div className="avatar">{me.name.slice(0,1).toUpperCase()}</div><div><b>{me.name}</b><small>{me.role==="SUPER_ADMIN"?"Super Admin":"เจ้าของ/ผู้จัดการ"}</small></div><button onClick={()=>void logout()} aria-label="ออกจากระบบ" className="logout"><LogOut size={18}/></button></div>
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
    {orgId&&props.length===0&&section!=="tenant"&&<Panel title="เพิ่มหอพักแห่งแรก" subtitle="ตั้งราคา Master ที่ทุกห้องจะได้รับโดยอัตโนมัติ">{form(createProperty,<><Field label="ชื่อหอพัก"><input name="name" required placeholder="บ้านสุขใจ"/></Field><Field label="ที่อยู่"><input name="address" placeholder="ที่อยู่หอพัก"/></Field>
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
      <div className="two-col"><Panel title="ค่าบริการเริ่มต้น" subtitle="ห้องพักสามารถกำหนดราคาเฉพาะของตัวเอง"><div className="rate-row"><span>ค่าเช่ารายเดือน</span><b>{money(property.rentSatang)}</b></div><div className="rate-row"><span>ค่าน้ำ / หน่วย</span><b>{money(property.waterSatangPerUnit)}</b></div><div className="rate-row"><span>ค่าไฟ / หน่วย</span><b>{money(property.electricSatangPerUnit)}</b></div></Panel>
      <Panel title="สถานะออกบิล" subtitle="ความพร้อมก่อนส่งใบแจ้งหนี้"><div className="rate-row"><span>รอบบิล</span><b>{property.cadence}</b></div><div className="rate-row"><span>การยืนยันอัตราค่าน้ำไฟ</span><span className={"pill "+(property.complianceReviewedAt?"vacant":"occupied")}>{property.complianceReviewedAt?"ตรวจแล้ว":"รออนุมัติ"}</span></div><div className="rate-row"><span>ใบแจ้งหนี้ที่ออก</span><b>{overview?.issuedInvoices??0} ใบ</b></div></Panel></div>
    </>}
    {property&&section==="rooms"&&<><Panel title="เพิ่มห้องพักใหม่" subtitle="ห้องใหม่จะใช้ราคา Master จนกว่าจะกำหนดราคาเฉพาะห้อง">{form(createRoom,<div className="cols2"><Field label="หมายเลขห้อง"><input name="number" required placeholder="A101"/></Field><Field label="ชั้น"><input name="floor" type="number" min="0" defaultValue="1" required/></Field></div>)}</Panel>
      <Panel title="รายการห้องพัก" subtitle="เลือกแก้ไขราคา: เว้นว่างเพื่อกลับไปใช้ราคา Master"><div className="room-list">{rooms.map(r=><details className="room-detail" key={r.id}><summary><span className="room-number"><DoorOpen size={20}/>{r.number} <small>ชั้น {r.floor}</small></span><span className={"pill "+(r.status==="OCCUPIED"?"occupied":"vacant")}>{r.status==="OCCUPIED"?"มีผู้เช่า":r.status==="AVAILABLE"?"ว่าง":"ซ่อมบำรุง"}</span><ChevronDown size={17}/></summary>
      {form(overrideRoom,<><input name="roomId" type="hidden" value={r.id}/><div className="cols3"><Field label="ค่าเช่า (บาท)"><input name="rent" type="number" min="0" step=".01" placeholder={String(property.rentSatang/100)} defaultValue={r.rentOverrideSatang===null?"":String(r.rentOverrideSatang/100)}/></Field><Field label="ค่าน้ำ (บาท)"><input name="water" type="number" min="0" step=".01" placeholder={String(property.waterSatangPerUnit/100)} defaultValue={r.waterOverrideSatang===null?"":String(r.waterOverrideSatang/100)}/></Field><Field label="ค่าไฟ (บาท)"><input name="electric" type="number" min="0" step=".01" placeholder={String(property.electricSatangPerUnit/100)} defaultValue={r.electricOverrideSatang===null?"":String(r.electricOverrideSatang/100)}/></Field></div></>)}</details>)}</div></Panel>
      <Panel title="เปิดสัญญาเช่าห้อง" subtitle="เริ่มต้นผูกผู้เช่าเข้ากับห้องว่างก่อนจดมิเตอร์และออกบิล">{form(createLease,<div className="cols3"><Field label="ห้องว่าง"><select name="roomId" required>{rooms.filter(r=>r.status==="AVAILABLE").map(r=><option key={r.id} value={r.id}>{r.number}</option>)}</select></Field><Field label="ชื่อผู้เช่า"><input name="name" placeholder="ชื่อ-นามสกุล" required/></Field><Field label="วันเริ่มสัญญา"><input name="start" type="date" required defaultValue={dateNow()}/></Field></div>)}</Panel></>}
    {property&&section==="meter"&&<><Panel title="จดเลขมิเตอร์" subtitle="กรอกเลขมิเตอร์น้ำและไฟ พร้อมวันที่อ่านจริง เลขต้องไม่ลดลง">{form(reading,<div className="cols2"><Field label="ห้องพัก"><select name="roomId">{rooms.map(r=><option key={r.id} value={r.id}>{r.number}</option>)}</select></Field><Field label="ประเภท"><select name="kind"><option value="WATER">ค่าน้ำ</option><option value="ELECTRIC">ค่าไฟ</option></select></Field><Field label="วันที่อ่าน"><input type="date" name="day" required defaultValue={dateNow()}/></Field><Field label="เลขมิเตอร์"><input name="value" required inputMode="decimal" placeholder="1234.000"/></Field></div>)}</Panel><div className="hint"><Gauge size={19}/> จำเป็นต้องมีค่ามิเตอร์ที่วันเริ่มและวันสิ้นสุดของรอบบิลก่อนออกบิล</div></>}
    {property&&section==="billing"&&<><Panel title="ออกใบแจ้งหนี้รายห้อง" subtitle="ทดลองคำนวณก่อน แล้วจึงกดออกบิลจริงภายหลังตรวจความถูกต้อง"><form className="form" onSubmit={e=>{e.preventDefault();void preview(new FormData(e.currentTarget),false);}}><div className="cols3"><Field label="ห้องพัก"><select name="roomId">{rooms.filter(r=>r.status==="OCCUPIED").map(r=><option key={r.id} value={r.id}>{r.number}</option>)}</select></Field><Field label="วันเริ่มรอบ"><input name="start" required type="date"/></Field><Field label="วันสิ้นสุด (ไม่รวมวันนี้)"><input name="end" required type="date"/></Field></div><div className="actions"><button className="btn outline" disabled={busy} type="submit">คำนวณยอดก่อนออกบิล</button><button className="btn primary" disabled={busy} type="button" onClick={e=>{const f=e.currentTarget.closest("form");if(f&&window.confirm("ยืนยันออกบิลจริงสำหรับห้องและรอบวันที่เลือก?"))void preview(new FormData(f),true);}}>ยืนยันออกบิล</button></div></form></Panel>
      <Panel title="ใบแจ้งหนี้ที่ออกแล้ว" subtitle="จำนวนเงินเป็นยอดตั้งหนี้ — ระบบบันทึกรับชำระยังอยู่ในแผนพัฒนา"><div className="table-scroll"><table><thead><tr><th>หมายเลขห้อง</th><th>รอบบิล</th><th>ครบกำหนด</th><th>ยอดเงิน</th><th>สถานะ</th></tr></thead><tbody>{invoices.map(i=><tr key={i.id}><td><b>{rooms.find(r=>r.id===i.roomId)?.number??"-"}</b></td><td>{i.periodStart} → {i.periodEnd}</td><td>{i.dueDate}</td><td>{money(i.amountSatang)}</td><td><span className="pill occupied">{i.status}</span></td></tr>)}</tbody></table>{invoices.length===0&&<p className="empty">ยังไม่มีบิล</p>}</div></Panel></>}
    {property&&section==="invites"&&<OwnerInvitations key={property.id} propertyId={property.id} api={api} post={post}/>}
    {section==="tenant"&&<TenantPortal api={api} post={post}/>}
    {property&&section==="settings"&&<Panel title="ข้อมูล Master ของหอพัก" subtitle="สำหรับการตั้งค่าที่มีผลต่อการสร้างบิลใหม่เท่านั้น"><div className="rate-row"><span>ชื่อหอพัก</span><b>{property.name}</b></div><div className="rate-row"><span>ที่อยู่</span><b>{property.address||"—"}</b></div><div className="rate-row"><span>รอบออกบิล</span><b>{property.cadence}</b></div><div className="rate-row"><span>ค่าเช่า Master</span><b>{money(property.rentSatang)}</b></div><div className="rate-row"><span>ค่าน้ำ Master</span><b>{money(property.waterSatangPerUnit)}/หน่วย</b></div><div className="rate-row"><span>ค่าไฟ Master</span><b>{money(property.electricSatangPerUnit)}/หน่วย</b></div><div className="hint">การแก้ไข Master หลังสร้างเริ่มต้น จะเปิดใช้งานเมื่อเพิ่ม Pricing History แบบมีวันมีผล เพื่อป้องกันบิลย้อนหลังเปลี่ยนแปลง</div></Panel>}
    {section==="admin"&&me.role==="SUPER_ADMIN"&&<><div className="stats"><div className="stat"><span>เจ้าของทั้งหมด</span><strong>{admin?.organizationCount??"—"}</strong></div><div className="stat"><span>หอพักทั้งหมด</span><strong>{admin?.propertyCount??"—"}</strong></div><div className="stat"><span>ห้องทั้งหมด</span><strong>{admin?.roomCount??"—"}</strong></div><div className="stat"><span>ใบแจ้งหนี้</span><strong>{admin?.invoiceCount??"—"}</strong></div></div>
      {property&&<Panel title="ตรวจสอบข้อกำหนดค่าน้ำและค่าไฟ" subtitle="Super Admin เท่านั้น — ระบุหลักฐานอัตราที่กฎหมายและผู้ให้บริการอนุญาตก่อนเปิดออกบิล">{form(compliance,<><Field label="อ้างอิงหลักฐาน/เอกสารการตรวจสอบ"><input name="evidence" required minLength={8} placeholder="เอกสาร/URL/เลขอ้างอิง"/></Field><div className="cols2"><Field label="เพดานค่าน้ำ / หน่วย (บาท)"><input name="waterMax" required type="number" step=".01" min="0"/></Field><Field label="เพดานค่าไฟ / หน่วย (บาท)"><input name="electricMax" required type="number" step=".01" min="0"/></Field></div></>)}</Panel>}</>}
    </>}
   </main><footer className="footer">Apartment SaaS · Development Build · ข้อมูลทางการเงินต้องผ่านการตรวจสอบก่อนใช้งานจริง</footer>
  </div>
 </div>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
