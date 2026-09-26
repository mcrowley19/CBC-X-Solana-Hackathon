import "server-only";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { getConfig } from "./config";
import { TOKEN_DECIMALS, fromBaseUnits, type RewardBreakdown } from "./rewards";
import { MEMO_APP, parseMemo, type PayoutMemo, type RewardRecord } from "./schemas";

/**
 * The chain is our database: every payout carries a memo describing the session,
 * so reward history and duplicate checks are read straight back from Solana.
 */
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

let connection: Connection | undefined;

function getConnection() {
  connection ??= new Connection(getConfig().rpcUrl, "confirmed");
  return connection;
}

/** Returns the key for a valid wallet address (a point on the ed25519 curve), else null. */
export function parseWallet(address: string): PublicKey | null {
  try {
    const key = new PublicKey(address);
    return PublicKey.isOnCurve(key.toBytes()) ? key : null;
  } catch {
    return null;
  }
}

function rewardTokenAccount(owner: PublicKey) {
  return getAssociatedTokenAddressSync(getConfig().mint, owner, false, TOKEN_2022_PROGRAM_ID);
}

export async function getRewardHistory(wallet: PublicKey, limit = 50): Promise<RewardRecord[]> {
  const signatures = await getConnection().getSignaturesForAddress(rewardTokenAccount(wallet), { limit });
  return signatures.flatMap((sig) => {
    const memo = sig.err ? null : parseMemo(sig.memo);
    return memo ? [{ ...memo, signature: sig.signature, blockTime: sig.blockTime ?? null }] : [];
  });
}

export async function getTokenBalance(wallet: PublicKey): Promise<number> {
  const account = rewardTokenAccount(wallet);
  // A driver with no rewards yet has no token account; that's a zero balance, not an error.
  if (!(await getConnection().getAccountInfo(account))) return 0;
  const balance = await getConnection().getTokenAccountBalance(account);
  return balance.value.uiAmount ?? 0;
}

/**
 * Looks for an earlier payout of this session in the driver's recent history.
 * Checks the last 200 transactions, which is plenty for a demo; a production system
 * would keep an indexed payouts table instead.
 */
export async function findExistingPayout(wallet: PublicKey, sessionId: string) {
  const history = await getRewardHistory(wallet, 200);
  return history.find((record) => record.s === sessionId) ?? null;
}

export async function payReward(opts: {
  wallet: PublicKey;
  sessionId: string;
  deviceId?: string;
  reward: RewardBreakdown;
}): Promise<string> {
  const { treasury, mint } = getConfig();
  const source = rewardTokenAccount(treasury.publicKey);
  const destination = rewardTokenAccount(opts.wallet);

  const memo: PayoutMemo = {
    app: MEMO_APP,
    s: opts.sessionId,
    ...(opts.deviceId ? { d: opts.deviceId } : {}),
    m: opts.reward.minutes,
    e: opts.reward.eventCount,
    r: fromBaseUnits(opts.reward.amount),
  };

  const tx = new Transaction().add(
    // Treasury pays rent for the driver's token account on their first reward.
    createAssociatedTokenAccountIdempotentInstruction(
      treasury.publicKey,
      destination,
      opts.wallet,
      mint,
      TOKEN_2022_PROGRAM_ID,
    ),
    createTransferCheckedInstruction(
      source,
      mint,
      destination,
      treasury.publicKey,
      opts.reward.amount,
      TOKEN_DECIMALS,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: Buffer.from(JSON.stringify(memo), "utf8"),
    }),
  );

  return sendAndConfirmTransaction(getConnection(), tx, [treasury], { commitment: "confirmed" });
}
