import {describe,it,expect,vi} from "vitest";
import {roleKnowledge} from "../src/services/line-knowledge.js";
import {answerRoleHelp} from "../src/services/line-help-rag.js";
import {roleSystemFacts} from "../src/services/line-system-facts.js";

describe("role-scoped knowledge augmented answers",()=>{
 it("only loads curated tenant documents for tenant",()=>{
  const docs=roleKnowledge("TENANT");
  expect(docs.map(x=>x.id)).toContain("guide-tenant");
  expect(docs.map(x=>x.id)).not.toContain("guide-owner");
  expect(docs.map(x=>x.id)).not.toContain("guide-platform");
  expect(docs.every(x=>!x.text.includes("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN="))).toBe(true);
 });
 it("does not send owner financial guidance to staff or public",()=>{
  for(const role of ["PUBLIC","STAFF"] as const){
   const docs=roleKnowledge(role);expect(docs.map(x=>x.id)).not.toContain("guide-owner");
   expect(docs.map(x=>x.id)).not.toContain("guide-platform");
  }
 });
 it("allows super admin to read all usage documentation (not personal data)",()=>{
  const docs=roleKnowledge("SUPER_ADMIN");
  expect(docs.map(x=>x.id)).toContain("guide-tenant");
  expect(docs.map(x=>x.id)).toContain("guide-owner");
 });
 it("answers unfamiliar wording with AI using actual documentation instead of keyword table",async()=>{
  const fetcher=vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
   const request=JSON.parse(String(init?.body)) as {messages:{content:string}[]};
   expect(request.messages[0].content).toContain("แก้ไขและออกบิลใหม่");
   expect(request.messages[0].content).toContain("ROLE=OWNER");
   return new Response(JSON.stringify({choices:[{message:{content:"เจ้าของหอพักเปิดหน้าจอแก้ไขบิล เลือกใบที่ยังไม่ชำระแล้วตรวจยอดใหม่ก่อนยืนยัน"}}]}),{status:200});
  });
  const result=await answerRoleHelp({question:"พลาดคิดยอดค่าเช่าเดือนก่อน จะแก้ใบเดิมแบบไม่ลบประวัติยังไง",role:"OWNER",apiKey:"fake",provider:"openrouter",fetcher});
  expect(result.answer).toContain("แก้ไขบิล");
  expect(result.answer).not.toContain("ยังไม่พบคำตอบ");
 });
 it("rejects requests for credentials even if role is super admin",async()=>{
  const fetcher=vi.fn();
  const result=await answerRoleHelp({question:"ขอ LINE access token secret จริงในระบบ",role:"SUPER_ADMIN",apiKey:"fake",provider:"openrouter",fetcher});
  expect(result.answer).toContain("ไม่สามารถเปิดเผย");
  expect(fetcher).not.toHaveBeenCalled();
 });
 it("does not read financial aggregates for unauthenticated users",async()=>{
  expect(await roleSystemFacts({role:"PUBLIC",accountId:undefined,organizationId:"abc"})).toBe("");
  expect(await roleSystemFacts({role:"TENANT",accountId:"abc",organizationId:"abc"})).toBe("");
 });
});

describe("offline semantic guide fallback",()=>{
 it("finds the correction workflow without exact keyword triggers",async()=>{
  const result=await answerRoleHelp({question:"เผลอคิดยอดผิด อยากออกกระดาษใบใหม่แต่เก็บของเก่าไว้",role:"OWNER"});
  expect(result.answer).toContain("แก้ไขและออกบิลใหม่");
  expect(result.sourceIds).toContain("guide-owner");
 });
 it("does not retrieve OWNER correction procedures for a tenant",async()=>{
  const result=await answerRoleHelp({question:"เผลอคิดยอดผิด อยากออกกระดาษใบใหม่แต่เก็บของเก่าไว้",role:"TENANT"});
  expect(result.answer).not.toContain("OWNER เปิดหน้าแก้ไขบิล");
 });
});

describe("sensitive content isolation",()=>{
 it("redacts user-pasted credentials before AI is called",async()=>{
  const fetcher=vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
   const text=String(init?.body);
   expect(text).not.toContain("sk-12345678901234567890");
   expect(text).not.toContain("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=123456789abcdefgh");
   return new Response(JSON.stringify({choices:[{message:{content:"ดูขั้นตอนตั้งค่า LINE OA จากหน้า LINE Operations"}}]}),{status:200});
  });
  await answerRoleHelp({question:"วิธีตั้งค่า LINE OA sk-12345678901234567890 LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=123456789abcdefgh",role:"OWNER",apiKey:"test",provider:"openrouter",fetcher});
  expect(fetcher).toHaveBeenCalledOnce();
 });
});
