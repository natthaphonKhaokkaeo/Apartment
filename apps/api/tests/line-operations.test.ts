import {describe,it,expect} from "vitest";
import {safeOperatorStatus,decideWorkerMode,redactOutboxErrorCode,staleAgeSeconds} from "../src/services/line-operations.js";

describe("LINE outbox operations safety rules",()=>{
 it("never schedules real sends unless separate deployment approval and verified credentials exist",()=>{
  expect(decideWorkerMode({requested:"observe",outbound:"live",approved:"true",hasCredentials:true})).toBe("observe");
  expect(decideWorkerMode({requested:"live",outbound:"live",approved:"false",hasCredentials:true})).toBe("observe");
  expect(decideWorkerMode({requested:"live",outbound:"simulate",approved:"true",hasCredentials:true})).toBe("observe");
  expect(decideWorkerMode({requested:"live",outbound:"live",approved:"true",hasCredentials:false})).toBe("observe");
  expect(decideWorkerMode({requested:"live",outbound:"live",approved:"true",hasCredentials:true})).toBe("live");
 });
 it("requires status filtering and safe redaction; no LINE identifiers or message text leak",()=>{
  expect(safeOperatorStatus("DEAD")).toBe("DEAD");
  expect(safeOperatorStatus("QUEUED")).toBe("QUEUED");
  expect(()=>safeOperatorStatus("OTHER")).toThrow();
  expect(redactOutboxErrorCode("HTTP_429")).toBe("HTTP_429");
  expect(redactOutboxErrorCode("TOKEN=secret and recipient U123")).toBe("OTHER");
  expect(redactOutboxErrorCode(null)).toBeNull();
 });
 it("reports stale age without negative values",()=>{
  const now=new Date("2026-11-03T12:00:00Z");
  expect(staleAgeSeconds(new Date("2026-11-03T11:59:01Z"),now)).toBe(59);
  expect(staleAgeSeconds(new Date("2026-11-03T13:00:00Z"),now)).toBe(0);
  expect(staleAgeSeconds(null,now)).toBeNull();
 });
});