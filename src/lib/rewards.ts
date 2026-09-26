/**
 * Reward rules. Pure functions, so they're safe to import from client or server.
 *
 * A driver earns:
 *   - a base rate for every minute of footage the device uploaded, plus
 *   - a bonus for each event the annotation pipeline found (rarer, more valuable
 *     events such as near misses are worth more as training data).
 * Each session is capped so one bad or looping upload can't drain the treasury.
 *
 * All arithmetic is done in integer base units (bigint) so amounts are exact;
 * RATES are written in whole tokens only for readability.
 */

export const TOKEN_DECIMALS = 6;
const UNITS_PER_TOKEN = 10n ** BigInt(TOKEN_DECIMALS);

export const RATES = {
  perMinute: 1,
  maxPerSession: 500,
  minSessionSeconds: 60,
  /** Events below this confidence don't earn a bonus. */
  minConfidence: 0.5,
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
  },
} as const;

export type EventType = keyof typeof RATES.events;

export type AnnotatedEvent = {
  type: string;
  /** Seconds from the start of the clip. */
  t?: number;
  confidence?: number;
};

export type RewardBreakdown = {
  minutes: number;
  eventCounts: Partial<Record<EventType, number>>;
  eventCount: number;
  capped: boolean;
  /** Exact payout in base units. */
  amount: bigint;
};

export function toBaseUnits(tokens: number): bigint {
  return BigInt(Math.round(tokens * 10 ** TOKEN_DECIMALS));
}

/** Exact for any amount below 2^53 base units (~9 billion tokens). */
export function fromBaseUnits(units: bigint): number {
  const whole = units / UNITS_PER_TOKEN;
  const frac = units % UNITS_PER_TOKEN;
  return Number(whole) + Number(frac) / Number(UNITS_PER_TOKEN);
}

function isEventType(type: string): type is EventType {
  return Object.hasOwn(RATES.events, type);
}

export function calculateReward(input: { durationSeconds: number; events?: AnnotatedEvent[] }): RewardBreakdown {
  const minutes = Math.floor(Math.max(0, input.durationSeconds) / 60);
  const eligible = input.durationSeconds >= RATES.minSessionSeconds;
  let amount = eligible ? BigInt(minutes) * toBaseUnits(RATES.perMinute) : 0n;

  const eventCounts: RewardBreakdown["eventCounts"] = {};
  let eventCount = 0;
  for (const event of input.events ?? []) {
    if (event.confidence !== undefined && event.confidence < RATES.minConfidence) continue;
    const type: EventType = isEventType(event.type) ? event.type : "other";
    eventCounts[type] = (eventCounts[type] ?? 0) + 1;
    eventCount += 1;
    amount += toBaseUnits(RATES.events[type]);
  }

  const cap = toBaseUnits(RATES.maxPerSession);
  const capped = amount > cap;
  return { minutes, eventCounts, eventCount, capped, amount: capped ? cap : amount };
}

/** JSON-safe view of a breakdown for API responses (bigint can't be serialised). */
export function serializeReward(reward: RewardBreakdown) {
  return {
    minutes: reward.minutes,
    eventCounts: reward.eventCounts,
    eventCount: reward.eventCount,
    capped: reward.capped,
    total: fromBaseUnits(reward.amount),
  };
}
