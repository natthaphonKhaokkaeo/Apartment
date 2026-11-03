import {describe,it,expect} from "vitest";
import {selectRoomRateForPeriod} from "../src/services/room-rates.js";

describe("P1-03 dated room override history",()=>{
 const versions=[
  {id:"base",effectiveFrom:"1900-01-01",rentOverrideSatang:null},
  {id:"next",effectiveFrom:"2026-12-01",rentOverrideSatang:150000}
 ];
 it("chooses immutable as-of room rate for each period",()=>{
  expect(selectRoomRateForPeriod(versions,"2026-11-01","2026-12-01").id).toBe("base");
  expect(selectRoomRateForPeriod(versions,"2026-12-01","2027-01-01").id).toBe("next");
 });
 it("refuses pricing across a mid-cycle override boundary",()=>{
  expect(()=>selectRoomRateForPeriod(versions,"2026-11-20","2026-12-20"))
   .toThrow("ROOM_RATE_CHANGE_WITHIN_BILLING_PERIOD");
 });
});