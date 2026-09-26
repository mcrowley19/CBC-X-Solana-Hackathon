import { describe, expect, it } from "vitest";
import { devicesFromHistory, groupTripsByDay, isThisWeek, monthActivity, tripTitle } from "./activity";
import type { RewardRecord } from "./schemas";

const now = new Date(2026, 8, 26, 14, 0); // 26 Sep 2026, local time

function trip(date: Date | null, r: number, m = 10, e = 2): RewardRecord {
  return {
    app: "dashcam",
    s: `s-${r}-${date?.getTime() ?? "pending"}`,
    m,
    e,
    r,
    signature: `sig-${r}-${date?.getTime() ?? "pending"}`,
    blockTime: date ? Math.floor(date.getTime() / 1000) : null,
  };
}

describe("monthActivity", () => {
  it("sums only trips paid in the current month", () => {
    const history = [
      trip(new Date(2026, 8, 3, 9), 12, 10, 1),
      trip(new Date(2026, 8, 26, 8), 30, 20, 3),
      trip(new Date(2026, 7, 31, 23), 100, 60, 9), // last month
      trip(null, 5), // pending, unknown day
    ];
    const month = monthActivity(history, now);
    expect(month.year).toBe(2026);
    expect(month.month).toBe(8);
    expect(month.days).toHaveLength(30);
    expect(month.trips).toBe(2);
    expect(month.minutes).toBe(30);
    expect(month.events).toBe(4);
    expect(month.earned).toBe(42);
    expect(month.days[2]).toMatchObject({ day: 3, trips: 1, earned: 12 });
    expect(month.days[25]).toMatchObject({ day: 26, trips: 1, earned: 30 });
    expect(month.bestDay).toBe(26);
  });

  it("has no best day when nothing was earned", () => {
    expect(monthActivity([], now).bestDay).toBeNull();
  });
});

describe("groupTripsByDay", () => {
  it("groups newest first with relative labels and pending on top", () => {
    const groups = groupTripsByDay(
      [
        trip(new Date(2026, 8, 24, 9), 7),
        trip(new Date(2026, 8, 26, 8), 30),
        trip(new Date(2026, 8, 25, 18), 4),
        trip(new Date(2026, 8, 25, 7), 6),
        trip(null, 5),
      ],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["Pending", "Today", "Yesterday", "24 Sept"]);
    expect(groups[2].records.map((r) => r.r)).toEqual([4, 6]);
    expect(groups[2].earned).toBe(10);
  });
});

describe("tripTitle", () => {
  it("labels today, yesterday and older trips", () => {
    expect(tripTitle(trip(new Date(2026, 8, 26, 8, 42), 1), now)).toMatch(/^Today /);
    expect(tripTitle(trip(new Date(2026, 8, 25, 17, 5), 1), now)).toMatch(/^Yesterday /);
    expect(tripTitle(trip(null, 1), now)).toBe("Pending");
  });
});

describe("isThisWeek", () => {
  it("keeps the last seven days and pending trips", () => {
    expect(isThisWeek(trip(new Date(2026, 8, 20, 15), 1), now)).toBe(true);
    expect(isThisWeek(trip(new Date(2026, 8, 18, 9), 1), now)).toBe(false);
    expect(isThisWeek(trip(null, 1), now)).toBe(true);
  });
});

describe("devicesFromHistory", () => {
  it("groups trips by device id and skips memos without one", () => {
    const a1 = { ...trip(new Date(2026, 8, 26, 8), 10, 30), d: "pi-01" };
    const a2 = { ...trip(new Date(2026, 8, 25, 8), 5, 20), d: "pi-01" };
    const b = { ...trip(new Date(2026, 8, 20, 8), 5, 15), d: "pi-02" };
    const devices = devicesFromHistory([a2, b, a1, trip(new Date(2026, 8, 26, 9), 1)], []);
    expect(devices.map((d) => d.id)).toEqual(["pi-01", "pi-02"]);
    expect(devices[0]).toMatchObject({ trips: 2, minutes: 50, events: 4, earned: 15, lastSeen: a1.blockTime });
  });
});

describe("paired devices", () => {
  it("lists a paired dashcam before its first trip, and merges its trips once they arrive", () => {
    expect(devicesFromHistory([], ["pi-01"])).toEqual([
      { id: "pi-01", trips: 0, minutes: 0, events: 0, earned: 0, lastSeen: null },
    ]);
    const paid = { ...trip(new Date(2026, 8, 26, 8), 10, 30), d: "pi-01" };
    expect(devicesFromHistory([paid], ["pi-01"])).toMatchObject([{ id: "pi-01", trips: 1, minutes: 30 }]);
  });
});
