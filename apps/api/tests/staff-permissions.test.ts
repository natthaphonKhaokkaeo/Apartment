import {describe,it,expect} from "vitest";
import {mayAccessPropertyAsStaff,staffInviteTargetIsValid} from "../src/services/staff-permissions.js";

describe("P1-04 staff least-privilege policy",()=>{
 it("VIEWER may only read their assigned property",()=>{
  expect(mayAccessPropertyAsStaff("VIEWER","read")).toBe(true);
  expect(mayAccessPropertyAsStaff("VIEWER","meter.write")).toBe(false);
  expect(mayAccessPropertyAsStaff("VIEWER","admin.write")).toBe(false);
 });
 it("METER_READER may submit readings, never bill, rate, financial, lease or staff admin writes",()=>{
  expect(mayAccessPropertyAsStaff("METER_READER","read")).toBe(true);
  expect(mayAccessPropertyAsStaff("METER_READER","meter.write")).toBe(true);
  expect(mayAccessPropertyAsStaff("METER_READER","admin.write")).toBe(false);
 });
 it("requires a property for STAFF and prohibits one for org-wide MANAGER",()=>{
  expect(staffInviteTargetIsValid("STAFF","property-1")).toBe(true);
  expect(staffInviteTargetIsValid("STAFF",null)).toBe(false);
  expect(staffInviteTargetIsValid("MANAGER",null)).toBe(true);
  expect(staffInviteTargetIsValid("MANAGER","property-1")).toBe(false);
 });
});
