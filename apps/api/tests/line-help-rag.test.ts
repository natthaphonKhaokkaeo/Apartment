import {describe,expect,it,vi} from "vitest";
import {answerRoleHelp,retrieveRoleHelp} from "../src/services/line-help-rag.js";

describe("role-scoped LINE help retrieval",()=>{
 it("returns tenant help without exposing staff permission material",()=>{
  const result=retrieveRoleHelp("ดูใบแจ้งหนี้และชำระเงิน", "TENANT");
  expect(result.map(x=>x.id)).toContain("tenant-invoice");
  expect(result.map(x=>x.id)).not.toContain("staff-access");
  expect(result.map(x=>x.id)).not.toContain("platform-admin");
 });
 it("limits staff permission help to allowed roles",()=>{
  expect(retrieveRoleHelp("เพิ่มผู้ดูแลและจัดการสิทธิ","STAFF").map(x=>x.id)).not.toContain("staff-access");
  expect(retrieveRoleHelp("เพิ่มผู้ดูแลและจัดการสิทธิ","OWNER").map(x=>x.id)).toContain("staff-access");
 });
 it("returns a safe fallback when no role-visible article matches",async()=>{
  const answer=await answerRoleHelp({question:"ข้อมูลบัญชีธนาคารของผู้เช่าคืออะไร",role:"TENANT"});
  expect(answer.sourceIds).toEqual([]);
  expect(answer.answer).toContain("ติดต่อผู้ดูแล");
 });
 it("uses configured Gemini only with retrieved role-filtered context",async()=>{
  const fetcher=vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
   const payload=JSON.parse(String(init?.body));
   expect(payload.contents[0].parts[0].text).toContain("OWNER");
   expect(payload.contents[0].parts[0].text).toContain("ค่าเริ่มต้นของหอพัก");
   expect(payload.contents[0].parts[0].text).not.toContain("บัญชีผู้เช่า");
   expect(payload.contents[0].parts[0].text).not.toContain("user@example.com");
   expect(payload.contents[0].parts[0].text).not.toContain("0812345678");
   expect(payload.contents[0].parts[0].text).toContain("[ข้อมูลส่วนบุคคล]");
   return new Response(JSON.stringify({candidates:[{content:{parts:[{text:"ตั้งค่าได้จากหน้าห้องพัก"}]}}]}),{status:200});
  });
  await expect(answerRoleHelp({question:"ค่าเช่าห้อง user@example.com 0812345678",role:"OWNER",apiKey:"test-key",fetcher})).resolves.toMatchObject({answer:"ตั้งค่าได้จากหน้าห้องพัก",sourceIds:["property-room"]});
 });
 it("uses OpenRouter chat completions with role-filtered sanitized context",async()=>{
  const fetcher=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
   expect(String(url)).toBe("https://openrouter.ai/api/v1/chat/completions");
   const headers=new Headers(init?.headers);
   expect(headers.get("authorization")).toBe("Bearer test-openrouter-key");
   expect(headers.get("http-referer")).toBe("https://apartme.makemarket.space");
   const payload=JSON.parse(String(init?.body));
   expect(payload.model).toBe("nvidia/nemotron-3.5-lightning:free");
   expect(payload.reasoning).toMatchObject({effort:"low",exclude:true});
   expect(payload.messages[0].content).toContain("ROLE=TENANT");
   expect(payload.messages[0].content).toContain("ชำระได้จากเมนู");
   expect(payload.messages[0].content).not.toContain("จัดการสมาชิก");
   expect(payload.messages[0].content).not.toContain("tenant@example.com");
   return new Response(JSON.stringify({choices:[{message:{content:"ตรวจบิลได้ที่เมนูใบแจ้งหนี้"}}]}),{status:200});
  });
  await expect(answerRoleHelp({question:"ดูบิล tenant@example.com",role:"TENANT",apiKey:"test-openrouter-key",provider:"openrouter",model:"nvidia/nemotron-3.5-lightning:free",fetcher})).resolves.toMatchObject({answer:"ตรวจบิลได้ที่เมนูใบแจ้งหนี้",sourceIds:["tenant-invoice"]});
 });
});
