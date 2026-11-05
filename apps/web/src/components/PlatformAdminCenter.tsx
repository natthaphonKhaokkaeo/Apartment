import {useCallback,useEffect,useState} from "react";
import {Search,ShieldCheck,ShieldOff,RefreshCcw} from "lucide-react";

type Account={id:string;displayName:string;platformRole:string;status:string;createdAt:string};
type Props={api:<T>(path:string,options?:RequestInit)=>Promise<T>};
const roleName=(role:string)=>role==="SUPER_ADMIN"?"Super Admin":"ผู้ใช้";
export function PlatformAdminCenter({api}:Props){
 const [search,setSearch]=useState(""),[submitted,setSubmitted]=useState("");
 const [accounts,setAccounts]=useState<Account[]>([]),[loading,setLoading]=useState(false);
 const [working,setWorking]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const reload=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const query=submitted?`?search=${encodeURIComponent(submitted)}`:"";
   setAccounts(await api<Account[]>(`/admin/platform-users${query}`));
  }catch(e){setError(e instanceof Error?e.message:"ไม่สามารถโหลดบัญชีได้");}
  finally{setLoading(false);}
 },[api,submitted]);
 useEffect(()=>{void reload();},[reload]);
 async function change(account:Account){
  const nextRole=account.platformRole==="SUPER_ADMIN"?"USER":"SUPER_ADMIN";
  const action=nextRole==="SUPER_ADMIN"?"เพิ่มสิทธิ Super Admin ให้":"ถอดสิทธิ Super Admin จาก";
  if(!window.confirm(`${action} ${account.displayName} หรือไม่? ผู้ใช้จะต้องเข้าสู่ระบบ LINE ใหม่`))return;
  setWorking(account.id);setError("");setNotice("");
  try{
   await api(`/admin/platform-users/${account.id}/role`,{method:"PATCH",body:JSON.stringify({role:nextRole})});
   setNotice(nextRole==="SUPER_ADMIN"?"เพิ่มสิทธิ Super Admin แล้ว":"ถอดสิทธิ Super Admin แล้ว");
   await reload();
  }catch(e){setError(e instanceof Error?e.message:"เปลี่ยนสิทธิไม่สำเร็จ");}
  finally{setWorking("");}
 }
 return <section className="panel platform-admin-center" aria-labelledby="platform-admin-title">
  <div className="panel-head"><div><h2 id="platform-admin-title">จัดการ Super Admin</h2>
   <p>เพิ่มหรือถอดสิทธิผู้ดูแลระบบสูงสุดจากบัญชี LINE ที่ยืนยันแล้ว</p></div>
   <button className="btn outline" type="button" onClick={()=>void reload()} disabled={loading} aria-label="โหลดรายชื่อใหม่"><RefreshCcw size={16}/> โหลดใหม่</button>
  </div>
  <p className="hint">บัญชีที่เพิ่มสิทธิจะถูกออกจากระบบทุกอุปกรณ์และต้องล็อกอิน LINE ใหม่ สิทธิของ bootstrap admin และ admin คนสุดท้ายจะถอดไม่ได้</p>
  <form className="platform-admin-search" onSubmit={e=>{e.preventDefault();setSubmitted(search.trim());}}>
   <label className="field"><span>ค้นหาจากชื่อบัญชี</span><input value={search} onChange={e=>setSearch(e.target.value)} maxLength={80} placeholder="พิมพ์ชื่อ LINE ที่เคยล็อกอินแล้ว"/></label>
   <button className="btn primary" type="submit"><Search size={16}/> ค้นหา</button>
  </form>
  {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="success" role="status">{notice}</p>}
  {loading?<p role="status">กำลังโหลดบัญชี…</p>:accounts.length===0?<p className="empty">ไม่พบบัญชีที่ค้นหา บัญชีต้องยืนยันตัวตนผ่าน LINE อย่างน้อยหนึ่งครั้ง</p>:
   <div className="platform-account-list">{accounts.map(account=><article className="platform-account" key={account.id}>
    <div className="platform-account-info"><div className="avatar">{account.displayName.slice(0,1).toUpperCase()}</div>
     <div><strong>{account.displayName}</strong><small>Account ID: {account.id}</small><span className="badge">{roleName(account.platformRole)} · {account.status==="ACTIVE"?"ใช้งาน":account.status}</span></div>
    </div>
    <button className={account.platformRole==="SUPER_ADMIN"?"btn outline":"btn primary"} type="button"
     disabled={working!==""||account.status!=="ACTIVE"} onClick={()=>void change(account)}>
     {working===account.id?"กำลังบันทึก…":account.platformRole==="SUPER_ADMIN"?<><ShieldOff size={16}/> ถอดสิทธิ</>:<><ShieldCheck size={16}/> เพิ่ม Super Admin</>}
    </button>
   </article>)}</div>}
  <small className="platform-admin-count">แสดงไม่เกิน 50 บัญชีต่อครั้ง</small>
 </section>;
}
