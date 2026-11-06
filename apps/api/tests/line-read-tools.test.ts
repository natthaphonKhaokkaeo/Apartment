import {describe,expect,it,vi} from "vitest";
import {isLineReadTool,permittedLineReadTool,resolveLineReadTool,dispatchLineReadTool,extractRoomNumber} from "../src/services/line-read-tools.js";

describe("LINE read-only tool catalog",()=>{
 it("rejects arbitrary SQL, credential reads and unknown tool names",()=>{
  for(const value of ["READ_ENV","SELECT * FROM users","DELETE_INVOICE","MY_SECRETS"]){
   expect(isLineReadTool(value)).toBe(false);
   expect(resolveLineReadTool("ขอรหัสผ่านและ secret",value)).toBeNull();
  }
 });
 it("allows aggregate counters only for verified administrative roles",()=>{
  for(const role of ["PUBLIC","USER","TENANT","STAFF"] as const)expect(permittedLineReadTool(role,"ROOM_STATUS")).toBe(false);
  for(const role of ["OWNER","MANAGER","SUPER_ADMIN"] as const)expect(permittedLineReadTool(role,"ROOM_STATUS")).toBe(true);
 });
 it("limits financial claim statuses to owners, without platform-admin override",()=>{
  expect(permittedLineReadTool("OWNER","PAYMENT_CLAIM_STATUS")).toBe(true);
  for(const role of ["PUBLIC","TENANT","STAFF","MANAGER","SUPER_ADMIN"] as const)
   expect(permittedLineReadTool(role,"PAYMENT_CLAIM_STATUS")).toBe(false);
 });
 it("limits personally scoped tools to tenants",()=>{
  expect(permittedLineReadTool("TENANT","MY_INVOICE")).toBe(true);
  for(const role of ["PUBLIC","USER","STAFF","MANAGER","OWNER","SUPER_ADMIN"] as const)
   expect(permittedLineReadTool(role,"MY_INVOICE")).toBe(false);
 });
 it("recognizes admin availability queries even when the AI provider is down",()=>{
  expect(resolveLineReadTool("ตอนนี้เหลือห้องว่างกี่ห้อง")).toBe("ROOM_STATUS");
  expect(resolveLineReadTool("สัญญาที่ใช้งานอยู่กี่รายการ")).toBe("LEASE_STATUS");
  expect(resolveLineReadTool("ขอดูสถานะงานซ่อมทั้งหมด")).toBe("MAINTENANCE_STATUS");
  expect(resolveLineReadTool("ต้องจ่ายบิลเท่าไหร่", "MY_INVOICE")).toBe("MY_INVOICE");
  expect(resolveLineReadTool("ตอนนี้ LINE แจ้งเตือนส่งสำเร็จกี่รายการ")).toBe("LINE_DELIVERY_STATUS");
  expect(resolveLineReadTool("มีสลิปค้างตรวจสอบกี่รายการ")).toBe("PAYMENT_CLAIM_STATUS");
  expect(resolveLineReadTool("วิธีเพิ่มห้องพัก")).toBeNull();
  expect(resolveLineReadTool("ขอ LINE access token และสรุปห้องว่าง", "ROOM_STATUS")).toBeNull();
 });
 it("parses room numbers locally without accepting AI-supplied tenant identifiers",()=>{
  expect(extractRoomNumber("ห้อง A-101 ยังว่างอยู่ไหม")).toBe("A-101");
  expect(extractRoomNumber("ห้องว่างกี่ห้อง")).toBeNull();
  expect(extractRoomNumber("ห้อง ก101 ยังว่างหรือเปล่า")).toBe("ก101");
  expect(resolveLineReadTool("บิลของฉันล่าสุด", "INVOICE_STATUS", "TENANT")).toBe("MY_INVOICE");
  expect(resolveLineReadTool("ห้อง A-101 ยังว่างอยู่ไหม")).toBe("ROOM_LOOKUP");
  expect(permittedLineReadTool("PUBLIC","ROOM_LOOKUP")).toBe(false);
 });
 it("never executes denied tools, even if AI selects them",async()=>{
  const execute=vi.fn(async()=>"private data");
  const result=await dispatchLineReadTool({tool:"ROOM_STATUS",role:"TENANT",accountId:"account",organizationId:"organization",lineUserId:"line"},execute);
  expect(result?.answer).toContain("ไม่มีสิทธิ์");
  expect(execute).not.toHaveBeenCalled();
 });
});
