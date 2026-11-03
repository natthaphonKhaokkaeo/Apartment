import {describe,it,expect} from "vitest";
import {rankOrgQueues,assessLineOpsAlerts} from "../src/services/line-fairness.js";

describe("P4-03d LINE org quotas and fairness",()=>{
 it("rotates to less-served active organization without ignoring older queued jobs",()=>{
  const entries=[
   {organizationId:"A",oldest:new Date("2026-11-03T08:00:00Z")},
   {organizationId:"B",oldest:new Date("2026-11-03T08:01:00Z")},
   {organizationId:"C",oldest:new Date("2026-11-03T07:59:00Z")}
  ];
  expect(rankOrgQueues(entries,{A:3,B:0,C:2},5)).toEqual(["B","C","A"]);
  expect(rankOrgQueues(entries,{A:5,B:0,C:0},5)).toEqual(["C","B"]);
  expect(rankOrgQueues(entries,{A:5,B:5,C:5},5)).toEqual([]);
 });
 it("detects operator incidents without PII and never invents delivery status",()=>{
  expect(assessLineOpsAlerts({
   unreviewedDeadCount:2,expiredSendingLeaseCount:1,oldestActiveAgeSeconds:1800
  })).toEqual(["DEAD_UNREVIEWED","EXPIRED_SENDING_LEASE","QUEUE_BACKLOG"]);
  expect(assessLineOpsAlerts({
   unreviewedDeadCount:0,expiredSendingLeaseCount:0,oldestActiveAgeSeconds:599
  })).toEqual([]);
  expect(assessLineOpsAlerts({
   unreviewedDeadCount:0,expiredSendingLeaseCount:0,oldestActiveAgeSeconds:900
  })).toEqual(["QUEUE_BACKLOG"]);
 });
});