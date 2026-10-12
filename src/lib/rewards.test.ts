import { describe, expect, it } from "vitest";
import { calculateReward, fromBaseUnits, serializeReward, toBaseUnits } from "./rewards";

describe("calculateReward", () => {
  it("pays per minute plus a flat bonus per verified event", () => {
    const reward = calculateReward({
      durationSeconds: 1800,
      events: [{ type: "pedestrian" }, { type: "near_miss", confidence: 0.8 }],
    });
    expect(reward.minutes).toBe(30);
    expect(reward.eventCount).toBe(2);
    expect(reward.amount).toBe(toBaseUnits(32));
  });

  it("pays the same for a near miss as for any other label", () => {
    const pedestrian = calculateReward({ durationSeconds: 0, events: [{ type: "pedestrian" }] });
    const nearMiss = calculateReward({ durationSeconds: 0, events: [{ type: "near_miss", confidence: 0.9 }] });
    expect(pedestrian.amount).toBe(nearMiss.amount);
  });

  it("ignores low-confidence events", () => {
    const reward = calculateReward({ durationSeconds: 600, events: [{ type: "hazard", confidence: 0.2 }] });
    expect(reward.eventCount).toBe(0);
    expect(reward.amount).toBe(toBaseUnits(10));
  });

  it("counts unknown event types as `other`", () => {
    const reward = calculateReward({ durationSeconds: 0, events: [{ type: "unicorn" }] });
    expect(reward.eventCounts).toEqual({ other: 1 });
    expect(reward.amount).toBe(toBaseUnits(1));
  });

  it("does not treat inherited object keys as event types", () => {
    const reward = calculateReward({ durationSeconds: 0, events: [{ type: "toString" }] });
    expect(reward.eventCounts).toEqual({ other: 1 });
  });

  it("pays no base rate for drives shorter than a minute", () => {
    expect(calculateReward({ durationSeconds: 59 }).amount).toBe(0n);
  });

  it("caps each session", () => {
    const reward = calculateReward({ durationSeconds: 600 * 60 });
    expect(reward.capped).toBe(true);
    expect(reward.amount).toBe(toBaseUnits(500));
  });

  it("adds per-event bonuses exactly in base units", () => {
    const events = Array.from({ length: 3 }, () => ({ type: "lane_change" }));
    expect(calculateReward({ durationSeconds: 0, events }).amount).toBe(toBaseUnits(3));
  });
});

describe("unit conversion", () => {
  it("round-trips whole and fractional amounts", () => {
    expect(fromBaseUnits(toBaseUnits(43.5))).toBe(43.5);
    expect(fromBaseUnits(1n)).toBe(0.000001);
  });

  it("serialises without bigints", () => {
    const json = JSON.stringify(serializeReward(calculateReward({ durationSeconds: 120 })));
    expect(JSON.parse(json).total).toBe(2);
  });
});
