import {describe,expect,it,vi} from "vitest";
import {notifyOrganizationMembersTx} from "../src/services/org-notifications.js";

describe("organization notification fan-out",()=>{
 it("stores one recipient-scoped item per active member using an idempotent event key",async()=>{
  const recipients=[{userId:"owner"},{userId:"staff"}];
  const where=vi.fn().mockResolvedValue(recipients);
  const from=vi.fn(()=>({where}));
  const select=vi.fn(()=>({from}));
  const insertedRows=[{id:"notification-1"},{id:"notification-2"}];
  const returning=vi.fn().mockResolvedValue(insertedRows);
  const onConflictDoNothing=vi.fn(()=>({returning}));
  const values=vi.fn(()=>({onConflictDoNothing}));
  const insert=vi.fn(()=>({values}));
  const tx={select,insert} as never;
  await expect(notifyOrganizationMembersTx(tx,"org-1",{
   eventKey:"ROOM_CREATED:room-1",kind:"ROOM_CREATED",title:"เพิ่มห้องพักใหม่",body:"เพิ่มห้อง A101"
  })).resolves.toBe(2);
  expect(values).toHaveBeenCalledWith(recipients.map(({userId})=>({
   organizationId:"org-1",recipientUserId:userId,eventKey:"ROOM_CREATED:room-1",kind:"ROOM_CREATED",
   title:"เพิ่มห้องพักใหม่",body:"เพิ่มห้อง A101"
  })));
  expect(onConflictDoNothing).toHaveBeenCalledOnce();
 });
 it("does not insert if the organization has no active members",async()=>{
  const where=vi.fn().mockResolvedValue([]);
  const insert=vi.fn();
  const tx={select:vi.fn(()=>({from:vi.fn(()=>({where}))})),insert} as never;
  await expect(notifyOrganizationMembersTx(tx,"org-empty",{
   eventKey:"ROOM_CREATED:room-1",kind:"ROOM_CREATED",title:"เพิ่มห้องพักใหม่",body:"เพิ่มห้อง A101"
  })).resolves.toBe(0);
  expect(insert).not.toHaveBeenCalled();
 });
});
