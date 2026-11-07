import {describe,expect,it} from "vitest";
import {withBatchNote} from "../src/routes/billing-batches.js";
import type {BillingBatchSnapshot} from "../src/db/schema.js";
const sample=():BillingBatchSnapshot=>({version:1,start:"2026-11-01",endExclusive:"2026-12-01",rooms:[
 {roomId:"one",roomNumber:"101",leaseId:"lease",status:"READY",amountSatang:50000,
  fingerprint:"hash",lines:[{type:"RENT",description:"ค่าเช่า",amountSatang:50000}],reason:null},
 {roomId:"two",roomNumber:"102",leaseId:null,status:"SKIPPED",amountSatang:null,
  fingerprint:null,lines:[],reason:"MISSING_READING"}
]});
describe("optional batch invoice note",()=>{
 it("includes owner note in ready-room preview without changing amounts",()=>{
  const s=withBatchNote(sample(),"กรุณาชำระก่อนกำหนด");
  expect(s.note).toBe("กรุณาชำระก่อนกำหนด");
  expect(s.rooms[0].lines.at(-1)).toEqual({type:"NOTE",description:"กรุณาชำระก่อนกำหนด",amountSatang:0});
  expect(s.rooms[0].amountSatang).toBe(50000);
  expect(s.rooms[1].lines).toEqual([]);
 });
 it("maintains the historical snapshot shape when no note is entered",()=>{
  const s=withBatchNote(sample(),undefined);
  expect(s).not.toHaveProperty("note");
  expect(s.rooms[0].lines).toHaveLength(1);
 });
});
