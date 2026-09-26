import { getRewardHistory, getTokenBalance, parseWallet } from "@/lib/solana";

export async function GET(_request: Request, ctx: RouteContext<"/api/drivers/[wallet]">) {
  const { wallet: address } = await ctx.params;
  const wallet = parseWallet(address);
  if (!wallet) return Response.json({ error: "Invalid wallet address" }, { status: 400 });

  try {
    const [balance, history] = await Promise.all([getTokenBalance(wallet), getRewardHistory(wallet)]);
    const totals = history.reduce(
      (acc, r) => ({ minutes: acc.minutes + r.m, events: acc.events + r.e, earned: acc.earned + r.r }),
      { minutes: 0, events: 0, earned: 0 },
    );
    return Response.json({ wallet: address, balance, totals, sessions: history.length, history });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
