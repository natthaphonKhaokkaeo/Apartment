import {describe,it,expect} from "vitest";
import {validateMoveOutBoundary} from "../src/services/lease-lifecycle.js";
describe("P1-01 move-out boundary policy",()=>{
 it("accepts settlement at current Bangkok day and rejects future or before lease",()=>{
  const now=new Date("2026-11-03T09:00:00Z");
  expect(validateMoveOutBoundary("2026-10-01","2026-11-01",now)).toBe("2026-11-01");
  expect(()=>validateMoveOutBoundary("2026-10-01","2026-11-05",now)).toThrow();
  expect(()=>validateMoveOutBoundary("2026-10-01","2026-10-01",now)).toThrow();
  expect(()=>validateMoveOutBoundary("2026-10-01","invalid",now)).toThrow();
 });
});
