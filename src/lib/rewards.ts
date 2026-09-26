/**
 * Reward rules. Pure functions, so they're safe to import from client or server.
 *
 * A driver earns:
 *   - a base rate for every minute of footage the device uploaded, plus
 *   - a bonus for each event the annotation pipeline found (rarer, more valuable
 *     events such as near misses are worth more as training data).
 * Each session is capped so one bad or looping upload can't drain the treasury.
 */

export const TOKEN_DECIMALS = 6;

export const RATES = {
  perMinute: 1,
  maxPerSession: 500,
  minSessionSeconds: 60,
  events: {
    near_miss: 10,
    collision: 10,
    hazard: 5,
    pedestrian: 3,
    cyclist: 3,
    emergency_vehicle: 3,
    red_light: 2,
    stop_sign: 1,
    traffic_light: 1,
    lane_change: 0.5,
    other: 0.5,
  } as Record<string, number>,
} as const;

export type AnnotatedEvent = {
  type: string;
  /** seconds from start of clip */
  t?: number;
  confidence?: number;
};

export type SessionReport = {
  sessionId: string;
  wallet: string;
  deviceId?: string;
  durationSeconds: number;
  events?: AnnotatedEvent[];
};

export type RewardBreakdown = {
  minutes: number;
  base: number;
  eventBonus: number;
  eventCounts: Record<string, number>;
  capped: boolean;
  total: number;
};

/** Events below this confidence don't earn a bonus. */
const MIN_CONFIDENCE = 0.5;

export function calculateReward(report: Pick<SessionReport, "durationSeconds" | "events">): RewardBreakdown {
  const minutes = Math.floor(Math.max(0, report.durationSeconds) / 60);
  const base = report.durationSeconds >= RATES.minSessionSeconds ? minutes * RATES.perMinute : 0;

  const eventCounts: Record<string, number> = {};
  let eventBonus = 0;
  for (const ev of report.events ?? []) {
    if (ev.confidence !== undefined && ev.confidence < MIN_CONFIDENCE) continue;
    const type = ev.type in RATES.events ? ev.type : "other";
    eventCounts[type] = (eventCounts[type] ?? 0) + 1;
    eventBonus += RATES.events[type];
  }

  const raw = base + eventBonus;
  const total = Math.min(raw, RATES.maxPerSession);
  return { minutes, base, eventBonus, eventCounts, capped: raw > total, total: round(total) };
}

export function toBaseUnits(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** TOKEN_DECIMALS));
}

function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
}
