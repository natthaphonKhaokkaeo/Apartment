import {describe,it,expect} from "vitest";
import {findUsageFlow} from "../src/services/line-help-flows.js";
import {answerRoleHelp} from "../src/services/line-help-rag.js";

describe("LINE usage guides",()=>{
 it("explains invoice flow for tenants",async()=>{const r=await answerRoleHelp({question:"วิธีดูบิลและชำระเงิน",role:"TENANT"});expect(r.answer).toContain("1.");expect(r.answer).toContain("สัญญาเช่า");expect(r.answer).toContain("↓");});
 it("prevents public access to tenant-specific guide",()=>{expect(findUsageFlow("ชำระเงิน", "PUBLIC")).toBeNull();});
 it("explains LINE billing notifications to managers",()=>{const r=findUsageFlow("ตั้งค่าแจ้งเตือนบิล LINE OA", "OWNER");expect(r?.answer).toContain("ความยินยอม");});
 it("answers general onboarding without authentication",()=>{expect(findUsageFlow("เริ่มต้นใช้งานระบบ","PUBLIC")?.answer).toContain("เข้าสู่ระบบ");});
});
