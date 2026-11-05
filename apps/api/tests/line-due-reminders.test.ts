import {beforeEach,describe,expect,it,vi} from "vitest";

const state=vi.hoisted(()=>({
 candidates:[] as Array<{id:string}>,
 locked:[] as Array<{id:string}>,
 claims:[] as Array<{id:string}>,
 outstanding:500 as number,
 outcome:"QUEUED" as "QUEUED"|"ALREADY_QUEUED",
 transactionCalls:0,
 queueCalls:0,
 queryLimits:[] as number[],
}));
vi.mock("../src/db/client.js",()=>{
 const query=()=>({
  from(){return this;},where(){return this;},orderBy(){return this;},
  limit(n:number){state.queryLimits.push(n);return Promise.resolve(state.candidates);},
 });
 const txQuery=()=>({
  from(){return this;},where(){return this;},
  for(){return Promise.resolve(state.locked);},
  limit(){return Promise.resolve(state.claims);},
 });
 return {db:{
  select:query,
  transaction:async (fn:(tx:unknown)=>Promise<unknown>)=>{
   state.transactionCalls++;
   return fn({select:txQuery});
  },
 }};
});
vi.mock("../src/services/financial-position.js",()=>({
 getFinancialPosition:async()=>({outstandingSatang:state.outstanding}),
}));
vi.mock("../src/services/line-notifications.js",()=>({
 queueInvoiceNotificationTx:async()=>{state.queueCalls++;return state.outcome;},
}));
import {prepareDueReminders} from "../src/services/line-due-reminders.js";

const input={
 date:"2026-11-04",
 organizationId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
 now:new Date("2026-11-04T06:00:00Z"),
};
beforeEach(()=>{
 state.candidates=[{id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}];
 state.locked=[...state.candidates];
 state.claims=[];
 state.outstanding=500;
 state.outcome="QUEUED";
 state.transactionCalls=0;
 state.queueCalls=0;
 state.queryLimits=[];
});
describe("P4 due reminder eligibility safety — no external sender",()=>{
 it("dry-run returns potential count without locking or queueing",async()=>{
  expect(await prepareDueReminders(input)).toEqual({
   mode:"DRY_RUN",candidates:1,skipped:0,eligible:1,queued:0,alreadyQueued:0,
  });
  expect(state.transactionCalls).toBe(0);
  expect(state.queueCalls).toBe(0);
 });
 it("rejects APPLY on a different Bangkok-local day before querying DB",async()=>{
  await expect(prepareDueReminders({...input,date:"2026-11-03",apply:true}))
   .rejects.toThrow("DUE_REMINDER_MUST_RUN_ON_LOCAL_DUE_DATE");
  expect(state.queryLimits).toEqual([]);
 });
 it("queues only an eligible unpaid invoice with no pending claim",async()=>{
  expect(await prepareDueReminders({...input,apply:true})).toMatchObject({
   mode:"APPLY",eligible:1,queued:1,skipped:0,
  });
  expect(state.transactionCalls).toBe(1);
  expect(state.queueCalls).toBe(1);
 });
 it("does not queue when invoice was changed before lock",async()=>{
  state.locked=[];
  expect(await prepareDueReminders({...input,apply:true})).toMatchObject({
   eligible:0,queued:0,skipped:1,
  });
  expect(state.queueCalls).toBe(0);
 });
 it("does not queue settled invoice or pending payment claim",async()=>{
  state.outstanding=0;
  expect(await prepareDueReminders({...input,apply:true})).toMatchObject({queued:0,skipped:1});
  expect(state.queueCalls).toBe(0);
  state.outstanding=500;
  state.claims=[{id:"pending"}];
  expect(await prepareDueReminders({...input,apply:true})).toMatchObject({queued:0,skipped:1});
  expect(state.queueCalls).toBe(0);
 });
 it("reports idempotent duplicate notification, never a new queued item",async()=>{
  state.outcome="ALREADY_QUEUED";
  expect(await prepareDueReminders({...input,apply:true})).toMatchObject({
   eligible:1,queued:0,alreadyQueued:1,
  });
 });
 it("rejects non-finite and fractional limits before any database query",async()=>{
  for(const limit of [Number.NaN,Number.POSITIVE_INFINITY,1.5]){
   await expect(prepareDueReminders({...input,limit})).rejects.toThrow();
  }
  expect(state.queryLimits).toEqual([]);
 });
 it("caps high candidate limit at 100",async()=>{
  await prepareDueReminders({...input,limit:1000});
  expect(state.queryLimits).toEqual([100]);
 });
});
