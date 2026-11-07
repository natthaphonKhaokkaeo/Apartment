import {readFile} from "node:fs/promises";
import {createCanvas,loadImage} from "@napi-rs/canvas";
import {describe,expect,it} from "vitest";
import {buildRichMenuDefinition,classifyRichMenuRole,linkRichMenuToUser,provisionLineRichMenus,resetLineRichMenuCache,chooseMembershipRole} from "../src/services/line-rich-menus.js";

describe("LINE rich menu definitions",()=>{
 const liffId="2012349429-8QCrSAAV";
 it("creates a public login template with six valid tappable areas",()=>{
  const menu=buildRichMenuDefinition("public",liffId);
  expect(menu.size).toEqual({width:2500,height:1686});
  expect(menu.areas).toHaveLength(6);
  expect(menu.areas[0].action).toMatchObject({type:"uri"});
  expect(menu.areas[0].action.uri).toContain("https://liff.line.me/"+liffId);
 });
 it("ships valid LINE-sized image assets for every menu role",async()=>{
  for(const role of ["public","owner","tenant","account","staff","superadmin"] as const){
   const image=await readFile(new URL(`../assets/line-rich-menus/${role}.png`,import.meta.url));
   expect(image.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
   expect(image.readUInt32BE(16)).toBe(2500);
   expect(image.readUInt32BE(20)).toBe(1686);
   expect(image.byteLength).toBeLessThanOrEqual(1_000_000);
   const canvas=createCanvas(1,1),ctx=canvas.getContext("2d");
   ctx.drawImage(await loadImage(image),0,0);
   const background=ctx.getImageData(0,0,1,1).data;
   expect(Array.from(background.slice(0,3))).toEqual([247,249,248]);
   const svg=await readFile(new URL(`../assets/line-rich-menus/${role}.svg`,import.meta.url),"utf8");
   expect(svg).toContain("ApartMe");
   const labels=buildRichMenuDefinition(role,liffId).areas.map(area=>area.action.label);
   for(const label of labels)expect(svg).toContain(`>${label}</text>`);
  }
 });
 it("provides separate owner and tenant templates with profile entry points",()=>{
  const owner=buildRichMenuDefinition("owner",liffId);
  const tenant=buildRichMenuDefinition("tenant",liffId);
  expect(owner.name).not.toBe(tenant.name);
  expect(owner.areas.map(a=>a.action.uri).join(" ")).toContain("section=profile");
  expect(tenant.areas.map(a=>a.action.uri).join(" ")).toContain("section=profile");
  expect(owner.areas.map(a=>a.action.uri)).not.toEqual(tenant.areas.map(a=>a.action.uri));
 });
 it("has distinct platform admin, owner, tenant, and staff destinations",()=>{
  const admin=buildRichMenuDefinition("superadmin",liffId);
  const owner=buildRichMenuDefinition("owner",liffId);
  const tenant=buildRichMenuDefinition("tenant",liffId);
  const staff=buildRichMenuDefinition("staff",liffId);
  for(const [role,menu] of [["superadmin",admin],["owner",owner],["tenant",tenant],["staff",staff]] as const){
   expect(menu.name).toContain("pastel-v3");
   expect(menu.name).toContain(role);
   expect(menu.areas.every(x=>x.action.uri.startsWith(`https://liff.line.me/${liffId}`))).toBe(true);
  }
  expect(admin.areas.some(x=>x.action.uri.includes("section=admin"))).toBe(true);
  expect(owner.areas.some(x=>x.action.uri.includes("section=billing"))).toBe(true);
  expect(owner.areas.some(x=>x.action.uri.includes("section=reports"))).toBe(true);
  expect(tenant.areas.every(x=>!x.action.uri.includes("section=admin"))).toBe(true);
  expect(tenant.areas.every(x=>!x.action.uri.includes("section=billing"))).toBe(true);
  expect(staff.areas.every(x=>!x.action.uri.includes("section=admin"))).toBe(true);
  expect(staff.areas.every(x=>!x.action.uri.includes("section=billing"))).toBe(true);
 });
 it("uses stable owner-first precedence across several organization memberships",()=>{
  expect(chooseMembershipRole(["STAFF","OWNER","MANAGER"])).toBe("OWNER");
  expect(chooseMembershipRole(["STAFF","MANAGER"])).toBe("MANAGER");
  expect(chooseMembershipRole(["STAFF"])).toBe("STAFF");
  expect(chooseMembershipRole([])).toBeUndefined();
 });
 it("selects role menus only from verified server-side roles",()=>{
  expect(classifyRichMenuRole("SUPER_ADMIN",undefined,false)).toBe("superadmin");
  expect(classifyRichMenuRole("USER","OWNER",false)).toBe("owner");
  expect(classifyRichMenuRole("USER","STAFF",false)).toBe("staff");
  expect(classifyRichMenuRole("USER",undefined,true)).toBe("tenant");
  expect(classifyRichMenuRole("USER",undefined,false)).toBe("account");
 });
});

describe("LINE rich menu provider operations",()=>{
 it("provisions six versioned templates idempotently and sets the public default",async()=>{
  const calls:{url:string;init?:RequestInit}[]=[];
  const existing:{richMenuId:string;name:string}[]=[];
  let defaultRichMenuId:string|undefined;
  const fetcher=async(input:RequestInfo|URL,init?:RequestInit)=>{
   const url=String(input);calls.push({url,init});
   if(url.endsWith("/richmenu/list"))return new Response(JSON.stringify({richmenus:existing}),{status:200});
   if(url.endsWith("/user/all/richmenu")&&init?.method!=="POST"){
    return defaultRichMenuId?new Response(JSON.stringify({richMenuId:defaultRichMenuId}),{status:200}):new Response("",{status:404});
   }
   if(url.endsWith("/richmenu")&&init?.method==="POST"){
    const payload=JSON.parse(String(init.body)) as {name:string};
    const richMenuId=`menu-${existing.length+1}`;existing.push({richMenuId,name:payload.name});
    return new Response(JSON.stringify({richMenuId}),{status:200});
   }
   if(url.includes("api-data.line.me"))return new Response("{}",{status:200});
   if(url.includes("/user/all/richmenu/")){defaultRichMenuId=url.split("/").at(-1);return new Response("{}",{status:200});}
   throw new Error("unexpected LINE API call");
  };
  const imageLoader=async()=>new Uint8Array([137,80,78,71]);
  const result=await provisionLineRichMenus({channelAccessToken:"test-token",liffId:"123456-abcdefgh",fetcher,imageLoader});
  expect(Object.keys(result)).toHaveLength(6);
  expect(calls.filter(x=>x.url.endsWith("/richmenu")&&x.init?.method==="POST")).toHaveLength(6);
  expect(calls.filter(x=>x.url.includes("api-data.line.me"))).toHaveLength(6);
  expect(defaultRichMenuId).toBe(result.public);
  expect(calls.some(x=>x.url.endsWith("/user/all/richmenu")&&x.init?.method!=="POST")).toBe(true);
  calls.length=0;
  const second=await provisionLineRichMenus({channelAccessToken:"test-token",liffId:"123456-abcdefgh",fetcher,imageLoader});
  expect(second).toEqual(result);
  expect(calls.filter(x=>x.url.endsWith("/richmenu")&&x.init?.method==="POST")).toHaveLength(0);
  expect(calls.filter(x=>x.url.includes("api-data.line.me")&&x.init?.method==="POST")).toHaveLength(0);
 });
 it("links the verified LINE user to their role menu without sending a message",async()=>{
  resetLineRichMenuCache();
  const calls:{url:string;init?:RequestInit}[]=[];
  const fetcher=async(input:RequestInfo|URL,init?:RequestInit)=>{
   const url=String(input);calls.push({url,init});
   if(url.endsWith("/richmenu/list"))return new Response(JSON.stringify({richmenus:[{richMenuId:"owner-id",name:"apartme-owner-pastel-v3"}]}),{status:200});
   return new Response("{}",{status:200});
  };
  await expect(linkRichMenuToUser({channelAccessToken:"test-token",lineUserId:"Uverified",role:"owner",fetcher})).resolves.toBe(true);
  const linkCall=calls.find(c=>c.url.includes("/user/Uverified/richmenu/"));
  expect(linkCall?.url).toContain("/v2/bot/user/Uverified/richmenu/owner-id");
  expect(linkCall?.init?.method).toBe("POST");
  expect(calls.some(c=>c.url.includes("/message/"))).toBe(false);
 });
});
