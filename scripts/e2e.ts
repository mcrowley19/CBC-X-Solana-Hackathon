/**
 * End-to-end check against a running server (default http://localhost:3000):
 * pays a fresh wallet for a drive, re-sends the same session, then reads the ledger back.
 *   HOST=http://localhost:3456 npm run e2e
 */
import fs from "node:fs";
import { Keypair } from "@solana/web3.js";

const HOST = process.env.HOST ?? "http://localhost:3000";
const KEY = fs.readFileSync(".env.local", "utf8").match(/^DEVICE_API_KEY=(.*)$/m)?.[1];

async function post(body: unknown) {
  const res = await fetch(`${HOST}/api/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`, detail ?? "");
  if (!ok) process.exitCode = 1;
}

async function main() {
  const wallet = Keypair.generate().publicKey.toBase58();
  const session = {
    sessionId: `e2e-${Date.now().toString(36)}`,
    deviceId: "e2e",
    wallet,
    durationSeconds: 1800,
    events: [{ type: "pedestrian", t: 12, confidence: 0.9 }, { type: "near_miss", t: 400, confidence: 0.8 }],
  };

  const first = await post(session);
  check("first submit pays 43 MILE", first.status === 201 && first.json.reward?.total === 43, first.json);

  const second = await post(session);
  check("resubmit is not paid twice", second.status === 200 && second.json.duplicate === true, second.json);

  const ledger = await (await fetch(`${HOST}/api/drivers/${wallet}`)).json();
  check("balance reads back as 43", ledger.balance === 43, { balance: ledger.balance });
  check("history has one drive with memo", ledger.history?.length === 1 && ledger.history[0].s === session.sessionId, ledger.history);
}

main();
