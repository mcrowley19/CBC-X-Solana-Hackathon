"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { TOKEN_SYMBOL, explorerAddress } from "@/lib/cluster";
import { RATES } from "@/lib/rewards";
import { LiveLedger } from "./LiveLedger";
import { Reveal } from "./Reveal";
import { RewardCalculator } from "./RewardCalculator";

// WebGL only exists in the browser, so the globe is never server-rendered.
const Globe = dynamic(() => import("./Globe").then((m) => m.Globe), { ssr: false });

const REPO = "https://github.com/mcrowley19/CBC-X-Solana-Hackathon";
const MINT = process.env.NEXT_PUBLIC_REWARD_MINT;

const NAV = [
  ["problem", "Problem"],
  ["how", "How it works"],
  ["rates", "Rates"],
  ["solana", "Why Solana"],
  ["live", "Live"],
] as const;

/* ---- Small pieces ---------------------------------------------------------------------------- */

const MONO_KICKER = "font-mono text-[11px] uppercase tracking-[0.18em] text-white/50";
const H2 = "mt-4 max-w-3xl text-3xl font-medium leading-[1.08] tracking-tight sm:text-5xl";
const BODY = "text-[16px] leading-relaxed text-white/60 sm:text-[17px]";

function Section({ id, index, title, children, className = "" }: { id: string; index: string; title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-16 border-t border-white/10 px-6 py-20 sm:px-10 sm:py-28 ${className}`}>
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className={MONO_KICKER}>{index}</p>
          <h2 className={H2}>{title}</h2>
        </Reveal>
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-5 overflow-x-auto border border-white/10 bg-white/[0.03] p-4 font-mono text-[12px] leading-relaxed text-white/70">
      <code>{children}</code>
    </pre>
  );
}

/** Header turns solid once the hero has scrolled away, so nav reads over the sections. */
function useScrolledPast(ref: React.RefObject<HTMLElement | null>) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting), { rootMargin: "-64px 0px 0px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return past;
}

/* ---- Content ----------------------------------------------------------------------------------- */

const STEPS = [
  {
    n: "01",
    title: "Record",
    body: "A Raspberry Pi with a camera and a Sense HAT sits on the dash. It writes five-minute clips, hashes each one, logs the accelerometer and gyro once a second, and takes the phone's GPS track if there is one.",
    code: `device/data/clip_20260926T133000Z/
  clip_20260926T133000Z.avi
  sensor_data.json     # accel, gyro, orientation @ 1 Hz
  track.json           # phone GPS: t, lat, lng, speed
  metadata.json        # written last: the folder is finished`,
  },
  {
    n: "02",
    title: "Annotate",
    body: "The clip folder is picked up by a local pipeline. YOLO11 tracks pedestrians, cyclists, signs and lights frame by frame. A vision-language model reads twelve-second windows for near misses, lane changes, red lights and hazards. A near miss only counts if the IMU also spiked.",
    code: `{
  "sessionId": "pi-01-20260926T133000Z",
  "durationSeconds": 1680,
  "events": [
    { "type": "pedestrian", "t": 42.1, "confidence": 0.93 },
    { "type": "near_miss",  "t": 611.4, "confidence": 0.82 }
  ]
}`,
  },
  {
    n: "03",
    title: "Reward",
    body: `A pure function turns the report into a payout: ${RATES.perMinute} ${TOKEN_SYMBOL} per minute, a bonus per event above a ${RATES.minConfidence} confidence floor, capped at ${RATES.maxPerSession} per session so a looping upload can't drain the treasury.`,
    code: `calculateReward({ durationSeconds: 1680, events })
// → { minutes: 28, eventCount: 2, capped: false,
//     amount: 41_000_000n }   // 41 ${TOKEN_SYMBOL}, 6 decimals`,
  },
  {
    n: "04",
    title: "Pay",
    body: "The treasury signs one Token-2022 transfer to the driver's wallet, with a memo describing the drive in the same transaction. Send the same session twice and you get the original receipt back, not a second payout.",
    code: `{ "app": "dashcam", "s": "pi-01-20260926T133000Z",
  "d": "pi-01", "m": 28, "e": 2, "r": 41 }
// memo on the transfer. This is the whole database.`,
  },
];

const SOLANA_POINTS = [
  {
    title: "The chain is the database.",
    body: "Every payout carries a memo. Balance, trip history, totals and device list are read back from the driver's token account. There is no Postgres, no indexer, nothing that can drift out of sync with what was actually paid.",
  },
  {
    title: "Idempotent by construction.",
    body: "Before paying, the server scans the wallet's recent memos for the session id. A re-sent clip, a retried request or a replayed webhook returns the original signature.",
  },
  {
    title: "Payouts small enough to be honest.",
    body: "A six-minute school run is worth six MILE. On Solana that transfer costs a fraction of a cent and confirms in about a second, so paying per drive is viable rather than batching drivers into monthly statements.",
  },
  {
    title: "Token-2022, with metadata on the mint.",
    body: "MILE is a standard SPL Token-2022 mint with its name and symbol on-chain. Phantom, Explorer and any DEX already understand it. Nothing custom to integrate.",
  },
];

const HARDWARE: [string, string][] = [
  ["Compute", "Raspberry Pi"],
  ["Camera", "USB or CSI, 640 × 480 at 15 fps"],
  ["IMU", "Sense HAT: accelerometer, gyroscope, orientation"],
  ["Position", "Phone GPS track, optional"],
  ["Clip", "5 min, SHA-256 hashed on device"],
  ["Annotation", "YOLO11n + Qwen3-VL, on a laptop"],
  ["Settlement", `SPL Token-2022 on Solana, memo per drive`],
];

const NEXT_STEPS = [
  {
    title: "Provenance in the memo",
    body: "Clip and annotation hashes are already computed for every session. Writing them into the memo makes each labelled event traceable from the token back to the frame it came from.",
  },
  {
    title: "A buyer for the treasury",
    body: "Autonomy and insurance teams pay for rare-event footage today, through brokers. Selling the annotated set funds the treasury that pays drivers, so MILE is backed by the data that earned it.",
  },
  {
    title: "Drivers decide what's sold",
    body: "The wallet is the driver's. Which trips and which events go into a dataset is a choice they make on the dashboard, not a term buried in a dashcam's privacy policy.",
  },
];

/* ---- Page ---------------------------------------------------------------------------------------- */

export function Landing({ driverWallet, demoMode }: { driverWallet?: string; demoMode: boolean }) {
  const heroRef = useRef<HTMLElement>(null);
  const scrolled = useScrolledPast(heroRef);

  return (
    <main className="relative bg-black text-white">
      <header
        className={`fixed inset-x-0 top-0 z-20 flex h-16 items-center justify-between px-6 transition-colors duration-300 sm:px-10 ${
          scrolled ? "border-b border-white/10 bg-black" : "border-b border-transparent"
        }`}
      >
        <a href="#top" className="font-mono text-[13px] font-medium uppercase tracking-[0.18em]">
          GoMile
        </a>
        <nav className="hidden gap-7 md:flex" aria-label="Sections">
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50 transition-colors hover:text-white">
              {label}
            </a>
          ))}
        </nav>
        <Link
          href="/app"
          className="rounded-full border border-white/25 px-4 py-1.5 font-mono text-[12px] uppercase tracking-[0.14em] transition-colors hover:border-white hover:bg-white hover:text-black"
        >
          Open app
        </Link>
      </header>

      {/* Hero: the globe is the whole picture, and the copy sits on top of it in a thin frame. */}
      <section id="top" ref={heroRef} className="relative h-[100svh] min-h-[560px] overflow-hidden">
        <Globe className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none relative z-10 flex h-full flex-col justify-end px-6 pb-10 sm:px-10 sm:pb-14">
          <p className={MONO_KICKER}>Dashcam rewards on Solana</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-medium leading-[1.05] tracking-tight sm:text-6xl">
            Every mile you drive at night is worth something.
          </h1>
          <div className="mt-8 flex items-end justify-between gap-6">
            <p className="max-w-md text-[15px] leading-relaxed text-white/55">
              A Raspberry Pi dashcam, a local vision pipeline, and a {TOKEN_SYMBOL} payout on Solana for every minute of footage and every road event it finds.
            </p>
            <a href="#problem" className="pointer-events-auto hidden items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-white/50 transition-colors hover:text-white sm:flex">
              Scroll
              <span className="scroll-cue block h-10 w-px bg-white/30" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      <Section id="problem" index="01 — The problem" title="The best driving data in the world is sitting on dashcams nobody pays for.">
        <Reveal delay={80}>
          <p className={`mt-8 max-w-2xl ${BODY}`}>
            Every self-driving model is trained on footage of the road. The rarest, most valuable frames are the ones nobody plans:
            a cyclist appearing from behind a van, a hard stop at a light that turned late, a car that nearly didn&rsquo;t stop.
            They happen on ordinary commutes, get recorded by ordinary dashcams, and get overwritten a week later.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-3">
          {[
            ["The footage", "Rare road events are the scarcest labels in autonomy and the most expensive to buy. A dashcam loop deletes them within days."],
            ["The driver", "Records all of it, pays for the camera, and gets nothing. The footage leaves in a privacy policy, if it leaves at all."],
            ["The fix", `Annotate the drive where it happened, and pay the driver in ${TOKEN_SYMBOL} for every minute and every event. The chain keeps the receipt.`],
          ].map(([title, body], i) => (
            <Reveal key={title} delay={i * 80} className="bg-black p-6 sm:p-8">
              <p className={MONO_KICKER}>{title}</p>
              <p className="mt-4 text-[15px] leading-relaxed text-white/70">{body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section id="how" index="02 — How it works" title="From a clip folder on a Pi to a signed transfer, with nothing in between you have to trust.">
        <ol className="mt-14 grid gap-x-12 gap-y-14 lg:grid-cols-2">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={(i % 2) * 80}>
              <li className="border-t border-white/15 pt-5">
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[12px] text-white/40">{step.n}</span>
                  <h3 className="text-2xl font-medium tracking-tight">{step.title}</h3>
                </div>
                <p className="mt-4 text-[15px] leading-relaxed text-white/65">{step.body}</p>
                <Code>{step.code}</Code>
              </li>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section id="rates" index="03 — Rates" title="Dial in a drive. This is the exact function that pays it.">
        <Reveal delay={80}>
          <p className={`mt-8 max-w-2xl ${BODY}`}>
            Rarer events are worth more because they are worth more as training data. Anything under {RATES.minConfidence} confidence earns nothing,
            and a session never pays more than {RATES.maxPerSession} {TOKEN_SYMBOL}.
          </p>
        </Reveal>
        <Reveal delay={160} className="mt-12">
          <RewardCalculator />
        </Reveal>
      </Section>

      <Section id="solana" index="04 — Why Solana" title="No backend state. The memo program is the ledger.">
        <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2">
          {SOLANA_POINTS.map((point, i) => (
            <Reveal key={point.title} delay={(i % 2) * 80}>
              <div className="border-t border-white/15 pt-5">
                <h3 className="text-xl font-medium tracking-tight">{point.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-white/65">{point.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        {MINT && (
          <Reveal delay={120} className="mt-14">
            <div className="flex flex-col gap-2 border border-white/15 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={MONO_KICKER}>{TOKEN_SYMBOL} mint</p>
                <p className="mt-1 break-all font-mono text-[13px] text-white/80">{MINT}</p>
              </div>
              <a
                href={explorerAddress(MINT)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-full border border-white/25 px-4 py-1.5 text-center font-mono text-[12px] uppercase tracking-[0.14em] transition-colors hover:border-white hover:bg-white hover:text-black"
              >
                View on Explorer
              </a>
            </div>
          </Reveal>
        )}
      </Section>

      <Section id="live" index="05 — Live" title="It runs. Read the ledger, then add to it.">
        <Reveal delay={120} className="mt-12">
          <LiveLedger wallet={driverWallet} demoMode={demoMode} />
        </Reveal>
      </Section>

      <Section id="hardware" index="06 — In the car" title="Off-the-shelf parts. Nothing you can't buy this afternoon.">
        <Reveal delay={80} className="mt-12">
          <dl className="grid border-t border-white/15 sm:grid-cols-2">
            {HARDWARE.map(([label, value], i) => (
              <div key={label} className={`grid grid-cols-[120px_minmax(0,1fr)] gap-4 border-b border-white/10 py-4 ${i % 2 === 0 ? "sm:pr-8" : "sm:border-l sm:border-white/10 sm:pl-8"}`}>
                <dt className={MONO_KICKER}>{label}</dt>
                <dd className="text-[15px] text-white/80">{value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </Section>

      <Section id="next" index="07 — Where it goes" title="A dataset drivers own a share of.">
        <div className="mt-14 grid gap-px border border-white/10 bg-white/10 md:grid-cols-3">
          {NEXT_STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 80} className="bg-black p-6 sm:p-8">
              <h3 className="text-lg font-medium tracking-tight">{step.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-white/65">{step.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      <section className="border-t border-white/10 px-6 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className={MONO_KICKER}>Try it</p>
            <h2 className={H2}>Open the driver&rsquo;s wallet. Simulate a trip. Watch it land on-chain.</h2>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/app"
                className="press inline-flex h-12 items-center rounded-full bg-white px-7 text-[14px] font-medium text-black transition-colors hover:bg-white/90"
              >
                Open app
              </Link>
              <a
                href={REPO}
                target="_blank"
                rel="noreferrer"
                className="press inline-flex h-12 items-center rounded-full border border-white/25 px-7 text-[14px] font-medium transition-colors hover:border-white"
              >
                Source on GitHub
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-10 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-white/80">GoMile</p>
            <p>Built at BUILD IRL Vol. 1 · Dublin · September 2026</p>
            <p>Superteam Ireland × Claude Builder Club @ TCD × Solana</p>
            <p>Built with Claude Code</p>
          </div>
          <div className="flex flex-wrap gap-5">
            <Link href="/app" className="transition-colors hover:text-white">App</Link>
            <a href={REPO} target="_blank" rel="noreferrer" className="transition-colors hover:text-white">GitHub</a>
            {MINT && (
              <a href={explorerAddress(MINT)} target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
                {TOKEN_SYMBOL} on Explorer
              </a>
            )}
          </div>
        </div>
      </footer>
    </main>
  );
}
