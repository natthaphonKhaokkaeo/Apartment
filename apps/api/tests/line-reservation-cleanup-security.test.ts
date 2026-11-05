import {beforeEach,describe,expect,it,vi} from "vitest";

const {selectMock,deleteMock} = vi.hoisted(() => ({
  selectMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("../src/db/client.js", () => ({
  db: {select: selectMock,delete: deleteMock},
}));

import {cleanupLineReservations} from "../src/services/line-retention.js";

const organizationId = "00000000-0000-4000-8000-000000000001";
const oldReservationId = "00000000-0000-4000-8000-000000000002";

function countQuery(total: number) {
  return {from: () => ({where: () => Promise.resolve([{total}])})};
}
function candidateQuery(ids: string[]) {
  return {from: () => ({where: () => ({
    orderBy: () => ({limit: () => Promise.resolve(ids.map(id => ({id})))})
  })})};
}

describe("P7 LINE reservation retention — fail-closed deletion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    selectMock.mockImplementation(() => countQuery(5));
  });

  it("refuses invalid organization, retention and batch limits before database access", async () => {
    for (const input of [
      {organizationId: "not-a-uuid",apply: true},
      {organizationId,apply: true,retentionDays: 29},
      {organizationId,apply: true,retentionDays: 366},
      {organizationId,apply: true,limit: 0},
      {organizationId,apply: true,limit: 251},
      {organizationId,apply: true,limit: 1.2},
      {organizationId,apply: true,now: new Date("invalid")},
    ]) {
      await expect(cleanupLineReservations(input)).rejects.toThrow();
    }
    expect(selectMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("defaults to a dry run even when eligible reservations exist", async () => {
    const result = await cleanupLineReservations({organizationId});
    expect(result).toEqual({mode: "DRY_RUN",retentionDays:30,eligible:5,deleted:0,limit:100});
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("does not issue deletion when the bounded candidate set is empty", async () => {
    selectMock.mockImplementationOnce(() => countQuery(5))
      .mockImplementationOnce(() => candidateQuery([]));
    const result = await cleanupLineReservations({organizationId,apply:true,limit:2});
    expect(result).toEqual({mode:"APPLY",retentionDays:30,eligible:0,deleted:0,limit:2});
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("uses a bounded candidate query and reports actual deleted rows", async () => {
    const limitMock = vi.fn().mockResolvedValue([{id:oldReservationId}]);
    selectMock.mockImplementationOnce(() => countQuery(4))
      .mockImplementationOnce(() => ({from: () => ({where: () => ({
        orderBy: () => ({limit:limitMock})
      })})}));
    const returningMock = vi.fn().mockResolvedValue([{id:oldReservationId}]);
    const whereMock = vi.fn().mockReturnValue({returning:returningMock});
    deleteMock.mockReturnValue({where:whereMock});

    const result = await cleanupLineReservations({
      organizationId,apply:true,retentionDays:60,limit:2,
      now: new Date("2026-11-04T00:00:00.000Z"),
    });

    expect(limitMock).toHaveBeenCalledWith(2);
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(whereMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({mode:"APPLY",retentionDays:60,eligible:4,deleted:1,limit:2});
  });
});
