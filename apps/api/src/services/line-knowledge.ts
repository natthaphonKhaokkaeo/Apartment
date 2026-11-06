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

/** Small offline relevance search for provider outages; uses only approved role-scoped guides. */
export function retrieveRoleKnowledge(question:string,role:HelpRole,limit=2){
 const normalize=(s:string)=>s.toLocaleLowerCase().replace(/[^a-z0-9ก-๙]+/g,"");
 const trigrams=(s:string)=>{const chars=Array.from(normalize(s));const result=new Set<string>();
  for(let i=0;i<chars.length-2;i++)result.add(chars.slice(i,i+3).join(""));return result;};
 const grams=trigrams(question);
 if(!grams.size)return [];
 return roleKnowledge(role).flatMap(doc=>doc.text.split(/\n+/).filter(x=>x.length>30).map(paragraph=>{
  const candidate=trigrams(paragraph);
  const overlap=[...grams].filter(x=>candidate.has(x)).length;
  const heading=trigrams(paragraph.split(":",1)[0].slice(0,48));
  const headingMatches=[...grams].filter(x=>heading.has(x)).length;
  const score=overlap/Math.sqrt(Math.max(candidate.size,1))+
   1.2*headingMatches/Math.sqrt(Math.max(heading.size,1));
  return {id:doc.id,answer:paragraph,score};
 })).filter(x=>x.score>0.08).sort((a,b)=>b.score-a.score).slice(0,limit);
}
