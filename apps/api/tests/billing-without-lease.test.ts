import {describe,expect,it} from "vitest";
import {billableLease,noLeaseRecipientName} from "../src/services/billing-lease.js";
const lease={id:"lease-123",startDate:"2026-10-01",endDate:null,tenantName:"ผู้เช่าเดิม"};
describe("invoices anchored to property room, not mandatory lease",()=>{
 it("permits standard period with no active lease",()=>{
  expect(billableLease(undefined,"2026-11-01","2026-12-01")).toBeNull();
  expect(noLeaseRecipientName).toBe("ไม่ระบุผู้เช่า");
 });
 it("uses actual tenant only when a lease covers the entire ordinary billing period",()=>{
  expect(billableLease(lease,"2026-11-01","2026-12-01")?.id).toBe("lease-123");
  expect(billableLease({...lease,startDate:"2026-11-15"},"2026-11-01","2026-12-01")).toBeNull();
  expect(billableLease({...lease,endDate:"2026-11-20"},"2026-11-01","2026-12-01")).toBeNull();
 });
 it("partial move-in/move-out retains the real active contract for specialized checks",()=>{
  expect(billableLease({...lease,startDate:"2026-11-15"},"2026-11-15","2026-12-01",true)?.id).toBe("lease-123");
 });
});
