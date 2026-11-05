import {readFile} from "node:fs/promises";

export type RichMenuRole="public"|"owner"|"tenant"|"account"|"superadmin";
export type RichMenuArea={bounds:{x:number;y:number;width:number;height:number};action:{type:"uri";uri:string;label:string}};
export type RichMenuDefinition={size:{width:2500;height:1686};selected:boolean;name:string;chatBarText:string;areas:RichMenuArea[]};
const names:Record<RichMenuRole,string>={
 public:"apartment-public-v1",owner:"apartment-owner-v1",tenant:"apartment-tenant-v1",account:"apartment-account-v1",superadmin:"apartment-superadmin-v1"
};
const sectionActions:Record<RichMenuRole,[string,string,string][]>={
 public:[["เข้าสู่ระบบ","overview",""],["บริการ","overview",""],["วิธีใช้งาน","overview",""],["จัดการหอพัก","overview",""],["ติดต่อเรา","profile",""],["เกี่ยวกับเรา","overview",""]],
 owner:[["ภาพรวม","overview",""],["ห้องพัก","rooms",""],["ออกบิล","billing",""],["ผู้เช่า","tenant",""],["งานซ่อม","maintenance",""],["โปรไฟล์","profile",""]],
 tenant:[["หน้าหลัก","tenant","tenant-home"],["ใบแจ้งหนี้","tenant","tenant-invoices"],["การชำระเงิน","tenant","tenant-invoices"],["แจ้งซ่อม","tenant","tenant-maintenance"],["ประวัติบิล","tenant","tenant-history"],["โปรไฟล์","profile",""]],
 account:[["โปรไฟล์","profile",""],["หน้าหลัก","overview",""],["เชิญเข้าพัก","tenant","tenant-home"],["แจ้งซ่อม","tenant","tenant-maintenance"],["คู่มือ","overview",""],["ติดต่อเรา","profile",""]],
 superadmin:[["จัดการระบบ","admin",""],["ภาพรวม","overview",""],["หอพัก","rooms",""],["ออกบิล","billing",""],["งานซ่อม","maintenance",""],["โปรไฟล์","profile",""]]
};
const areaBounds=(index:number)=>({x:64+(index%3)*812,y:354+Math.floor(index/3)*650,width:748,height:596});
const menuUrl=(liffId:string,section:string,anchor:string)=>{
 const url=new URL(`https://liff.line.me/${liffId}`);
 url.searchParams.set("section",section);
 if(anchor)url.hash=anchor;
 return url.toString();
};
export function buildRichMenuDefinition(role:RichMenuRole,liffId:string):RichMenuDefinition{
 return {size:{width:2500,height:1686},selected:true,name:names[role],chatBarText:"เมนูหลัก",
  areas:sectionActions[role].map(([label,section,anchor],i)=>({bounds:areaBounds(i),action:{type:"uri",uri:menuUrl(liffId,section,anchor),label}}))};
}
export function classifyRichMenuRole(platformRole:string|undefined,membershipRole:string|undefined,hasActiveTenantLease:boolean):RichMenuRole{
 if(platformRole==="SUPER_ADMIN")return "superadmin";
 if(membershipRole==="OWNER"||membershipRole==="MANAGER"||membershipRole==="STAFF")return "owner";
 return hasActiveTenantLease?"tenant":"account";
}
type ProviderMenu={richMenuId:string;name?:string};
type ProviderMenuList={richmenus?:ProviderMenu[]};
type Fetcher=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;
let cachedMenus:{expiresAt:number;ids:Partial<Record<RichMenuRole,string>>}|undefined;
export function resetLineRichMenuCache():void{cachedMenus=undefined;}
function requireToken(token:string|undefined):string{
 if(!token)throw new Error("LINE_RICH_MENU_ACCESS_TOKEN_MISSING");
 return token;
}
async function request(token:string,url:string,init:RequestInit={},fetcher:Fetcher=fetch):Promise<Response>{
 return fetcher(url,{...init,headers:{Authorization:`Bearer ${token}`,...init.headers},signal:init.signal??AbortSignal.timeout(8000)});
}
async function providerJson<T>(response:Response):Promise<T>{
 if(!response.ok)throw new Error(`LINE_RICH_MENU_PROVIDER_HTTP_${response.status}`);
 return await response.json() as T;
}
async function listMenus(token:string,fetcher:Fetcher=fetch):Promise<ProviderMenuList>{
 const response=await request(token,"https://api.line.me/v2/bot/richmenu/list",{},fetcher);
 return providerJson<ProviderMenuList>(response);
}
function menuIds(menuList:ProviderMenuList):Partial<Record<RichMenuRole,string>>{
 const ids:Partial<Record<RichMenuRole,string>>={};
 for(const role of Object.keys(names) as RichMenuRole[]){
  const menu=menuList.richmenus?.find(item=>item.name===names[role]);
  if(menu)ids[role]=menu.richMenuId;
 }
 return ids;
}
export async function provisionLineRichMenus(options:{channelAccessToken:string|undefined;liffId:string|undefined;fetcher?:Fetcher;imageLoader?:(role:RichMenuRole)=>Promise<Uint8Array>}):Promise<Record<RichMenuRole,string>>{
 const token=requireToken(options.channelAccessToken),liffId=options.liffId?.trim();
 if(!liffId)throw new Error("LINE_RICH_MENU_LIFF_ID_MISSING");
 const fetcher=options.fetcher??fetch;
 const imageLoader=options.imageLoader??(role=>readFile(new URL(`../../assets/line-rich-menus/${role}.png`,import.meta.url)));
 const menuList=await listMenus(token,fetcher),ids=menuIds(menuList);
 for(const role of Object.keys(names) as RichMenuRole[]){
  if(ids[role])continue;
  const created=await providerJson<{richMenuId:string}>(await request(token,"https://api.line.me/v2/bot/richmenu",{
   method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(buildRichMenuDefinition(role,liffId))
  },fetcher));
  ids[role]=created.richMenuId;
  try{
   const image=await imageLoader(role);
   const uploaded=await request(token,`https://api-data.line.me/v2/bot/richmenu/${encodeURIComponent(created.richMenuId)}/content`,{
    method:"POST",headers:{"Content-Type":"image/png"},body:Buffer.from(image)
   },fetcher);
   if(!uploaded.ok)throw new Error(`LINE_RICH_MENU_IMAGE_HTTP_${uploaded.status}`);
  }catch(error){
   await request(token,`https://api.line.me/v2/bot/richmenu/${encodeURIComponent(created.richMenuId)}`,{method:"DELETE"},fetcher).catch(()=>undefined);
   throw error;
  }
 }
 const publicId=ids.public;
 if(!publicId)throw new Error("LINE_RICH_MENU_PUBLIC_ID_MISSING");
 const currentDefaultResponse=await request(token,"https://api.line.me/v2/bot/user/all/richmenu",{},fetcher);
 const currentDefaultId=currentDefaultResponse.status===404?undefined:
  (await providerJson<{richMenuId?:string}>(currentDefaultResponse)).richMenuId;
 if(currentDefaultId!==publicId){
  const response=await request(token,`https://api.line.me/v2/bot/user/all/richmenu/${encodeURIComponent(publicId)}`,{method:"POST"},fetcher);
  if(!response.ok)throw new Error(`LINE_RICH_MENU_DEFAULT_HTTP_${response.status}`);
 }
 cachedMenus={expiresAt:Date.now()+30_000,ids};
 return ids as Record<RichMenuRole,string>;
}
async function resolveMenuIds(token:string,fetcher:Fetcher):Promise<Partial<Record<RichMenuRole,string>>>{
 if(cachedMenus&&cachedMenus.expiresAt>Date.now())return cachedMenus.ids;
 const ids=menuIds(await listMenus(token,fetcher));
 cachedMenus={expiresAt:Date.now()+30_000,ids};
 return ids;
}
export async function linkRichMenuToUser(options:{channelAccessToken:string|undefined;lineUserId:string;role:RichMenuRole;fetcher?:Fetcher}):Promise<boolean>{
 const token=requireToken(options.channelAccessToken),fetcher=options.fetcher??fetch;
 const richMenuId=(await resolveMenuIds(token,fetcher))[options.role];
 if(!richMenuId)return false;
 const response=await request(token,`https://api.line.me/v2/bot/user/${encodeURIComponent(options.lineUserId)}/richmenu/${encodeURIComponent(richMenuId)}`,{method:"POST"},fetcher);
 if(!response.ok)throw new Error(`LINE_RICH_MENU_LINK_HTTP_${response.status}`);
 return true;
}
export async function unlinkRichMenuFromUser(options:{channelAccessToken:string|undefined;lineUserId:string;fetcher?:Fetcher}):Promise<boolean>{
 const token=requireToken(options.channelAccessToken),fetcher=options.fetcher??fetch;
 const response=await request(token,`https://api.line.me/v2/bot/user/${encodeURIComponent(options.lineUserId)}/richmenu`,{method:"DELETE"},fetcher);
 if(response.status===404)return false;
 if(!response.ok)throw new Error(`LINE_RICH_MENU_UNLINK_HTTP_${response.status}`);
 return true;
}
