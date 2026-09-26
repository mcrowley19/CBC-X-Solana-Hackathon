import { ConnectButton } from "@/components/ConnectButton";
import { Ledger } from "@/components/Ledger";
import { CLUSTER_LABEL, TOKEN_SYMBOL as SYMBOL, explorerAddress } from "@/lib/cluster";
import { isDemoMode } from "@/lib/config";
import { RATES, type EventType } from "@/lib/rewards";

const EVENT_LABELS: Record<EventType, string> = {
  near_miss: "Near miss",
  collision: "Collision",
  hazard: "Road hazard",
  pedestrian: "Pedestrian",
  cyclist: "Cyclist",
  emergency_vehicle: "Emergency vehicle",
  red_light: "Red-light runner",
  stop_sign: "Stop sign",
  traffic_light: "Traffic light",
  lane_change: "Lane change",
  other: "Anything else",
};

export default function Home() {
  const demoMode = isDemoMode();
  const mint = process.env.NEXT_PUBLIC_REWARD_MINT;

  return (
    <>
      <header className="sticky top-0 z-30 h-16 border-b border-ink/15 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-5 md:px-10">
          <a href="#" className="font-display text-2xl font-medium italic tracking-[-0.02em]">
            Logbook<span className="text-accent">.</span>
          </a>
          <nav className="hidden gap-8 md:flex">
            {[
              ["#ledger", "Ledger"],
              ["#rates", "Rates"],
              ["#device", "Device API"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="kicker transition-colors hover:text-accent">
                {label}
              </a>
            ))}
          </nav>
          <ConnectButton />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 md:px-10">
        <section className="grid gap-12 pt-[clamp(3rem,8vw,6rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)] lg:gap-20">
          <div>
            <p className="kicker rise mb-6">Solana {CLUSTER_LABEL} · Dashcam rewards</p>
            <h1 className="rise rise-1 font-display text-[clamp(3rem,7.5vw,6.25rem)] font-light leading-[0.92] tracking-[-0.02em]">
              Keep the camera
              <br />
              rolling. Get paid
              <br />
              by the <em className="text-accent">mile</em>.
            </h1>
            <p className="rise rise-2 mt-8 max-w-[52ch] text-ink-soft">
              Your dashcam records the road. We annotate the footage, marking pedestrians, hazards and near misses,
              and pay you {SYMBOL} tokens for every minute recorded and every event found. Payouts settle on Solana
              within seconds, and each one carries a memo recording the drive it paid for.
            </p>
          </div>
          <Ledger demoMode={demoMode} />
        </section>

        <section id="rates" className="mt-[clamp(4rem,8vw,7rem)] grid gap-10 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)]">
          <div>
            <p className="kicker mb-2">02 — Rates</p>
            <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-light leading-none tracking-[-0.015em]">
              What a drive
              <br />
              is worth.
            </h2>
            <p className="mt-6 max-w-[40ch] text-ink-soft">
              Rare events are worth more because they make the most useful training data. Events the annotator
              flags with less than 50% confidence don&rsquo;t count. Each drive is capped at{" "}
              {RATES.maxPerSession} {SYMBOL}.
            </p>
          </div>
          <dl className="border-t border-ink font-mono text-sm">
            <div className="flex justify-between border-b border-line py-3">
              <dt>Per minute recorded</dt>
              <dd className="text-accent">
                {RATES.perMinute} {SYMBOL}
              </dd>
            </div>
            {Object.entries(RATES.events).map(([type, rate]) => (
              <div key={type} className="flex justify-between border-b border-line py-3">
                <dt>
                  {EVENT_LABELS[type as EventType]} <span className="text-ink-tertiary">· {type}</span>
                </dt>
                <dd>
                  +{rate} {SYMBOL}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="device" className="mt-[clamp(4rem,8vw,7rem)] lg:pl-[16%]">
          <p className="kicker mb-2">03 — Device API</p>
          <h2 className="max-w-[18ch] font-display text-[clamp(2rem,4vw,3rem)] font-light leading-none tracking-[-0.015em]">
            One request per drive.
          </h2>
          <p className="mt-6 max-w-[60ch] text-ink-soft">
            When a trip has been uploaded and annotated, the Raspberry Pi (or the annotation worker) reports it. If
            the same <code className="font-mono text-ink">sessionId</code> is sent twice, it gets the original
            receipt back and is not paid a second time.
          </p>
          <pre className="mt-8 overflow-x-auto bg-ink p-6 font-mono text-[13px] leading-relaxed text-paper">
{`curl -X POST $HOST/api/sessions \\
  -H "Authorization: Bearer $DEVICE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sessionId": "pi-01-2026-09-26T10-00",
    "deviceId": "pi-01",
    "wallet": "<driver wallet address>",
    "durationSeconds": 1800,
    "events": [
      { "type": "pedestrian", "t": 42.1, "confidence": 0.93 },
      { "type": "near_miss",  "t": 611.0, "confidence": 0.81 }
    ]
  }'`}
          </pre>
        </section>
      </main>

      <footer className="mx-auto mt-[clamp(4rem,8vw,7rem)] flex max-w-7xl flex-wrap justify-between gap-4 border-t border-ink/15 px-5 py-8 md:px-10">
        <span className="kicker">Logbook · Hackathon build</span>
        {mint && (
          <a
            href={explorerAddress(mint)}
            target="_blank"
            rel="noreferrer"
            className="kicker underline decoration-ink-tertiary underline-offset-4 hover:text-accent"
          >
            {SYMBOL} mint {mint.slice(0, 4)}…{mint.slice(-4)}
          </a>
        )}
      </footer>
    </>
  );
}
