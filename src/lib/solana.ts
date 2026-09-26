import "server-only";
import {
  Connection,
  PACKET_DATA_SIZE,
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
import { encodeRoute, type LatLng } from "./route";
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
  /** The drive's GPS track. As much of it as fits goes in the memo. */
  track?: LatLng[];
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

  const build = (memoBody: PayoutMemo) =>
    new Transaction().add(
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
        data: Buffer.from(JSON.stringify(memoBody), "utf8"),
      }),
    );

  let tx = build(memo);
  if (opts.track && opts.track.length >= 2) {
    const route = encodeRoute(opts.track, routeBudget(tx, treasury.publicKey));
    if (route) {
      const withRoute = build({ ...memo, p: route });
      // The budget is exact, but if anything about the wire format ever changes, pay without the route
      // rather than fail the payout.
      if (wireSize(withRoute, treasury.publicKey) <= PACKET_DATA_SIZE) tx = withRoute;
    }
  }

  return sendAndConfirmTransaction(getConnection(), tx, [treasury], { commitment: "confirmed" });
}

/** Any 32 bytes work for measuring; the real blockhash is fetched when the transaction is sent. */
const MEASURING_BLOCKHASH = PublicKey.default.toBase58();

/** How many bytes the signed transaction will take on the wire. */
function wireSize(tx: Transaction, feePayer: PublicKey): number {
  tx.feePayer = feePayer;
  tx.recentBlockhash = MEASURING_BLOCKHASH;
  const message = tx.compileMessage().serialize().length;
  tx.recentBlockhash = undefined;
  return 1 + 64 + message; // one signature, with its compact-u16 count
}

/**
 * The most JSON-escaped polyline characters the memo can grow by before the transaction stops
 * fitting in a packet. Adding the field costs `,"p":""` plus one byte for the memo's length prefix
 * once it passes 127 bytes.
 */
function routeBudget(withoutRoute: Transaction, feePayer: PublicKey): number {
  const overhead = ',"p":""'.length + 1;
  return PACKET_DATA_SIZE - wireSize(withoutRoute, feePayer) - overhead;
}
