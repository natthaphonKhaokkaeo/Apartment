import {describe,expect,it} from "vitest";
import {
 assertMaintenanceTransition,isMaintenanceTicketOverdue,summarizeMaintenanceSla
} from "../src/services/maintenance-tickets.js";

describe("maintenance ticket workflow rules",()=>{
 it("allows sequential repair progress and a resolved-ticket reopen",()=>{
  expect(()=>assertMaintenanceTransition("OPEN","ACKNOWLEDGED")).not.toThrow();
  expect(()=>assertMaintenanceTransition("ACKNOWLEDGED","IN_PROGRESS")).not.toThrow();
  expect(()=>assertMaintenanceTransition("IN_PROGRESS","RESOLVED")).not.toThrow();
  expect(()=>assertMaintenanceTransition("RESOLVED","IN_PROGRESS")).not.toThrow();
  expect(()=>assertMaintenanceTransition("RESOLVED","CLOSED")).not.toThrow();
 });
 it("rejects skipped states and terminal ticket resurrection",()=>{
  expect(()=>assertMaintenanceTransition("OPEN","RESOLVED"))
   .toThrow("MAINTENANCE_TRANSITION_INVALID");
  expect(()=>assertMaintenanceTransition("CLOSED","IN_PROGRESS"))
   .toThrow("MAINTENANCE_TRANSITION_INVALID");
  expect(()=>assertMaintenanceTransition("CANCELLED","OPEN"))
   .toThrow("MAINTENANCE_TRANSITION_INVALID");
 });
 it("treats a due ticket as overdue only while it remains actionable",()=>{
  const now=new Date("2026-11-03T12:00:00Z");
  const due=new Date("2026-11-03T11:00:00Z");
  const future=new Date("2026-11-03T13:00:00Z");
  expect(isMaintenanceTicketOverdue(due,"IN_PROGRESS",now)).toBe(true);
  expect(isMaintenanceTicketOverdue(future,"OPEN",now)).toBe(false);
  expect(isMaintenanceTicketOverdue(due,"RESOLVED",now)).toBe(false);
  expect(isMaintenanceTicketOverdue(null,"OPEN",now)).toBe(false);
 });
 it("summarizes overdue, due-soon, missing-deadline and terminal tickets without leaking descriptions",()=>{
  const now=new Date("2026-11-05T12:00:00Z");
  const result=summarizeMaintenanceSla([
   {status:"OPEN",dueAt:new Date("2026-11-05T11:00:00Z")},
   {status:"ACKNOWLEDGED",dueAt:new Date("2026-11-05T13:00:00Z")},
   {status:"IN_PROGRESS",dueAt:null},
   {status:"CLOSED",dueAt:new Date("2026-11-05T10:00:00Z")}
  ],now);
  expect(result).toEqual({total:4,open:3,overdue:1,dueWithin24Hours:1,missingDueAt:1,byStatus:{OPEN:1,ACKNOWLEDGED:1,IN_PROGRESS:1,CLOSED:1}});
  expect(Object.keys(result)).toEqual(["total","open","overdue","dueWithin24Hours","missingDueAt","byStatus"]);
 });
});
