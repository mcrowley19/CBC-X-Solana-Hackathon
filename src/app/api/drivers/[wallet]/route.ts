import { internalError, jsonError } from "@/lib/http";
import type { DriverSummary } from "@/lib/schemas";
import { getRewardHistory, getTokenBalance, parseWallet } from "@/lib/solana";

export async function GET(_request: Request, ctx: RouteContext<"/api/drivers/[wallet]">) {
  const { wallet: address } = await ctx.params;
  const wallet = parseWallet(address);
  if (!wallet) return jsonError(400, "Invalid wallet address");

  try {
    const [balance, history] = await Promise.all([getTokenBalance(wallet), getRewardHistory(wallet)]);
    const totals = history.reduce(
      (acc, record) => ({
        minutes: acc.minutes + record.m,
        events: acc.events + record.e,
        earned: acc.earned + record.r,
      }),
      { minutes: 0, events: 0, earned: 0 },
    );
    const summary: DriverSummary = { wallet: address, balance, totals, sessions: history.length, history };
    return Response.json(summary);
  } catch (error) {
    return internalError("Loading driver", error);
  }
}
