/**
 * Runtime schemas for everything that crosses a trust boundary (HTTP bodies, on-chain memos),
 * plus the API response types shared by server and client.
 */
import { z } from "zod";
import type { serializeReward } from "./rewards";

export const sessionReportSchema = z.object({
  sessionId: z.string().regex(/^[\w.:-]{1,64}$/, "sessionId must be 1-64 chars of [A-Za-z0-9_.:-]"),
  wallet: z.string().min(32).max(44),
  deviceId: z.string().max(32).optional(),
  durationSeconds: z.number().nonnegative().max(24 * 60 * 60),
  events: z
    .array(
      z.object({
        type: z.string().max(32),
        t: z.number().nonnegative().optional(),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .max(1000)
    .default([]),
  /** The phone's GPS track, if it recorded one. Simplified to fit the payout memo. */
  track: z
    .array(
      z.object({
        t: z.number().optional(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        speed: z.number().optional(),
      }),
    )
    .max(5000)
    .optional(),
});
export type SessionReport = z.infer<typeof sessionReportSchema>;

/**
 * What each payout's memo records. Field names are short because memos live on-chain.
 * `r` is the reward in whole tokens; `p` is the drive's route as an encoded polyline (see route.ts).
 */
export const MEMO_APP = "dashcam";
export const payoutMemoSchema = z.object({
  app: z.literal(MEMO_APP),
  s: z.string(),
  d: z.string().optional(),
  m: z.number(),
  e: z.number(),
  r: z.number(),
  p: z.string().optional(),
});
export type PayoutMemo = z.infer<typeof payoutMemoSchema>;

/** RPC returns memos as "[len] {json}", with multiple memos joined by "; ". */
export function parseMemo(raw: string | null | undefined): PayoutMemo | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  if (start === -1) return null;
  try {
    const result = payoutMemoSchema.safeParse(JSON.parse(raw.slice(start)));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// ---- API response shapes -------------------------------------------------

export type RewardRecord = PayoutMemo & { signature: string; blockTime: number | null };

export type DriverSummary = {
  wallet: string;
  balance: number;
  sessions: number;
  totals: { minutes: number; events: number; earned: number };
  history: RewardRecord[];
};

export type SessionResult =
  | { paid: false; sessionId: string; reward: ReturnType<typeof serializeReward>; reason: string }
  | { paid: true; sessionId: string; duplicate: true; signature: string; reward: { total: number } }
  | { paid: true; sessionId: string; duplicate?: false; signature: string; explorer: string; reward: ReturnType<typeof serializeReward> };

export type ApiError = { error: string };

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
}
