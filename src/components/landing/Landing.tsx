"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { TOKEN_SYMBOL, explorerAddress } from "@/lib/cluster";
import { RATES } from "@/lib/rewards";
import { Reveal } from "./Reveal";

// WebGL only exists in the browser, so the globe is never server-rendered.
const Globe = dynamic(() => import("./Globe").then((m) => m.Globe), { ssr: false });

const REPO = "https://github.com/mcrowley19/CBC-X-Solana-Hackathon";
const MINT = process.env.NEXT_PUBLIC_REWARD_MINT;

/* ---- Small pieces ---------------------------------------------------------------------------- */

/* Sentence case, site sans. Do not use a monospace face or all-caps styling on this page. */
const QUIET = "text-[15px] text-white/55";
const H2 = "max-w-3xl text-balance text-3xl font-medium leading-[1.08] tracking-tight sm:text-5xl";
const H3 = "text-2xl font-medium tracking-tight";
const PRIMARY_BUTTON =
  "press inline-flex h-12 items-center rounded-full bg-white px-7 text-[14px] font-medium text-black transition-colors hover:bg-white/90";
const BODY = "text-[16px] leading-relaxed text-white/60 sm:text-[17px]";
const SMALL = "mt-3 text-[15px] leading-relaxed text-white/65";

const SECTION = "px-6 py-20 sm:px-10 sm:py-24";

function Section({ id, title, children }: { id: string; title: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-16 ${SECTION}`}>
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className={H2}>{title}</h2>
        </Reveal>
        {children}
      </div>
    </section>
  );
}

/**
 * Image slot that is still to be generated. The prompt is shown in the box so whoever is
 * generating the picture (Cursor, an image model, a camera) can read it straight off the page.
 * Replace with an <img> once the file exists in /public/landing/.
 */
function ImagePlaceholder({ prompt, file, aspect = "aspect-[4/3]" }: { prompt: string; file: string; aspect?: string }) {
  return (
    <div
      role="img"
      aria-label={`Placeholder for ${file}`}
      className={`${aspect} flex w-full flex-col justify-between border border-dashed border-white/25 p-4`}
    >
      <p className="text-[12px] text-white/40">Image to generate</p>
      <div>
        <p className="text-[13px] leading-relaxed text-white/55">{prompt}</p>
        <p className="mt-2 text-[12px] text-white/35">{file}</p>
      </div>
    </div>
  );
}

/** Solana logo mark, three slanted bars, drawn in the current text colour (white here). */
function SolanaMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 397.7 311.7" aria-label="Solana" className={className} fill="currentColor">
      <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" />
      <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" />
      <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" />
    </svg>
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

/* Section 2: what GoMile is, told to the two people it is for. */
const AUDIENCES = [
  {
    title: "If you drive",
    body: `Mount GoMile on your dashboard and drive the way you always do. It records the road, picks out the moments worth keeping, and pays you in ${TOKEN_SYMBOL}: ${RATES.perMinute} for every minute behind the wheel, plus a bonus for each event it finds. Nothing to press, nothing to upload.`,
    file: "/landing/audience-driver.png",
    alt: "From the passenger seat at dusk: a small black camera on the dashboard, the driver's hands on the wheel, a city road ahead.",
  },
  {
    title: "If you buy driving data",
    body: "GoMile turns ordinary commutes into labelled footage of the rare events you cannot stage: near misses, cyclists, late lights. Every clip is hashed on the device before it leaves the car and every driver is paid on-chain for it, so you know where it came from, that it is untouched, and that the driver agreed to sell it.",
    file: "/landing/audience-buyer.png",
    alt: "A dark monitor wall of dashcam clips, each with bounding boxes around cars and riders, one clip outlined in red.",
  },
];

/* Section 3: what the pipeline reads out of a drive. */
const CLASSIFY_POINTS = [
  {
    title: "Everything on the road, every frame.",
    body: "A detector tracks pedestrians, cyclists, motorcycles, cars, signs and traffic lights frame by frame, with a confidence on every box.",
  },
  {
    title: "Twelve-second windows, read for events.",
    body: "A vision model reads each window of the drive and names what happened in it: a near miss, a lane change, a hazard in the road.",
  },
  {
    title: "Seen and felt.",
    body: "A near miss only counts if the accelerometer and gyro spiked at the same moment. The footage says what happened; the sensors confirm the car reacted.",
  },
];

const SOLANA_POINTS = [
  {
    title: "Small payouts, paid instantly.",
    body: `A six-minute school run is worth six ${TOKEN_SYMBOL}. On Solana that transfer costs a fraction of a cent and confirms in about a second, so paying per drive is viable instead of batching drivers into monthly statements.`,
  },
  {
    title: "The chain is the database.",
    body: "Every payout carries a memo. Balance, trip history, totals and device list are read back from the driver's token account. There is no Postgres, no indexer, nothing that can drift out of sync with what was actually paid.",
  },
  {
    title: "A standard token in a standard wallet.",
    body: `${TOKEN_SYMBOL} is a Token-2022 mint with its name and symbol on-chain. Phantom, Explorer and any DEX already understand it. Send the same session twice and you get the original receipt back, not a second payout.`,
  },
];

/* Section 4: the hardware, part by part. */
const PARTS = [
  {
    title: "Raspberry Pi",
    body: "The computer in the unit. Runs the capture script, writes clips to the card and hashes each one before it is uploaded.",
    file: "/landing/parts/raspberry-pi.png",
    alt: "A Raspberry Pi board, photographed from above on a matte black surface.",
  },
  {
    title: "Sense HAT",
    body: "Stacked on the Pi's GPIO header. Accelerometer, gyroscope and orientation, sampled once a second. It is what tells us a near miss was felt, not just seen.",
    file: "/landing/parts/sense-hat.png",
    alt: "A Raspberry Pi Sense HAT with the LED matrix off, on a matte black surface.",
  },
  {
    title: "USB camera",
    body: "A 1080p webcam aimed through the windshield. In the production unit it becomes the single lens in the face of the housing.",
    file: "/landing/parts/usb-camera.png",
    alt: "A small USB camera module, lens facing the viewer, on a matte black surface.",
  },
  {
    title: "Phone GPS",
    body: "The driver's phone shares its location track for the trip. The unit never needs its own GPS radio or SIM.",
    file: "/landing/parts/phone-gps.png",
    alt: "A phone in a dashboard mount showing a plain map with a route line, seen from the driver's seat.",
  },
  {
    title: "Power",
    body: "USB-C from the car's 12 V socket. The unit boots when the ignition turns and shuts down cleanly when it stops.",
    file: "/landing/parts/power.png",
    alt: "A black USB-C cable plugged into a car's 12 V socket adapter.",
  },
  {
    title: "Storage",
    body: "A microSD card holds the five-minute clips and the sensor log until they are uploaded. Each clip's SHA-256 is computed on the Pi, so a clip cannot be edited after the fact without the hash changing.",
    file: "/landing/parts/storage.png",
    alt: "A microSD card standing on edge on a matte black surface.",
  },
];

/* Section 6: the team. Headshots live in /public/landing/team/; a missing file shows a placeholder. */
const TEAM_ROLE = "Computer Science, Trinity College Dublin";
const TEAM: { name: string; role: string; file: string | null }[] = [
  { name: "Michael Crowley", role: TEAM_ROLE, file: "/landing/team/michael-crowley.jpg" },
  { name: "Jessica Chen", role: TEAM_ROLE, file: "/landing/team/jessica-chen.jpg" },
  { name: "Carlos Cejas", role: TEAM_ROLE, file: "/landing/team/carlos-cejas.jpg" },
  { name: "Ulas Icer", role: TEAM_ROLE, file: "/landing/team/ulas-icer.png" },
];

/* ---- Page ---------------------------------------------------------------------------------------- */

export function Landing() {
  const heroRef = useRef<HTMLElement>(null);
  const scrolled = useScrolledPast(heroRef);

  return (
    <main className="relative bg-black text-white">
      <header
        className={`fixed inset-x-0 top-0 z-20 flex h-16 items-center justify-between px-6 transition-colors duration-300 sm:px-10 ${
          scrolled ? "bg-black" : ""
        }`}
      >
        <a href="#top" className="text-[15px] font-medium">
          GoMile
        </a>
        <Link
          href="/app"
          className="rounded-full border border-white/25 px-4 py-1.5 text-[13px] font-medium transition-colors hover:border-white hover:bg-white hover:text-black"
        >
          View Demo
        </Link>
      </header>

      {/* Hero: the globe is the whole picture, and the copy sits on top of it in a thin frame. */}
      <section id="top" ref={heroRef} className="relative h-[100svh] min-h-[560px] overflow-hidden">
        <Globe className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none relative z-10 flex h-full flex-col justify-end px-6 pb-10 sm:px-10 sm:pb-14">
          <h1 className="max-w-2xl text-4xl font-medium leading-[1.05] tracking-tight sm:text-6xl">
            Every mile you drive is worth something.
          </h1>
          <Link href="/app" className={`${PRIMARY_BUTTON} pointer-events-auto mt-8 self-start`}>
            View Demo
          </Link>
        </div>
      </section>

      {/* 1. Problem */}
      <Section id="problem" title="The best driving data in the world is sitting on dashcams nobody pays for.">
        <div className="mt-12 grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          <Reveal>
            <p className={BODY}>
              Every self-driving model is trained on footage of the road. The rarest, most valuable frames are the ones nobody plans:
              a cyclist appearing from behind a van, a hard stop at a light that turned late, a car that nearly didn&rsquo;t stop.
              They happen on ordinary commutes, get recorded by ordinary dashcams, and get overwritten a week later.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <img
              src="/landing/dashcam-cyclist.png"
              alt="Through a rainy windshield, a cyclist pulls out from behind a van."
              className="aspect-video w-full object-cover"
            />
          </Reveal>
        </div>
      </Section>

      {/* 2. What it is, for each side of the market */}
      <Section id="product" title="A camera on your dashboard that pays you for the miles.">
        <div className="mt-12 grid gap-x-8 gap-y-14 md:grid-cols-2">
          {AUDIENCES.map((a, i) => (
            <Reveal key={a.title} delay={i * 80}>
              <h3 className={H3}>{a.title}</h3>
              <p className={SMALL}>{a.body}</p>
              <img src={a.file} alt={a.alt} className="mt-8 aspect-[4/3] w-full object-cover" />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 3. Classification, then why Solana */}
      <Section id="how" title="Every drive is read, frame by frame.">
        <div className="mt-12 grid items-center gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
          <Reveal>
            <img
              src="/landing/classification-frame.jpg"
              alt="Night dashcam frame with boxes labelled Pedestrian 0.71, Motorcycle 0.58 and Car around a rider and a parked car."
              width={1440}
              height={810}
              className="aspect-video w-full object-cover"
            />
          </Reveal>
          <ul className="grid gap-8">
            {CLASSIFY_POINTS.map((point, i) => (
              <li key={point.title} className="min-w-0">
                <Reveal delay={i * 60}>
                  <h3 className="text-xl font-medium tracking-tight">{point.title}</h3>
                  <p className={SMALL}>{point.body}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-20 border-t border-white/10 pt-14">
          <Reveal>
            <div className="flex items-center gap-4">
              <SolanaMark className="h-6 w-auto text-white sm:h-7" />
              <p className="text-2xl font-medium tracking-tight sm:text-3xl">Built on Solana.</p>
            </div>
            <p className={`${BODY} mt-5 max-w-2xl`}>
              Paying a driver a few tokens for a six-minute drive only works on a chain where that transfer is close to free
              and lands before they have parked. Solana is the only place we could make the payout itself the record.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-3">
            {SOLANA_POINTS.map((point, i) => (
              <Reveal key={point.title} delay={i * 80}>
                <h3 className="text-xl font-medium tracking-tight">{point.title}</h3>
                <p className={SMALL}>{point.body}</p>
              </Reveal>
            ))}
          </div>
          {MINT && (
            <Reveal delay={120} className="mt-12">
              <div className="flex flex-col gap-2 border border-white/15 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className={QUIET}>{TOKEN_SYMBOL} mint</p>
                  <p className="mt-1 break-all text-[14px] text-white/80">{MINT}</p>
                </div>
                <a
                  href={explorerAddress(MINT)}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-full border border-white/25 px-4 py-1.5 text-center text-[13px] font-medium transition-colors hover:border-white hover:bg-white hover:text-black"
                >
                  View on Explorer
                </a>
              </div>
            </Reveal>
          )}
        </div>
      </Section>

      {/* 4. Hardware */}
      <Section id="hardware" title="Off-the-shelf parts, one script, and a hash on every clip.">
        <Reveal className="mt-8">
          <p className={`${BODY} max-w-2xl`}>
            There is nothing custom in the box. Every part below can be bought today, and the capture script that ties them
            together is in the repo.
          </p>
        </Reveal>
        <ul className="mt-12 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {PARTS.map((part, i) => (
            <li key={part.title} className="min-w-0">
              <Reveal delay={(i % 3) * 60}>
                <img src={part.file} alt={part.alt} className="aspect-[4/3] w-full object-cover" />
                <h3 className={`${H3} mt-6`}>{part.title}</h3>
                <p className={SMALL}>{part.body}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </Section>

      {/* 5. Today and production, side by side */}
      <Section id="future" title="The future of the product">
        <Reveal className="mt-8">
          <p className={`${BODY} max-w-2xl`}>
            What we drove with this weekend, and what it becomes: the same Pi, camera and motion sensors closed into a low
            wedge that mounts on the dash. Same clips, same hashes, same payout. One cable instead of a laptop.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-10 md:grid-cols-2 md:gap-8">
          <Reveal>
            <img
              src="/landing/pi-on-dash.png"
              alt="The bench rig: a Raspberry Pi and webcam resting on a car dashboard."
              className="aspect-[4/3] w-full object-cover"
            />
            <h3 className={`${H3} mt-6`}>Today</h3>
            <p className={SMALL}>
              A Raspberry Pi, a Sense HAT and a webcam, plugged into a laptop on the passenger seat. This is the rig every
              clip in the demo came from.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <img
              src="/landing/device-on-dash.png"
              alt="A matte black GoMile unit on a car dashboard, lens aimed through the windshield."
              width={1152}
              height={864}
              className="aspect-[4/3] w-full object-cover"
            />
            <h3 className={`${H3} mt-6`}>Production</h3>
            <p className={SMALL}>
              One sealed housing. Camera forward, motion sensors inside, no LED matrix on the dash, USB-C to the car. It ships
              paired to the driver&rsquo;s wallet.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* 6. Team */}
      <Section id="team" title="Meet the team">
        <ul className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((member, i) => (
            <li key={member.name} className="min-w-0">
              <Reveal delay={i * 60}>
                {member.file ? (
                  <img
                    src={member.file}
                    alt={`Portrait of ${member.name}`}
                    width={800}
                    height={800}
                    className="aspect-square w-full object-cover grayscale"
                  />
                ) : (
                  <ImagePlaceholder
                    aspect="aspect-square"
                    prompt="Headshot, looking at the camera. Shown in black and white on the page."
                    file={`/landing/team/${member.name.toLowerCase().replace(/\s+/g, "-")}.jpg`}
                  />
                )}
                <h3 className="mt-5 text-lg font-medium tracking-tight">{member.name}</h3>
                <p className="mt-1 text-[15px] text-white/55">{member.role}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </Section>

      <section className={SECTION}>
        <div className="mx-auto max-w-6xl">
          <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <h2 className={H2}>Plug in the Pi. Drive. Watch the trip land on-chain.</h2>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/app" className={PRIMARY_BUTTON}>
                  View Demo
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
            <Reveal delay={80}>
              <img
                src="/landing/night-road.png"
                alt="A wet city street at night, seen from the driver's seat."
                className="aspect-[4/3] w-full object-cover"
              />
            </Reveal>
          </div>
        </div>
      </section>

      <footer className="px-6 py-10 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 text-[14px] text-white/45 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-white/80">GoMile</p>
            <p>Built at Dogpatch Labs in Dublin as part of BUILD IRL Vol. 1 · Dublin.</p>
            <p>Sponsored by Superteam Ireland and the Trinity Claude Builder&apos;s Club</p>
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
