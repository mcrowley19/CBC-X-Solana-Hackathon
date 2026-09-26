import "server-only";
import { calculateReward, type SessionReport } from "./rewards";
import { findExistingPayout, parseWallet, payReward } from "./solana";

/** Guards against the same session being submitted twice concurrently on one instance. */
const inFlight = new Set<string>();

export type ProcessResult =
  | { status: 200 | 201; body: Record<string, unknown> }
  | { status: 400 | 409 | 500; body: { error: string } };

export function validateReport(input: unknown): SessionReport | string {
  if (!input || typeof input !== "object") return "Body must be a JSON object";
  const r = input as Record<string, unknown>;
  if (typeof r.sessionId !== "string" || !/^[\w.:-]{1,64}$/.test(r.sessionId))
    return "sessionId must be 1-64 chars of [A-Za-z0-9_.:-]";
  if (typeof r.wallet !== "string") return "wallet is required";
  if (typeof r.durationSeconds !== "number" || !Number.isFinite(r.durationSeconds) || r.durationSeconds < 0)
    return "durationSeconds must be a non-negative number";
  if (r.deviceId !== undefined && (typeof r.deviceId !== "string" || r.deviceId.length > 32))
    return "deviceId must be a string of at most 32 chars";
  if (r.events !== undefined) {
    if (!Array.isArray(r.events)) return "events must be an array";
    if (r.events.some((e) => !e || typeof e !== "object" || typeof (e as { type?: unknown }).type !== "string"))
      return "each event needs a string `type`";
  }
  return r as unknown as SessionReport;
}

export async function processSession(report: SessionReport): Promise<ProcessResult> {
  const wallet = parseWallet(report.wallet);
  if (!wallet) return { status: 400, body: { error: "wallet is not a valid Solana address" } };

  const reward = calculateReward(report);
  if (reward.total <= 0) {
    return { status: 200, body: { sessionId: report.sessionId, reward, paid: false, reason: "Nothing to reward" } };
  }

  if (inFlight.has(report.sessionId)) {
    return { status: 409, body: { error: "Session is already being processed" } };
  }
  inFlight.add(report.sessionId);
  try {
    const existing = await findExistingPayout(wallet, report.sessionId);
    if (existing) {
      return {
        status: 200,
        body: { sessionId: report.sessionId, paid: true, duplicate: true, signature: existing.signature, reward: existing.r },
      };
    }
    const signature = await payReward({ wallet, sessionId: report.sessionId, deviceId: report.deviceId, reward });
    return {
      status: 201,
      body: {
        sessionId: report.sessionId,
        paid: true,
        reward,
        signature,
        explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      },
    };
  } catch (e) {
    console.error("payout failed", e);
    return { status: 500, body: { error: `Payout failed: ${(e as Error).message}` } };
  } finally {
    inFlight.delete(report.sessionId);
  }
}
