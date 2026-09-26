/**
 * Which Solana cluster the app talks to. Safe to import from client or server.
 * Set NEXT_PUBLIC_SOLANA_RPC_URL (and SOLANA_RPC_URL for the server) to switch.
 */
export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

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
