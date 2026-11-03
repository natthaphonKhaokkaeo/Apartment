import React,{useCallback,useEffect,useState} from "react";

type Api=<T>(path:string,options?:RequestInit)=>Promise<T>;
type Post=<T>(path:string,body:unknown,headers?:HeadersInit)=>Promise<T>;
type PropertyRef={id:string;name:string};
type Member={id:string;userId:string;displayName:string;role:"OWNER"|"MANAGER"|"STAFF";
 status:"ACTIVE"|"DISABLED";grants:{propertyId:string;level:"VIEWER"|"METER_READER";status:"ACTIVE"|"DISABLED"}[]};
type Invitation={id:string;role:"OWNER"|"MANAGER"|"STAFF";propertyId:string|null;
 level:"VIEWER"|"METER_READER"|null;createdAt:string;expiresAt:string;claimedAt:string|null;
 claimedBy:string|null;claimantName:string|null;approvedAt:string|null;revokedAt:string|null};
const roleLabel=(role:string)=>role==="OWNER"?"เจ้าของ":role==="MANAGER"?"ผู้จัดการ":"พนักงาน";
const levelLabel=(level:string)=>level==="VIEWER"?"ดูห้องและเลขมิเตอร์":"ดูห้องและจดมิเตอร์";

export function StaffManagement({orgId,properties,api,post}:{
 orgId:string;properties:PropertyRef[];api:Api;post:Post
}){
 const [members,setMembers]=useState<Member[]>([]);
 const [invites,setInvites]=useState<Invitation[]>([]);
 const [role,setRole]=useState<"STAFF"|"MANAGER">("STAFF");
 const [level,setLevel]=useState<"VIEWER"|"METER_READER">("VIEWER");
 const [propertyId,setPropertyId]=useState("");
 const [newToken,setNewToken]=useState("");
 const [pending,setPending]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const base="/organizations/"+orgId+"/staff";
 const reload=useCallback(async()=>{
  const [m,i]=await Promise.all([api<Member[]>(base+"/members"),api<Invitation[]>(base+"/invitations")]);
  setMembers(m);setInvites(i);
 },[api,base]);
 useEffect(()=>{void reload().catch(e=>setError((e as Error).message));},[reload]);
 useEffect(()=>{
  if(properties.length&&!properties.some(p=>p.id===propertyId))setPropertyId(properties[0].id);
 },[properties,propertyId]);
 const propertyName=(id:string|null)=>properties.find(p=>p.id===id)?.name??(id?"ไม่พบหอพัก":"ทั้งองค์กร");
 const action=async(fn:()=>Promise<void>)=>{
  setPending(true);setError("");setNotice("");
  try{await fn();await reload();}catch(e){setError((e as Error).message);}finally{setPending(false);}
 };
 const submit=async(e:React.FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  await action(async()=>{
   if(role==="STAFF"&&!propertyId)throw new Error("กรุณาเลือกหอพัก");
   const result=await post<{token:string}>(base+"/invitations",{
    role,propertyId:role==="STAFF"?propertyId:null,level:role==="STAFF"?level:null
   });
   setNewToken(result.token);
   setNotice("สร้างคำเชิญแล้ว รหัสแสดงเพียงครั้งเดียว ผู้รับต้องยืนยันด้วยบัญชี LINE ก่อนเจ้าของอนุมัติ");
  });
 };
 const approve=(invite:Invitation)=>action(async()=>{
  if(!window.confirm("ยืนยันตัวตนผู้รับและอนุมัติสิทธิ์ "+roleLabel(invite.role)+"?"))return;
  await post(base+"/invitations/"+invite.id+"/approve",{});
  setNotice("อนุมัติสิทธิ์แล้ว");
 });
 const revokeInvite=(id:string)=>action(async()=>{
  if(!window.confirm("เพิกถอนคำเชิญนี้?"))return;
  await post(base+"/invitations/"+id+"/revoke",{});
  setNotice("เพิกถอนคำเชิญแล้ว");
 });
 const revokeMember=(member:Member,pid:string|null)=>action(async()=>{
  if(!window.confirm("ยืนยันเพิกถอนสิทธิ์ของ "+member.displayName+"?"))return;
  await post(base+"/members/"+member.userId+"/revoke",{propertyId:pid});
  setNotice("เพิกถอนสิทธิ์แล้ว คำขอ API ใหม่จะถูกปฏิเสธ");
 });
 const invitesPending=invites.filter(i=>!i.approvedAt&&!i.revokedAt);
 return <div className="staff-management">
  <section className="panel">
   <div className="panel-head"><div><h2>เชิญพนักงาน / ผู้จัดการ</h2>
    <p>เฉพาะเจ้าขององค์กร · ต้องให้ผู้รับ Claim รหัส และเจ้าของตรวจสอบก่อนอนุมัติ</p></div></div>
   {error&&<div className="notice danger" role="alert">{error}</div>}
   {notice&&<div className="notice success" role="status">{notice}</div>}
   <form className="form" onSubmit={e=>void submit(e)}>
    <div className="cols3">
     <label className="field"><span>บทบาท</span><select value={role} onChange={e=>{setRole(e.target.value as "STAFF"|"MANAGER");setNewToken("");}}>
      <option value="STAFF">พนักงานรายหอพัก</option><option value="MANAGER">ผู้จัดการทั้งองค์กร</option></select></label>
     {role==="STAFF"&&<>
      <label className="field"><span>หอพักที่อนุญาต</span><select required value={propertyId} onChange={e=>setPropertyId(e.target.value)}>
       {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="field"><span>สิทธิ์</span><select value={level} onChange={e=>setLevel(e.target.value as "VIEWER"|"METER_READER")}>
       <option value="VIEWER">ดูห้อง/มิเตอร์เท่านั้น</option>
       <option value="METER_READER">ดูห้องและจดมิเตอร์</option>
      </select></label>
     </>}
    </div>
    <p className="hint">พนักงานจะไม่เห็นข้อมูลการเงิน สัญญาเช่า หรือข้อมูลข้ามหอพัก ผู้จัดการมีสิทธิ์ปฏิบัติงานระดับองค์กร แต่ไม่สามารถจัดการสมาชิกแทนเจ้าของ</p>
    <button type="submit" className="btn primary" disabled={pending||(role==="STAFF"&&properties.length===0)}>สร้างคำเชิญ 24 ชั่วโมง</button>
   </form>
   {newToken&&<div className="notice">
    <div><b>รหัสเชิญ (แสดงครั้งเดียว)</b><p style={{overflowWrap:"anywhere"}}>{newToken}</p></div>
    <button type="button" className="btn outline" onClick={()=>void navigator.clipboard.writeText(newToken).then(()=>setNotice("คัดลอกรหัสเชิญแล้ว")).catch(()=>setError("คัดลอกไม่ได้ โปรดคัดลอกรหัสด้วยตนเอง"))}>คัดลอกรหัส</button>
    <button type="button" className="btn outline" onClick={()=>setNewToken("")}>ซ่อนรหัส</button>
   </div>}
  </section>
  <section className="panel"><div className="panel-head"><div><h2>คำเชิญที่รอดำเนินการ</h2>
   <p>ตรวจสอบผู้รับด้วยตนเองก่อนกดอนุมัติ · ไม่มีการส่งข้อความ LINE อัตโนมัติ</p></div>
   <button className="btn outline" disabled={pending} onClick={()=>void reload().catch(e=>setError((e as Error).message))}>รีเฟรช</button></div>
   {invitesPending.length===0?<p className="empty">ไม่มีคำเชิญค้างอยู่</p>:
    <div className="table-scroll"><table><thead><tr><th>บทบาท</th><th>ขอบเขต</th><th>ผู้รับ</th><th>หมดอายุ</th><th>การดำเนินการ</th></tr></thead><tbody>
     {invitesPending.map(i=><tr key={i.id}><td>{roleLabel(i.role)}</td>
      <td>{propertyName(i.propertyId)}{i.level?" · "+levelLabel(i.level):""}</td>
      <td>{i.claimedBy?(i.claimantName||"รับรหัสแล้ว"):"ยังไม่รับรหัส"}</td>
      <td>{new Date(i.expiresAt).toLocaleString("th-TH")}</td>
      <td><div className="actions">
       {i.claimedBy&&new Date(i.expiresAt).getTime()>Date.now()&&
        <button className="btn primary" disabled={pending} onClick={()=>void approve(i)}>ตรวจสอบแล้ว / อนุมัติ</button>}
       <button className="btn outline" disabled={pending} onClick={()=>void revokeInvite(i.id)}>เพิกถอน</button>
      </div></td>
     </tr>)}
    </tbody></table></div>}
  </section>
  <section className="panel"><div className="panel-head"><div><h2>สมาชิกและสิทธิ์ที่ใช้งาน</h2>
   <p>เพิกถอนรายหอพักได้ · เจ้าขององค์กรไม่สามารถถูกเพิกถอนผ่านหน้านี้</p></div></div>
   <div className="table-scroll"><table><thead><tr><th>ชื่อ</th><th>บทบาท</th><th>สถานะ</th><th>สิทธิ์รายหอพัก</th></tr></thead><tbody>
    {members.map(m=><tr key={m.id}><td>{m.displayName}</td><td>{roleLabel(m.role)}</td><td>{m.status}</td><td>
     {m.role==="MANAGER"&&m.status==="ACTIVE"&&
      <button className="btn outline" disabled={pending} onClick={()=>void revokeMember(m,null)}>เพิกถอนผู้จัดการ</button>}
     {m.role==="STAFF"&&m.grants.filter(g=>g.status==="ACTIVE").map(g=>
      <div key={g.propertyId} className="actions">
       <span>{propertyName(g.propertyId)} · {levelLabel(g.level)}</span>
       <button className="btn outline" disabled={pending} onClick={()=>void revokeMember(m,g.propertyId)}>เพิกถอน</button>
      </div>)}
     {m.role==="OWNER"&&<span>เจ้าขององค์กร</span>}
    </td></tr>)}
   </tbody></table></div>
  </section>
 </div>;
}

export function StaffInviteClaim({post}: {post:Post}){
 const [token,setToken]=useState(""),[pending,setPending]=useState(false);
 const [message,setMessage]=useState(""),[error,setError]=useState("");
 const claim=async(e:React.FormEvent<HTMLFormElement>)=>{
  e.preventDefault();setPending(true);setMessage("");setError("");
  try{
   await post("/staff/invitations/claim",{token:token.trim()});
   setToken("");setMessage("รับคำเชิญแล้ว รอเจ้าของตรวจสอบและอนุมัติสิทธิ์ จากนั้นเข้าสู่ระบบใหม่หรือรีเฟรชข้อมูล");
  }catch(e){setError((e as Error).message)}finally{setPending(false)}
 };
 return <section className="panel"><div className="panel-head"><div><h2>รับคำเชิญเป็นพนักงาน</h2>
  <p>บัญชี LINE ที่เข้าสู่ระบบจะถูกผูกกับคำเชิญหลังเจ้าของอนุมัติเท่านั้น</p></div></div>
  <form className="form" onSubmit={e=>void claim(e)}>
   <label className="field"><span>รหัสเชิญจากเจ้าของ</span><input value={token} onChange={e=>setToken(e.target.value)}
    required minLength={40} maxLength={128} autoComplete="off"/></label>
   <button className="btn primary" disabled={pending}>{pending?"กำลังตรวจสอบ":"รับคำเชิญ"}</button>
  </form>
  {message&&<p className="notice success" role="status">{message}</p>}
  {error&&<p className="notice danger" role="alert">{error}</p>}
 </section>;
}

type MeterReading={id:string;roomId:string;kind:string;readAt:string;value:string};
export function StaffMeterReadings({propertyId,rooms,api}:{
 propertyId:string;rooms:{id:string;number:string}[];api:Api
}){
 const [readings,setReadings]=useState<MeterReading[]>([]),[error,setError]=useState("");
 const refresh=useCallback(()=>api<MeterReading[]>("/properties/"+propertyId+"/readings")
  .then(setReadings).catch(e=>setError((e as Error).message)),[propertyId,api]);
 useEffect(()=>{void refresh();},[refresh]);
 return <section className="panel"><div className="panel-head"><div><h2>ประวัติเลขมิเตอร์</h2>
  <p>อ่านได้เฉพาะหอพักที่ได้รับสิทธิ์</p></div><button className="btn outline" onClick={()=>void refresh()}>รีเฟรช</button></div>
  {error&&<p className="notice danger" role="alert">{error}</p>}
  <div className="table-scroll"><table><thead><tr><th>ห้อง</th><th>ประเภท</th><th>วันที่</th><th>เลขอ่าน</th></tr></thead>
   <tbody>{readings.slice(0,100).map(r=><tr key={r.id}>
    <td>{rooms.find(room=>room.id===r.roomId)?.number??"ห้อง"}</td>
    <td>{r.kind==="WATER"?"น้ำ":"ไฟ"}</td><td>{r.readAt}</td><td>{r.value}</td>
   </tr>)}</tbody></table>{!readings.length&&<p className="empty">ยังไม่มีประวัติมิเตอร์</p>}</div>
 </section>;
}
