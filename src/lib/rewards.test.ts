import { describe, expect, it } from "vitest";
import { calculateReward, fromBaseUnits, serializeReward, toBaseUnits } from "./rewards";

describe("calculateReward", () => {
  it("pays per minute plus per-event bonuses", () => {
    const reward = calculateReward({
      durationSeconds: 1800,
      events: [{ type: "pedestrian" }, { type: "near_miss", confidence: 0.8 }],
    });
    expect(reward.minutes).toBe(30);
    expect(reward.eventCount).toBe(2);
    expect(reward.amount).toBe(toBaseUnits(43));
  });

  it("ignores low-confidence events", () => {
    const reward = calculateReward({ durationSeconds: 600, events: [{ type: "hazard", confidence: 0.2 }] });
    expect(reward.eventCount).toBe(0);
    expect(reward.amount).toBe(toBaseUnits(10));
  });

  it("counts unknown event types as `other`", () => {
    const reward = calculateReward({ durationSeconds: 0, events: [{ type: "unicorn" }] });
    expect(reward.eventCounts).toEqual({ other: 1 });
    expect(reward.amount).toBe(toBaseUnits(0.5));
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

  it("adds fractional bonuses exactly", () => {
    const events = Array.from({ length: 3 }, () => ({ type: "lane_change" }));
    // 0.5 * 3 in floating point is fine, but many small fractions drift; bigint never does.
    expect(calculateReward({ durationSeconds: 0, events }).amount).toBe(1_500_000n);
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
