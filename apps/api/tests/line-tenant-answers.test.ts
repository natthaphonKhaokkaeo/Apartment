import {describe,expect,it} from "vitest";
import {tenantQuestionKind} from "../src/services/line-tenant-answers.js";
describe("tenant private question routing",()=>{
 it("recognizes invoice and maintenance questions",()=>{
  expect(tenantQuestionKind("ยอดค้างชำระของฉันเท่าไหร่")).toBe("invoice");
  expect(tenantQuestionKind("สถานะงานซ่อมถึงไหนแล้ว")).toBe("maintenance");
 });
 it("does not intercept general help or instructions",()=>{
  expect(tenantQuestionKind("วิธีออกบิล")).toBeNull();
  expect(tenantQuestionKind("วิธีแจ้งซ่อม")).toBeNull();
 });
});
