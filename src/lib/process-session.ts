import "server-only";
import { explorerTx } from "./cluster";
import { calculateReward, serializeReward } from "./rewards";
import type { SessionReport, SessionResult } from "./schemas";
import { findExistingPayout, parseWallet, payReward } from "./solana";

/**
 * Stops the same session being paid twice by concurrent requests on one server instance.
 * Across instances, the on-chain duplicate check below is the backstop; a production
 * system would use a database unique constraint on sessionId instead.
 */
const inFlight = new Set<string>();

export type ProcessOutcome =
  | { ok: true; status: 200 | 201; result: SessionResult }
  | { ok: false; status: 400 | 409; error: string };

/** Calculates and pays the reward for one reported drive. Throws only on unexpected (RPC/chain) failures. */
export async function processSession(report: SessionReport): Promise<ProcessOutcome> {
  const wallet = parseWallet(report.wallet);
  if (!wallet) return { ok: false, status: 400, error: "wallet is not a valid Solana address" };

  const reward = calculateReward(report);
  if (reward.amount === 0n) {
    return {
      ok: true,
      status: 200,
      result: { paid: false, sessionId: report.sessionId, reward: serializeReward(reward), reason: "Nothing to reward" },
    };
  }

  if (inFlight.has(report.sessionId)) {
    return { ok: false, status: 409, error: "Session is already being processed" };
  }
  inFlight.add(report.sessionId);
  try {
    const existing = await findExistingPayout(wallet, report.sessionId);
    if (existing) {
      return {
        ok: true,
        status: 200,
        result: {
          paid: true,
          duplicate: true,
          sessionId: report.sessionId,
          signature: existing.signature,
          reward: { total: existing.r },
        },
      };
    }

    const signature = await payReward({
      wallet,
      sessionId: report.sessionId,
      deviceId: report.deviceId,
      reward,
      track: report.track,
    });
    return {
      ok: true,
      status: 201,
      result: {
        paid: true,
        sessionId: report.sessionId,
        signature,
        explorer: explorerTx(signature),
        reward: serializeReward(reward),
      },
    };
  } finally {
    inFlight.delete(report.sessionId);
  }
}
