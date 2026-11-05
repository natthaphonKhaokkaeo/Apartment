import {describe,expect,it} from "vitest";
import {summarizeOccupancy} from "../src/services/occupancy-report.js";
describe("P5 property occupancy reconciliation",()=>{
 const rooms=[
  {id:"r1",status:"OCCUPIED"},
  {id:"r2",status:"AVAILABLE"},
  {id:"r3",status:"MAINTENANCE"},
 ];
 it("counts rooms and computes occupancy from physical room states",()=>{
  expect(summarizeOccupancy(rooms,[{roomId:"r1"}])).toEqual({
   totalRooms:3,occupiedRooms:1,availableRooms:1,maintenanceRooms:1,
   occupancyPercent:33.33,activeLeaseCount:1,
   occupiedWithoutActiveLease:0,activeLeaseInNonOccupiedRoom:0,
   roomsWithMultipleActiveLeases:0,
  });
 });
 it("flags orphaned occupancy and active lease on available room",()=>{
  expect(summarizeOccupancy(rooms,[{roomId:"r2"}])).toMatchObject({
   occupiedWithoutActiveLease:1,activeLeaseInNonOccupiedRoom:1,
  });
 });
 it("flags multiple active leases for the same room",()=>{
  expect(summarizeOccupancy(rooms,[{roomId:"r1"},{roomId:"r1"}]))
   .toMatchObject({roomsWithMultipleActiveLeases:1,activeLeaseCount:2});
 });
 it("handles empty property without division by zero",()=>{
  expect(summarizeOccupancy([],[])).toMatchObject({
   totalRooms:0,occupancyPercent:0,
  });
 });
 it("denies unknown room status or lease attached to another property",()=>{
  expect(()=>summarizeOccupancy([{id:"x",status:"DELETED"}],[]))
   .toThrow("INVALID_OCCUPANCY_STATE");
  expect(()=>summarizeOccupancy(rooms,[{roomId:"elsewhere"}]))
   .toThrow("LEASE_ROOM_SCOPE_MISMATCH");
 });
});
