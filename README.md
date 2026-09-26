# GoMile: dashcam rewards on Solana

Drivers earn **MILE** (an SPL Token-2022 on devnet) for every minute of dashcam footage and every
road event the annotation pipeline finds. Payouts are real on-chain transfers, and each carries a memo
describing the drive, including the route as an encoded polyline when the phone recorded a GPS track.
The chain doubles as the database: reward history, duplicate checks and the little route map on each
trip are all read back from Solana, so no extra storage is needed.

## Setup

```bash
npm install
npm run setup     # creates treasury + MILE mint, writes .env.local
npm run dev
```

If the airdrop is rate-limited, send devnet SOL to the printed treasury address at
https://faucet.solana.com and run `npm run setup` again.

## Scripts

| Command | What it does |
|---|---|
| `npm run setup` | Creates the treasury and MILE token on the cluster in `SOLANA_RPC_URL` |
| `npm run dev` | Runs the app |
| `npm test` | Unit tests (reward maths, validation, memo parsing, auth) |
| `npm run e2e` | Real payout against a running server: `HOST=http://localhost:3000 npm run e2e` |
| `npm run typecheck` / `npm run lint` | Static checks |

See `.env.example` for every setting.

### Running against a local validator

```bash
# In its own terminal. --limit-ledger-size keeps hours of transaction history instead of the default ~2.5
# minutes; the ledger view and duplicate-payout check read payouts back from that history.
solana-test-validator --ledger .solana-ledger --limit-ledger-size 2000000
# set SOLANA_RPC_URL and NEXT_PUBLIC_SOLANA_RPC_URL to http://127.0.0.1:8899 in .env.local
npm run setup && npm run dev
```

"Open the app" goes straight to the driver account in `DRIVER_WALLET` (created by `npm run setup`); there's no wallet to connect. Configure the Pi with the same address so its trips land there. `/app?wallet=<address>` still opens any other wallet read-only.

## How the pieces fit

```
Raspberry Pi ──clip folder──▶ annotation/ (YOLO + Qwen) ──POST /api/sessions──▶ reward calc ──▶ SPL transfer + memo
                                                                                        │
Driver account  ◀── dashboard reads balance + memo history from chain ◀────────────────┘
```

| Route | Who calls it | What it does |
|---|---|---|
| `POST /api/sessions` | Pi / annotation worker (`Authorization: Bearer $DEVICE_API_KEY`) | Calculates the reward and pays it. Idempotent on `sessionId`. |
| `GET /api/drivers/:wallet` | Dashboard | Returns balance, totals and per-drive history. |

The reward rules are in `src/lib/rewards.ts`: a per-minute base rate, per-event bonuses, a confidence
threshold and a per-session cap.

## Reporting a drive from the Pi (Python)

```python
import os, requests

requests.post(f"{HOST}/api/sessions",
    headers={"Authorization": f"Bearer {os.environ['DEVICE_API_KEY']}"},
    json={
        "sessionId": "pi-01-20260926T133000Z",   # unique per drive; resending it won't pay twice
        "deviceId": "pi-01",
        "wallet": DRIVER_WALLET,                 # driver's Solana address, configured on the device
        "durationSeconds": 1800,
        "events": [{"type": "pedestrian", "t": 42.1, "confidence": 0.93}],
        # Optional: the phone's GPS track (up to 5000 points). Tap the trip in the dashboard to see it.
        "track": [{"t": 0, "lat": 51.4545, "lng": -2.5879}, {"t": 1, "lat": 51.4546, "lng": -2.5878}],
    }, timeout=60).json()
```

### Routes

A payout memo has to share one Solana packet with the token transfer, so the track is simplified
(Douglas-Peucker) until its Google-style encoded polyline fits the bytes left, roughly 150 to 200
points, and stored under `p` in the memo. The dashboard decodes it and draws it in an inline SVG map
with the distance; nothing is fetched from a map provider. `src/lib/route.ts` has both ends.

The annotation pipeline sends the track automatically when the clip folder has a `track.json` (see
`annotation/README.md`). To put a trip with a route on your own dashboard without a Pi:
`WALLET=$DRIVER_WALLET HOST=http://localhost:3456 npm run e2e`.

Event types: `near_miss`, `collision`, `hazard`, `pedestrian`, `cyclist`, `emergency_vehicle`,
`red_light`, `stop_sign`, `traffic_light`, `lane_change`. Anything else counts as `other`.

## Deploying

Add `TREASURY_SECRET_KEY`, `REWARD_MINT`, `NEXT_PUBLIC_REWARD_MINT`, `NEXT_PUBLIC_TOKEN_SYMBOL`,
`DEVICE_API_KEY` and optionally `SOLANA_RPC_URL` as environment variables (for example with
`vercel env add`). Use a private RPC such as Helius for anything beyond a demo, because the public devnet
endpoint rate-limits.
