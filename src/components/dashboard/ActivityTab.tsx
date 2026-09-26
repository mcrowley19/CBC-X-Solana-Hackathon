"use client";

import { useState } from "react";
import { formatTokens, monthActivity, type MonthActivity } from "@/lib/activity";
import { TOKEN_SYMBOL } from "@/lib/cluster";
import type { DriverSummary } from "@/lib/schemas";
import { Empty, Figures, SectionHead } from "./ui";

/**
 * One bar per day of the month, earnings as height, in a filled card. A single series in ink, so no legend;
 * the best day is direct-labelled and tapping any bar reads it out below.
 */
function DayStrip({ month }: { month: MonthActivity }) {
  const today = new Date().getDate();
  const [picked, setPicked] = useState<number>(month.bestDay ?? today);
  const max = Math.max(...month.days.map((d) => d.earned), 1);
  const day = month.days[picked - 1];
  const dateLabel = new Date(month.year, month.month, picked).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <figure className="rounded-3xl bg-surface px-5 pb-5 pt-8 lg:px-7 lg:pb-6 lg:pt-10">
      <div role="group" aria-label="Earnings by day" className="flex h-32 items-end gap-[2px] lg:h-72 lg:gap-1">
        {month.days.map((d) => {
          const isFuture = d.day > today;
          const height = d.earned > 0 ? Math.max(3, (d.earned / max) * 100) : 0;
          const selected = d.day === picked;
          return (
            <button
              key={d.day}
              type="button"
              onClick={() => setPicked(d.day)}
              aria-label={`${d.day}: ${formatTokens(d.earned)} ${TOKEN_SYMBOL}`}
              aria-pressed={selected}
              disabled={isFuture}
              className="group relative h-full flex-1 disabled:cursor-default"
            >
              {d.day === month.bestDay && (
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-medium text-ink-soft">
                  {formatTokens(d.earned)}
                </span>
              )}
              {/* Absolutely positioned so the percentage height resolves inside a <button>. */}
              <span
                className={`absolute inset-x-0 bottom-0 rounded-t-[2px] transition-colors ${
                  selected ? "bg-accent" : d.earned > 0 ? "bg-ink group-hover:bg-ink-soft" : isFuture ? "" : "bg-line-strong"
                }`}
                style={{ height: d.earned > 0 ? `${height}%` : "2px" }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex justify-between pt-2 text-[12px] text-ink-tertiary">
        <span>1</span>
        <span>{Math.ceil(month.days.length / 2)}</span>
        <span>{month.days.length}</span>
      </div>
      <figcaption className="mt-5 rounded-2xl bg-surface-hover px-4 py-3.5">
        <p className="text-[14px] text-ink-soft">{dateLabel}</p>
        <p className="mt-0.5 flex items-baseline justify-between text-[18px] font-medium">
          <span>
            {day.trips} {day.trips === 1 ? "trip" : "trips"} · {day.minutes} min
          </span>
          <span className="text-positive">
            +{formatTokens(day.earned)} {TOKEN_SYMBOL}
          </span>
        </p>
      </figcaption>
    </figure>
  );
}

export function ActivityTab({ driver }: { driver: DriverSummary | null }) {
  const month = driver ? monthActivity(driver.history) : null;
  const monthName = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const activeDays = month ? month.days.filter((d) => d.trips > 0).length : 0;

  return (
    <div className="space-y-8">
      <SectionHead title={monthName} />

      {/*
       * Desktop: figures, the month's total and the breakdown stack in a left column while the
       * chart takes the rest of the width. Placement is explicit so the phone's reading order
       * (figures, total, chart, breakdown) stays untouched.
       */}
      <div className="space-y-8 lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-x-14 lg:gap-y-8 lg:space-y-0">
        <Figures
          items={[
            ["Trips", month?.trips],
            ["Minutes", month?.minutes],
            ["Events", month?.events],
          ]}
        />

        <div className="rounded-3xl bg-surface px-6 py-6 lg:col-start-1">
          <p className="text-[15px] text-ink-soft">Earned this month</p>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] lg:text-[48px]">
              {month ? formatTokens(month.earned) : "—"}
            </span>
            <span className="text-[18px] font-medium text-ink-soft">{TOKEN_SYMBOL}</span>
          </p>
        </div>

        {!month || month.trips === 0 ? (
          <div className="lg:col-start-2 lg:row-start-1">
            <Empty>{!month ? "Reading your ledger from Solana…" : "Nothing logged this month yet."}</Empty>
          </div>
        ) : (
          <>
            <div className="lg:col-start-2 lg:row-span-3 lg:row-start-1">
              <DayStrip month={month} />
            </div>
            <dl className="grid grid-cols-2 gap-y-3 rounded-3xl bg-surface px-6 py-5 text-[16px] lg:col-start-1">
              <dt className="text-ink-soft">Days driven</dt>
              <dd className="text-right font-medium">
                {activeDays} of {new Date().getDate()}
              </dd>
              <dt className="text-ink-soft">Per trip</dt>
              <dd className="text-right font-medium">
                {formatTokens(month.earned / month.trips)} {TOKEN_SYMBOL}
              </dd>
              <dt className="text-ink-soft">Per hour recorded</dt>
              <dd className="text-right font-medium">
                {month.minutes > 0 ? formatTokens((month.earned / month.minutes) * 60) : "—"} {TOKEN_SYMBOL}
              </dd>
            </dl>
          </>
        )}
      </div>
    </div>
  );
}
