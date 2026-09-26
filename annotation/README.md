# Annotation

Runs on the Mac that has the clips. The Pi writes a folder per drive; this turns that folder into boxes, rare-event tags, a review video, and a MILE payout.

```
device/data/clip_20260926T133000Z/
  clip_20260926T133000Z.avi
  metadata.json          # written last, so the folder is finished
  sensor_data.json
  track.json             # optional phone GPS: [{t, lat, lng, speed}]
```

`speed` is metres per second, the unit the phone geolocation API returns. When `track.json` is present the
route is posted with the session and stored, simplified, in the payout memo; the dashboard draws it when
you tap the trip.

## Setup

```bash
cd annotation
uv sync --extra dev          # on a Mac also: uv sync --extra dev --extra mlx
cp .env.example .env         # DRIVER_WALLET, DEVICE_API_KEY, DEVICE_ID
```

`DEVICE_API_KEY` is the same value as in the app's `.env.local`. On a 16 GB Mac set `VLM_MODEL=mlx-community/Qwen3-VL-4B-Instruct-4bit`. On 32 GB leave the model unset and the 8B weights are used. Linux, including the Framework used to develop this, stays on `VLM_BACKEND=stub` or `ollama`.

## Run

Plug the Pi in, copy `device/data` across (or point at it on the SD card), then:

```bash
uv run logbook-annotate watch ../device/data
```

One clip, without paying, while you check the video:

```bash
uv run logbook-annotate annotate ../device/data/clip_20260926T133000Z --no-post
```

Each clip lands in `annotation/out/<sessionId>/`:

| File | What it is |
|---|---|
| `events.json` | Posted to `POST /api/sessions`. Minutes plus events decide the MILE payout; the phone track, if any, rides along for the route map. |
| `labels.json` | Per-frame boxes, track ids, and scores. |
| `clip.json` | Local copy of the file hash, motion spikes, and the full phone track. Only a simplified route reaches the chain. |
| `review.mp4` | The original frames with boxes, a paper card on rare events, and a tick bar. |
| `receipt.json` | The Solana signature, after a successful post. |

A folder is skipped once it contains `.annotate-done`. Delete `.annotate-failed` to try that clip again. Paying the same `sessionId` twice returns the original receipt.

`uv run pytest` checks clip ingest, the event rules, and the review output. Token amounts are checked by `npm test`.

A folder with `.annotate-done` has been paid. `.annotate-local` means it was annotated with `--no-post`; the next `watch` without that flag will pay it. Delete `.annotate-failed` or `.annotate-running` to retry a clip that stopped.
