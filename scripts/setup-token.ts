/**
 * One-time setup for whichever cluster SOLANA_RPC_URL points at (devnet by default):
 *   1. Creates (or reuses) a treasury keypair and funds it with an airdrop.
 *   2. Creates the MILE reward token (Token-2022 with on-chain name/symbol so wallets show it).
 *   3. Mints the initial supply into the treasury.
 *   4. Creates (or reuses) the driver account the dashboard opens on and the dashcam pays out to.
 *   5. Writes everything to .env.local.
 *
 * Safe to re-run: existing values in .env.local are reused.
 *   npm run setup
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bs58 from "bs58";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ExtensionType,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TYPE_SIZE,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  getMintLen,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { createInitializeInstruction, pack, type TokenMetadata } from "@solana/spl-token-metadata";

const ENV_PATH = path.join(process.cwd(), ".env.local");
const DECIMALS = 6;
const INITIAL_SUPPLY = 10_000_000; // whole tokens

const TOKEN_NAME = process.env.TOKEN_NAME ?? "DashCam Mile";
const TOKEN_SYMBOL = process.env.TOKEN_SYMBOL ?? "MILE";
const TOKEN_URI = process.env.TOKEN_URI ?? "";

function readEnv(): Record<string, string> {
  if (!fs.existsSync(ENV_PATH)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function writeEnv(env: Record<string, string>) {
  const body = Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  fs.writeFileSync(ENV_PATH, body + "\n");
}

async function main() {
  const env = readEnv();
  const rpcUrl = env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || clusterApiUrl("devnet");
  const connection = new Connection(rpcUrl, "confirmed");

  // 1. Treasury
  const treasury = env.TREASURY_SECRET_KEY
    ? Keypair.fromSecretKey(bs58.decode(env.TREASURY_SECRET_KEY))
    : Keypair.generate();
  env.SOLANA_RPC_URL = rpcUrl;
  env.TREASURY_SECRET_KEY = bs58.encode(treasury.secretKey);
  env.DEVICE_API_KEY ||= crypto.randomBytes(24).toString("hex");
  // The driver account. Its secret key is kept so the MILE it earns can be moved later; the app never uses it.
  if (!env.DRIVER_WALLET) {
    const driver = Keypair.generate();
    env.DRIVER_WALLET = driver.publicKey.toBase58();
    env.DRIVER_SECRET_KEY = bs58.encode(driver.secretKey);
  }
  writeEnv(env);
  env.NEXT_PUBLIC_SOLANA_RPC_URL = rpcUrl;
  writeEnv(env);
  console.log(`Cluster: ${rpcUrl}`);
  console.log(`Treasury: ${treasury.publicKey.toBase58()}`);
  console.log(`Driver account: ${env.DRIVER_WALLET} (set this as DRIVER_WALLET on the Pi)`);

  let balance = await connection.getBalance(treasury.publicKey);
  if (balance < 0.05 * LAMPORTS_PER_SOL) {
    console.log("Requesting airdrop...");
    try {
      const sig = await connection.requestAirdrop(treasury.publicKey, 1 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
      balance = await connection.getBalance(treasury.publicKey);
    } catch (e) {
      console.error(
        `\nAirdrop failed (public faucets are often rate-limited): ${(e as Error).message}\n` +
          `Fund the treasury manually at https://faucet.solana.com with address:\n\n  ${treasury.publicKey.toBase58()}\n\n` +
          `then run \`npm run setup\` again.`,
      );
      process.exit(1);
    }
  }
  console.log(`Treasury balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  // 2. Mint
  let mint: PublicKey;
  const existingMint = env.REWARD_MINT ? await connection.getAccountInfo(new PublicKey(env.REWARD_MINT)) : null;
  if (env.REWARD_MINT && !existingMint) {
    console.log(`Mint ${env.REWARD_MINT} doesn't exist on this cluster, creating a new one.`);
  }
  if (env.REWARD_MINT && existingMint) {
    mint = new PublicKey(env.REWARD_MINT);
    console.log(`Reusing mint: ${mint.toBase58()}`);
  } else {
    const mintKeypair = Keypair.generate();
    mint = mintKeypair.publicKey;
    const metadata: TokenMetadata = {
      mint,
      name: TOKEN_NAME,
      symbol: TOKEN_SYMBOL,
      uri: TOKEN_URI,
      additionalMetadata: [["project", "dashcam-rewards"]],
    };
    const mintLen = getMintLen([ExtensionType.MetadataPointer]);
    const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: treasury.publicKey,
        newAccountPubkey: mint,
        space: mintLen,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMetadataPointerInstruction(mint, treasury.publicKey, mint, TOKEN_2022_PROGRAM_ID),
      createInitializeMintInstruction(mint, DECIMALS, treasury.publicKey, null, TOKEN_2022_PROGRAM_ID),
      createInitializeInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        metadata: mint,
        updateAuthority: treasury.publicKey,
        mint,
        mintAuthority: treasury.publicKey,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
      }),
    );
    await sendAndConfirmTransaction(connection, tx, [treasury, mintKeypair]);
    console.log(`Created ${TOKEN_SYMBOL} mint: ${mint.toBase58()}`);

    // 3. Initial supply
    const treasuryAta = await getOrCreateAssociatedTokenAccount(
      connection, treasury, mint, treasury.publicKey, false, "confirmed", undefined, TOKEN_2022_PROGRAM_ID,
    );
    await mintTo(
      connection, treasury, mint, treasuryAta.address, treasury, BigInt(INITIAL_SUPPLY) * BigInt(10) ** BigInt(DECIMALS),
      [], undefined, TOKEN_2022_PROGRAM_ID,
    );
    console.log(`Minted ${INITIAL_SUPPLY.toLocaleString()} ${TOKEN_SYMBOL} to treasury`);

    env.REWARD_MINT = mint.toBase58();
    env.NEXT_PUBLIC_REWARD_MINT = mint.toBase58();
    env.NEXT_PUBLIC_TOKEN_SYMBOL = TOKEN_SYMBOL;
    writeEnv(env);
  }

  console.log(`\nDone. Explorer: https://explorer.solana.com/address/${mint.toBase58()}?cluster=${rpcUrl.includes("devnet") ? "devnet" : `custom&customUrl=${encodeURIComponent(rpcUrl)}`}`);
  console.log(`Device API key (give this to the Pi): ${env.DEVICE_API_KEY}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
