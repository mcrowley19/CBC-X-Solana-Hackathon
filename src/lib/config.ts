import "server-only";
import bs58 from "bs58";
import { Keypair, PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { DEFAULT_RPC_URL } from "./cluster";

/**
 * Server configuration, validated once on first use so a missing or malformed
 * variable fails loudly with a clear message instead of deep inside a request.
 */
const envSchema = z.object({
  SOLANA_RPC_URL: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined),
    z.url({ protocol: /^https?$/ }).default(DEFAULT_RPC_URL),
  ),
  TREASURY_SECRET_KEY: z.string().min(1),
  REWARD_MINT: z.string().min(32),
  DEVICE_API_KEY: z.string().min(16, "DEVICE_API_KEY must be at least 16 characters"),
});

export type ServerConfig = {
  rpcUrl: string;
  treasury: Keypair;
  mint: PublicKey;
  deviceApiKey: string;
};

let cached: ServerConfig | undefined;

export function getConfig(): ServerConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const vars = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${vars}. Run \`npm run setup\` first.`);
  }
  const env = parsed.data;
  cached = {
    rpcUrl: env.SOLANA_RPC_URL,
    treasury: Keypair.fromSecretKey(bs58.decode(env.TREASURY_SECRET_KEY)),
    mint: new PublicKey(env.REWARD_MINT),
    deviceApiKey: env.DEVICE_API_KEY,
  };
  return cached;
}

/**
 * The account the dashboard opens on: the wallet the dashcam pays out to. Read separately,
 * so the page doesn't need the full payout config. Undefined if unset or not a valid address.
 */
export function driverWallet(): string | undefined {
  const value = process.env.DRIVER_WALLET?.trim();
  if (!value) return undefined;
  try {
    return new PublicKey(value).toBase58();
  } catch {
    return undefined;
  }
}
