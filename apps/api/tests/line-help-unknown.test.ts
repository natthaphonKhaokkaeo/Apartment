import {describe,it,expect} from "vitest";
import {answerRoleHelp} from "../src/services/line-help-rag.js";

describe("unknown role-scoped system questions",()=>{
 it("asks a specific follow-up instead of a dead-end canned refusal",async()=>{
  const result=await answerRoleHelp({question:"ซูเปอร์ควอนตัมเทเลพอร์ตไปดาวอังคารได้ไหม",role:"PUBLIC"});
  expect(result.answer).not.toContain("ยังไม่พบคำตอบในคู่มือระบบ");
  expect(result.answer.length).toBeGreaterThan(20);
 });
});
