import {readFileSync} from "node:fs";
import type {HelpRole} from "./line-help-rag.js";

/** Only curated, explicitly approved end-user documents are loaded; never traverse repo/docs or .env. */
const knowledge=[
 {id:"guide-general",file:"general.md",roles:["PUBLIC","USER","TENANT","OWNER","MANAGER","STAFF","SUPER_ADMIN"]},
 {id:"guide-tenant",file:"tenant.md",roles:["TENANT","SUPER_ADMIN"]},
 {id:"guide-owner",file:"owner.md",roles:["OWNER","SUPER_ADMIN"]},
 {id:"guide-staff",file:"staff.md",roles:["STAFF","MANAGER","OWNER","SUPER_ADMIN"]},
 {id:"guide-line",file:"line-operations.md",roles:["OWNER","MANAGER","SUPER_ADMIN"]},
 {id:"guide-platform",file:"platform.md",roles:["SUPER_ADMIN"]}
] as const;
export function roleKnowledge(role:HelpRole){
 return knowledge.filter(k=>(k.roles as readonly string[]).includes(role)).map(k=>{
  try{
   const text=readFileSync(new URL(`../../../../docs/help-knowledge/${k.file}`,import.meta.url),"utf8").slice(0,8500);
   return {id:k.id,text};
  }catch{return null;}
 }).filter(value=>value!==null);
}
