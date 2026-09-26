import { describe, expect, it } from "vitest";
import { parseMemo, sessionReportSchema } from "./schemas";

const WALLET = "Fe4i4MQkJgAESF8MQK4XG3XGs2r2tq61sqsTZyEdGtS8";

describe("sessionReportSchema", () => {
  it("accepts a valid report and defaults events to []", () => {
    const result = sessionReportSchema.parse({ sessionId: "pi-01:2026", wallet: WALLET, durationSeconds: 60 });
    expect(result.events).toEqual([]);
  });

  it.each([
    ["missing wallet", { sessionId: "a", durationSeconds: 60 }],
    ["bad sessionId characters", { sessionId: "has spaces", wallet: WALLET, durationSeconds: 60 }],
    ["negative duration", { sessionId: "a", wallet: WALLET, durationSeconds: -1 }],
    ["confidence above 1", { sessionId: "a", wallet: WALLET, durationSeconds: 60, events: [{ type: "x", confidence: 2 }] }],
    ["event without type", { sessionId: "a", wallet: WALLET, durationSeconds: 60, events: [{ t: 1 }] }],
  ])("rejects %s", (_label, body) => {
    expect(sessionReportSchema.safeParse(body).success).toBe(false);
  });
});

describe("parseMemo", () => {
  const memo = { app: "dashcam", s: "session-1", m: 30, e: 2, r: 43 };

  it("parses the RPC's length-prefixed memo format", () => {
    expect(parseMemo(`[62] ${JSON.stringify(memo)}`)).toEqual(memo);
  });

  it("ignores memos from other apps and malformed JSON", () => {
    expect(parseMemo(`[10] ${JSON.stringify({ ...memo, app: "other" })}`)).toBeNull();
    expect(parseMemo("[5] {not json")).toBeNull();
    expect(parseMemo(null)).toBeNull();
  });

  it("rejects memos with the wrong field types", () => {
    expect(parseMemo(JSON.stringify({ ...memo, r: "43" }))).toBeNull();
  });
});
