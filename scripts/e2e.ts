/**
 * End-to-end check against a running server (default http://localhost:3000):
 * pays a fresh wallet for a drive with a GPS track, re-sends the same session, then reads the
 * ledger (and the route in its memo) back.
 *   HOST=http://localhost:3456 npm run e2e
 * Set WALLET=<address> to pay a specific account instead, e.g. to put a trip with a route on the dashboard.
 */
import fs from "node:fs";
import { Keypair } from "@solana/web3.js";
import { decodePolyline, routeDistanceMetres } from "../src/lib/route";

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

/** A 30-minute wander around Bristol, one fix a second, as a phone would record it. */
function track(seconds: number) {
  const points = [];
  let lat = 51.4545;
  let lng = -2.5879;
  let heading = 0.4;
  for (let t = 0; t < seconds; t++) {
    heading += Math.sin(t / 45) * 0.03 + (t % 300 === 0 ? 1.2 : 0);
    lat += Math.cos(heading) * 0.00008;
    lng += Math.sin(heading) * 0.00013;
    points.push({ t, lat: +lat.toFixed(5), lng: +lng.toFixed(5), speed: 9 });
  }
  return points;
}

async function main() {
  const wallet = process.env.WALLET ?? Keypair.generate().publicKey.toBase58();
  const session = {
    sessionId: `e2e-${Date.now().toString(36)}`,
    deviceId: "e2e",
    wallet,
    durationSeconds: 1800,
    events: [{ type: "pedestrian", t: 12, confidence: 0.9 }, { type: "near_miss", t: 400, confidence: 0.8 }],
    track: track(1800),
  };

  const first = await post(session);
  check("first submit pays 43 MILE", first.status === 201 && first.json.reward?.total === 43, first.json);

  const second = await post(session);
  check("resubmit is not paid twice", second.status === 200 && second.json.duplicate === true, second.json);

  const ledger = await (await fetch(`${HOST}/api/drivers/${wallet}`)).json();
  const record = ledger.history?.find((r: { s: string }) => r.s === session.sessionId);
  if (!process.env.WALLET) check("balance reads back as 43", ledger.balance === 43, { balance: ledger.balance });
  check("history has the drive with memo", !!record, ledger.history);
  const route = record?.p ? decodePolyline(record.p) : [];
  const km = routeDistanceMetres(route) / 1000;
  // The synthetic track above is about 16 km.
  check("memo carries the route", route.length > 20 && km > 12 && km < 20, {
    points: route.length,
    km: km.toFixed(1),
    memoChars: JSON.stringify(record ?? {}).length,
  });
  console.log(`\nOpen the trip: ${HOST}/app?wallet=${wallet}#trips`);
}

main();
