import "server-only";
import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { TOKEN_DECIMALS, toBaseUnits, type RewardBreakdown } from "./rewards";

/**
 * The chain is our database: every payout carries a memo describing the session,
 * so reward history and duplicate checks are read straight back from Solana.
 */
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const MEMO_APP = "dashcam";

export type PayoutMemo = {
  app: typeof MEMO_APP;
  s: string; // session id
  d?: string; // device id
  m: number; // minutes recorded
  e: number; // events annotated
  r: number; // reward (whole tokens)
};

export type RewardRecord = PayoutMemo & {
  signature: string;
  blockTime: number | null;
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}. Run \`npm run setup\` first.`);
  return v;
}

let cached: { connection: Connection; treasury: Keypair; mint: PublicKey } | null = null;

export function getSolana() {
  if (!cached) {
    cached = {
      connection: new Connection(process.env.SOLANA_RPC_URL || clusterApiUrl("devnet"), "confirmed"),
      treasury: Keypair.fromSecretKey(bs58.decode(required("TREASURY_SECRET_KEY"))),
      mint: new PublicKey(required("REWARD_MINT")),
    };
  }
  return cached;
}

export function parseWallet(address: string): PublicKey | null {
  try {
    const key = new PublicKey(address);
    return PublicKey.isOnCurve(key.toBytes()) ? key : null;
  } catch {
    return null;
  }
}

function driverTokenAccount(wallet: PublicKey) {
  const { mint } = getSolana();
  return getAssociatedTokenAddressSync(mint, wallet, false, TOKEN_2022_PROGRAM_ID);
}

/** RPC returns memos as "[len] {json}"; multiple memos are joined with "; ". */
function parseMemo(raw: string | null): PayoutMemo | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  if (start === -1) return null;
  try {
    const parsed = JSON.parse(raw.slice(start));
    return parsed?.app === MEMO_APP ? (parsed as PayoutMemo) : null;
  } catch {
    return null;
  }
}

export async function getRewardHistory(wallet: PublicKey, limit = 50): Promise<RewardRecord[]> {
  const { connection } = getSolana();
  const sigs = await connection.getSignaturesForAddress(driverTokenAccount(wallet), { limit });
  const records: RewardRecord[] = [];
  for (const sig of sigs) {
    if (sig.err) continue;
    const memo = parseMemo(sig.memo);
    if (memo) records.push({ ...memo, signature: sig.signature, blockTime: sig.blockTime ?? null });
  }
  return records;
}

export async function getTokenBalance(wallet: PublicKey): Promise<number> {
  const { connection } = getSolana();
  try {
    const bal = await connection.getTokenAccountBalance(driverTokenAccount(wallet));
    return bal.value.uiAmount ?? 0;
  } catch {
    return 0; // account doesn't exist yet
  }
}

export async function findExistingPayout(wallet: PublicKey, sessionId: string) {
  const history = await getRewardHistory(wallet, 200);
  return history.find((r) => r.s === sessionId) ?? null;
}

export async function payReward(opts: {
  wallet: PublicKey;
  sessionId: string;
  deviceId?: string;
  reward: RewardBreakdown;
}): Promise<string> {
  const { connection, treasury, mint } = getSolana();
  const source = getAssociatedTokenAddressSync(mint, treasury.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const destination = driverTokenAccount(opts.wallet);

  const memo: PayoutMemo = {
    app: MEMO_APP,
    s: opts.sessionId,
    ...(opts.deviceId ? { d: opts.deviceId } : {}),
    m: opts.reward.minutes,
    e: Object.values(opts.reward.eventCounts).reduce((a, b) => a + b, 0),
    r: opts.reward.total,
  };

  const tx = new Transaction().add(
    // Treasury pays rent for the driver's token account on their first reward.
    createAssociatedTokenAccountIdempotentInstruction(
      treasury.publicKey, destination, opts.wallet, mint, TOKEN_2022_PROGRAM_ID,
    ),
    createTransferCheckedInstruction(
      source, mint, destination, treasury.publicKey, toBaseUnits(opts.reward.total), TOKEN_DECIMALS,
      [], TOKEN_2022_PROGRAM_ID,
    ),
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: Buffer.from(JSON.stringify(memo), "utf8"),
    }),
  );

  return sendAndConfirmTransaction(connection, tx, [treasury], { commitment: "confirmed" });
}
