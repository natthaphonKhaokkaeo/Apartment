import {findUsageFlow} from "./line-help-flows.js";
export type HelpRole="PUBLIC"|"USER"|"TENANT"|"OWNER"|"MANAGER"|"STAFF"|"SUPER_ADMIN";
type HelpDocument={id:string;roles:readonly HelpRole[];keywords:readonly string[];answer:string};
const all:readonly HelpRole[]=["PUBLIC","USER","TENANT","OWNER","MANAGER","STAFF","SUPER_ADMIN"];
const admin:readonly HelpRole[]=["OWNER","MANAGER","STAFF","SUPER_ADMIN"];
const docs:HelpDocument[]=[
 {id:"login",roles:all,keywords:["login","ล็อกอิน","เข้าสู่ระบบ","line"],answer:"เปิด Apartment ผ่าน Rich Menu ของ LINE แล้วกดเข้าสู่ระบบ ระบบจะใช้บัญชี LINE ที่ยืนยันอยู่ในแอป LINE หากพบปัญหาให้ปิด LIFF แล้วเปิดจาก Rich Menu อีกครั้ง"},
 {id:"tenant-invoice",roles:["TENANT"],keywords:["invoice","บิล","ใบแจ้งหนี้","ชำระ","ค่าเช่า"],answer:"ผู้เช่าดูใบแจ้งหนี้และสถานะชำระได้จากเมนู ใบแจ้งหนี้ การส่งหลักฐานชำระยังไม่ถือว่าธนาคารยืนยัน ระบบจะเปลี่ยนสถานะเมื่อผู้มีสิทธิ์ตรวจสอบแล้ว"},
 {id:"tenant-maintenance",roles:["TENANT"],keywords:["ซ่อม","maintenance","แจ้งปัญหา","ห้องเสีย"],answer:"ผู้เช่าเปิดเมนู แจ้งซ่อม ระบุหัวข้อ รายละเอียด และแนบรูปได้ จากนั้นติดตามสถานะคำขอในหน้ารายการแจ้งซ่อม"},
 {id:"property-room",roles:admin,keywords:["ห้อง","room","เพิ่มห้อง","ราคา","ค่าเช่า","ค่าน้ำ","ค่าไฟ"],answer:"ผู้ดูแลเปิดเมนู ห้องพัก แล้วเพิ่มหมายเลขห้องและชั้นได้ ค่าเช่า ค่าน้ำ และค่าไฟเริ่มจากค่าเริ่มต้นของหอพัก หากห้องมีอัตราต่างกันให้เอาเครื่องหมายใช้ค่าเริ่มต้นออกแล้วกรอกราคาเฉพาะห้อง"},
 {id:"billing",roles:admin,keywords:["ออกบิล","billing","ใบแจ้งหนี้","มิเตอร์","น้ำไฟ"],answer:"ผู้ดูแลเปิดเมนู ออกบิล ตรวจรายการและยอดก่อนยืนยัน ระบบเก็บยอดเงินเป็นสตางค์และไม่แก้ไขใบแจ้งหนี้ที่ออกแล้ว"},
 {id:"staff-access",roles:["OWNER","MANAGER","SUPER_ADMIN"],keywords:["สิทธิ","พนักงาน","staff","เพิ่มผู้ดูแล","admin"],answer:"เจ้าของหรือผู้ดูแลที่มีสิทธิ์จัดการสมาชิกสามารถเชิญพนักงานและกำหนด role ได้ สิทธิสำคัญจะถูกตรวจซ้ำที่ API และบันทึก audit"},
 {id:"platform-admin",roles:["SUPER_ADMIN"],keywords:["super admin","ผู้ดูแลระบบสูงสุด","เพิ่ม admin","ถอดสิทธิ"],answer:"Super Admin จัดการบัญชีผู้ดูแลระบบได้จากเมนูจัดการระบบ บัญชีเป้าหมายต้องเคยยืนยันตัวตนผ่าน LINE และการเปลี่ยนสิทธิจะบังคับให้เข้าสู่ระบบใหม่"},
];
function tokens(s:string):string[]{return (s.toLocaleLowerCase().match(/[a-z0-9]+|[ก-๙]{2,}/g)||[]).filter(x=>x.length>1)}
export function retrieveRoleHelp(question:string,role:HelpRole){
 const q=tokens(question);if(!q.length)return [];
 return docs.filter(d=>role==="SUPER_ADMIN"||d.roles.includes(role)).map(d=>({id:d.id,answer:d.answer,score:d.keywords.reduce((n,k)=>n+(q.some(t=>k.toLocaleLowerCase().includes(t)||t.includes(k.toLocaleLowerCase()))?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3);
}
export function sanitizeHelpQuestion(question:string){
 return question.slice(0,1000)
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[ข้อมูลส่วนบุคคล]")
  .replace(/\+?\d[\d\s().-]{7,}\d/g,"[ข้อมูลส่วนบุคคล]")
  .replace(/U[0-9a-f]{32}/gi,"[ข้อมูลส่วนบุคคล]");
}
export async function answerRoleHelp(options:{question:string;role:HelpRole;apiKey?:string;provider?:"google"|"openrouter";model?:string;fetcher?:typeof fetch}){
 const wantsSteps=/(วิธี|ขั้นตอน|สอน|ทำยังไง|ยังไง|อย่างไร|คู่มือ|เริ่มต้น|how to|flow|แนะนำการใช้)/i.test(options.question);
 const flow=wantsSteps?findUsageFlow(options.question,options.role):null;
 if(flow)return {answer:flow.answer,sourceIds:[flow.id]};
 const matches=retrieveRoleHelp(options.question,options.role);
 if(!matches.length)return {answer:"ขออภัย ยังไม่พบคำตอบในคู่มือระบบ กรุณาติดต่อผู้ดูแลหอพักหรือบริษัท",sourceIds:[] as string[]};
 const context=matches.map(x=>x.answer).join("\\n");
 const safeQuestion=sanitizeHelpQuestion(options.question);
 if(!options.apiKey)return {answer:context,sourceIds:matches.map(x=>x.id)};
 const prompt=`ตอบเป็นภาษาไทยสั้น ๆ โดยอิงเฉพาะคู่มือใน CONTEXT ห้ามเดาสิทธิหรือข้อมูลบัญชี ถ้าไม่มีคำตอบให้บอกให้ติดต่อผู้ดูแล\\nROLE=${options.role}\\nCONTEXT:\\n${context}\\nQUESTION:\\n${safeQuestion}`;
 try{
  let response:Response;
  if(options.provider==="openrouter"){
   response=await (options.fetcher||fetch)("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json",Authorization:`Bearer ${options.apiKey}`,"HTTP-Referer":"https://apartme.makemarket.space","X-Title":"Apartment Help Bot"},body:JSON.stringify({model:options.model||"nvidia/nemotron-3.5-lightning:free",messages:[{role:"user",content:prompt}],temperature:0.1,max_tokens:1024,reasoning:{effort:"low",exclude:true}}),signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw new Error("AI_PROVIDER_ERROR");
   const data=await response.json() as {choices?:{message?:{content?:string|{text?:string}[]}}[]};
   const content=data.choices?.[0]?.message?.content;
   const answer=typeof content==="string"?content:Array.isArray(content)?content.map(part=>part.text||"").join(""):"";
   if(answer.trim())return {answer:answer.trim().slice(0,1200),sourceIds:matches.map(x=>x.id)};
  }else{
   response=await (options.fetcher||fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model||"gemini-3.8-flash")}:generateContent`,{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":options.apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.1,maxOutputTokens:240}}),signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw new Error("AI_PROVIDER_ERROR");
   const data=await response.json() as {candidates?:{content?:{parts?:{text?:string}[]}}[]};
   const answer=data.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("").trim();
   if(answer)return {answer:answer.slice(0,1200),sourceIds:matches.map(x=>x.id)};
  }
 }catch{/* Use retrieved official help text when the provider is unavailable. */}
 return {answer:context,sourceIds:matches.map(x=>x.id)};
}
