import {describe,it,expect} from "vitest";
import {lineReservationCutoff,reservationRetentionDays} from "../src/services/line-retention.js";

describe("P4-03e LINE reservation retention policy",()=>{
 it("never allows removal earlier than 30 days or invalid windows",()=>{
  expect(()=>lineReservationCutoff(new Date("2026-11-03"),29)).toThrow();
  expect(()=>lineReservationCutoff(new Date("2026-11-03"),366)).toThrow();
  expect(()=>lineReservationCutoff(new Date("2026-11-03"),30.5)).toThrow();
  expect(reservationRetentionDays.parse(30)).toBe(30);
  expect(lineReservationCutoff(new Date("2026-11-03T00:00:00.000Z"),30).toISOString())
   .toBe("2026-10-04T00:00:00.000Z");
 });
 it("rejects invalid clocks",()=>{
  expect(()=>lineReservationCutoff(new Date("not-a-date"),30)).toThrow("INVALID_NOW");
 });
});