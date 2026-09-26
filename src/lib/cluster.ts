/**
 * Which Solana cluster the app talks to. Safe to import from client or server.
 * Set NEXT_PUBLIC_SOLANA_RPC_URL (and SOLANA_RPC_URL for the server) to switch.
 */
export const DEFAULT_RPC_URL = "https://api.devnet.solana.com";

/**
 * Turns an env var into a usable RPC endpoint. A variable that is set but blank, or set to
 * something that isn't an http(s) URL (as happens with an empty value on Vercel), would make
 * `new Connection()` throw during the build, so anything unusable falls back to devnet.
 */
export function resolveRpcUrl(value: string | undefined, fallback = DEFAULT_RPC_URL): string {
  const trimmed = value?.trim();
  return trimmed && /^https?:\/\//i.test(trimmed) ? trimmed : fallback;
}

export const RPC_URL = resolveRpcUrl(process.env.NEXT_PUBLIC_SOLANA_RPC_URL);

const LOCAL = /localhost|127\.0\.0\.1/.test(RPC_URL);

export const CLUSTER_LABEL = LOCAL ? "local validator" : RPC_URL.includes("devnet") ? "devnet" : "custom cluster";

function clusterQuery() {
  if (LOCAL) return `cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`;
  if (RPC_URL.includes("devnet")) return "cluster=devnet";
  if (RPC_URL.includes("testnet")) return "cluster=testnet";
  return `cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`;
}

export function explorerTx(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?${clusterQuery()}`;
}

export function explorerAddress(address: string) {
  return `https://explorer.solana.com/address/${address}?${clusterQuery()}`;
}

export const TOKEN_SYMBOL = process.env.NEXT_PUBLIC_TOKEN_SYMBOL ?? "MILE";
