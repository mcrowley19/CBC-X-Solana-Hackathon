"use client";

import { useState } from "react";
import { TOKEN_SYMBOL } from "@/lib/cluster";
import { RATES, calculateReward, fromBaseUnits, type EventType } from "@/lib/rewards";

/*
 * A drive you can dial in. It calls the same calculateReward() the payout route calls, so the
 * number shown is exactly what the treasury would send for that drive.
 */

const EVENT_LABELS: Record<EventType, string> = {
  near_miss: "Near miss",
  collision: "Collision",
  hazard: "Hazard",
  pedestrian: "Pedestrian",
  cyclist: "Cyclist",
  emergency_vehicle: "Emergency vehicle",
  red_light: "Red light",
  stop_sign: "Stop sign",
  traffic_light: "Traffic light",
  lane_change: "Lane change",
  other: "Other",
};

const PICKABLE = (Object.keys(RATES.events) as EventType[]).filter((t) => t !== "other");

const INITIAL: Partial<Record<EventType, number>> = { pedestrian: 3, traffic_light: 4, stop_sign: 1, near_miss: 1 };

function formatMile(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function RewardCalculator() {
  const [minutes, setMinutes] = useState(28);
  const [counts, setCounts] = useState<Partial<Record<EventType, number>>>(INITIAL);

  const events = PICKABLE.flatMap((type) => Array.from({ length: counts[type] ?? 0 }, () => ({ type, confidence: 0.9 })));
  const reward = calculateReward({ durationSeconds: minutes * 60, events });
  const total = fromBaseUnits(reward.amount);
  const fromMinutes = minutes >= RATES.minSessionSeconds / 60 ? reward.minutes * RATES.perMinute : 0;
  const fromEvents = events.reduce((sum, e) => sum + RATES.events[e.type], 0);

  const bump = (type: EventType, delta: number) =>
    setCounts((c) => ({ ...c, [type]: Math.max(0, Math.min(99, (c[type] ?? 0) + delta)) }));

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor="calc-minutes" className="text-[15px] text-white/55">
            Footage
          </label>
          <span className="text-[15px] tabular-nums">
            {minutes} min
          </span>
        </div>
        <input
          id="calc-minutes"
          type="range"
          min={0}
          max={120}
          step={1}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="range mt-4 w-full"
        />
        <div className="mt-1 flex justify-between text-[13px] text-white/35">
          <span>0</span>
          <span>60</span>
          <span>120 min</span>
        </div>

        <p className="mt-10 text-[15px] text-white/55">Events the annotator found</p>
        <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
          {PICKABLE.map((type) => {
            const n = counts[type] ?? 0;
            return (
              <li key={type} className="flex items-center gap-4 py-2.5">
                <span className={`flex-1 text-[15px] ${n ? "text-white" : "text-white/45"}`}>{EVENT_LABELS[type]}</span>
                <span className="w-16 text-right text-[13px] text-white/45 tabular-nums">
                  {RATES.events[type]} {TOKEN_SYMBOL}
                </span>
                <div className="flex items-center">
                  <button
                    type="button"
                    aria-label={`Fewer ${EVENT_LABELS[type]}`}
                    onClick={() => bump(type, -1)}
                    disabled={n === 0}
                    className="size-8 rounded-full border border-white/20 text-white/80 transition-colors hover:border-white hover:text-white disabled:opacity-25 disabled:hover:border-white/20"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-[15px] tabular-nums">{n}</span>
                  <button
                    type="button"
                    aria-label={`More ${EVENT_LABELS[type]}`}
                    onClick={() => bump(type, 1)}
                    className="size-8 rounded-full border border-white/20 text-white/80 transition-colors hover:border-white hover:text-white"
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="border border-white/15 p-6">
          <p className="text-[15px] text-white/55">This drive pays</p>
          <p className="mt-3 text-5xl leading-none tabular-nums sm:text-6xl">{formatMile(total)}</p>
          <p className="mt-2 text-[15px] text-white/55">{TOKEN_SYMBOL}</p>

          <dl className="mt-8 space-y-2 border-t border-white/10 pt-5 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt className="text-white/50">
                {reward.minutes} min × {RATES.perMinute}
              </dt>
              <dd className="tabular-nums">{formatMile(fromMinutes)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/50">{reward.eventCount} events</dt>
              <dd className="tabular-nums">{formatMile(fromEvents)}</dd>
            </div>
            {reward.capped && (
              <div className="flex justify-between gap-4 text-white/70">
                <dt>Session cap</dt>
                <dd className="tabular-nums">{RATES.maxPerSession}</dd>
              </div>
            )}
            {minutes > 0 && minutes * 60 < RATES.minSessionSeconds && (
              <p className="pt-2 text-white/50">Drives under {RATES.minSessionSeconds} s earn no base rate.</p>
            )}
          </dl>
          <p className="mt-6 text-[13px] leading-relaxed text-white/45">
            Computed by the same <span className="text-white/70">calculateReward()</span> the payout route runs before it signs a transfer.
          </p>
        </div>
      </aside>
    </div>
  );
}
