"use client";

import { useState } from "react";
import type { DriveResult } from "@/hooks/useDriver";
import {
  devicesFromHistory,
  formatBalance,
  formatTokens,
  isThisWeek,
  monthActivity,
  tripTitle,
} from "@/lib/activity";
import { TOKEN_SYMBOL, explorerTx } from "@/lib/cluster";
import type { DriverSummary, RewardRecord } from "@/lib/schemas";
import type { Tab } from "./TopNav";
import { Chevron, DeviceRow, ICON_CIRCLE, Icon, LINK, NOTICE, Row, SkeletonRow } from "./ui";

type Filter = "all" | "week" | "events" | "favorites";

const FILTERS: { id: Exclude<Filter, "favorites">; label: string }[] = [
  { id: "all", label: "All" },
  { id: "week", label: "This week" },
  { id: "events", label: "Events" },
];

function DriveStatus({ result }: { result: DriveResult }) {
  if ("error" in result) return <>{result.error}</>;
  if (!result.paid) return <>Nothing to reward for that trip.</>;
  const minutes = Math.round((result.simulated?.durationSeconds ?? 0) / 60);
  return (
    <>
      Trip logged: {minutes} min, {result.simulated?.events.length ?? 0} events,{" "}
      <span className="text-positive">
        +{formatTokens(result.reward.total)} {TOKEN_SYMBOL}
      </span>
      .{" "}
      <a href={explorerTx(result.signature)} target="_blank" rel="noreferrer" className={LINK}>
        View transaction
      </a>
    </>
  );
}

function matches(record: RewardRecord, filter: Filter, query: string, title: string): boolean {
  if (filter === "week" && !isThisWeek(record)) return false;
  if (filter === "events" && record.e < 1) return false;
  if (!query) return true;
  const haystack = `${title} ${record.m} min ${record.e} events ${record.s} ${record.d ?? ""}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function HomeTab({
  driver,
  loading,
  driving,
  demoMode,
  error,
  lastDrive,
  onSimulate,
  query,
  onQuery,
  onNavigate,
}: {
  driver: DriverSummary | null;
  loading: boolean;
  driving: boolean;
  demoMode: boolean;
  error: string | null;
  lastDrive: DriveResult | null;
  query: string;
  onQuery: (query: string) => void;
  onSimulate: () => void;
  onNavigate: (tab: Tab) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const month = driver ? monthActivity(driver.history) : null;
  const devices = devicesFromHistory(driver?.history ?? []);

  const candidates = (driver?.history ?? [])
    .map((record) => ({ record, title: tripTitle(record) }))
    .filter(({ record, title }) => matches(record, filter, query.trim(), title));
  // Favourites stands in as the rider's best trips until trips can be starred.
  if (filter === "favorites") candidates.sort((a, b) => b.record.r - a.record.r);
  // Four trips on a phone; desktop has room for six (rows five and six are hidden below `lg`).
  const trips = candidates.slice(0, 6);

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start lg:gap-x-14">
      <section className="rise rounded-3xl bg-surface px-6 pb-6 pt-9 text-center lg:col-start-1 lg:px-7 lg:pb-7 lg:pt-8 lg:text-left">
        <p className="text-[15px] text-ink-soft">Current balance</p>
        <p className="mt-1.5 flex items-baseline justify-center gap-2 lg:justify-start">
          <span className="text-[48px] font-semibold leading-none tracking-[-0.03em] lg:text-[56px]">
            {driver ? formatBalance(driver.balance) : "—"}
          </span>
          <span className="text-[18px] font-medium text-ink-soft">{TOKEN_SYMBOL}</span>
        </p>
        <p className="mt-3 pb-3 text-[16px] text-ink-soft lg:pb-0">
          {month ? `+${formatBalance(month.earned)} earned this month.` : loading ? "Reading chain…" : " "}
        </p>
        {/* Desktop only: this month at a glance, inside the card. */}
        <dl className="mt-6 hidden grid-cols-3 gap-2.5 lg:grid">
          {(
            [
              ["Trips", month?.trips],
              ["Minutes", month?.minutes],
              ["Events", month?.events],
            ] as [string, number | undefined][]
          ).map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-surface-hover px-4 py-3.5">
              <dt className="text-[14px] text-ink-soft">{label}</dt>
              <dd className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em]">{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      {(error || lastDrive) && (
        <div className="mt-4 space-y-3 lg:col-start-1">
          {error && (
            <p className={NOTICE} role="alert">
              {error}
            </p>
          )}
          {lastDrive && (
            <p className={NOTICE} role="status">
              <DriveStatus result={lastDrive} />
            </p>
          )}
        </div>
      )}

      <section
        className="rise rise-1 pt-9 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:pt-0"
        aria-labelledby="recent-trips"
      >
        <div>
          <button
            type="button"
            id="recent-trips"
            onClick={() => onNavigate("trips")}
            className="flex items-center gap-1.5 text-[26px] font-semibold tracking-[-0.02em]"
          >
            Recent Trips
            <Chevron />
          </button>
        </div>

        <div
          className="no-scrollbar -mx-5 mt-[18px] flex gap-2.5 overflow-x-auto px-5 lg:mx-0 lg:px-0"
          role="group"
          aria-label="Filter trips"
        >
          <button
            type="button"
            aria-pressed={filter === "favorites"}
            aria-label="Best trips"
            onClick={() => setFilter("favorites")}
            className={`press flex size-12 flex-none items-center justify-center rounded-full ${
              filter === "favorites" ? "bg-ink text-canvas" : "bg-surface text-ink hover:bg-surface-hover"
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 21s-7-4.6-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.4-9 9-9 9z" />
            </svg>
          </button>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`press flex h-12 flex-none items-center rounded-full px-[22px] text-[16px] font-semibold ${
                filter === f.id ? "bg-ink text-canvas" : "bg-surface text-ink hover:bg-surface-hover"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {!driver ? (
          loading && (
            <div role="status" aria-label="Loading trips">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          )
        ) : trips.length === 0 ? (
          <p className="py-4 text-[16px] text-ink-soft">
            {driver.history.length === 0
              ? "No trips yet. Once your dashcam uploads a trip and it's annotated, it appears here."
              : "No trips match."}
          </p>
        ) : (
          <ol>
            {trips.map(({ record, title }, i) => (
              <li key={record.signature} className={i >= 4 ? "hidden lg:block" : undefined}>
                <a
                  href={explorerTx(record.signature)}
                  target="_blank"
                  rel="noreferrer"
                  className="press flex items-center gap-3.5 py-4"
                  aria-label={`${title}, ${record.m} min, +${formatTokens(record.r)} ${TOKEN_SYMBOL}. Open transaction`}
                >
                  <Row
                    icon={
                      <span className={ICON_CIRCLE}>
                        <Icon>
                          <circle cx="6" cy="18" r="2.5" />
                          <circle cx="18" cy="6" r="2.5" />
                          <path d="M8 16 16 8" />
                        </Icon>
                        <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-canvas bg-accent text-[11px] font-bold text-canvas">
                          {i + 1}
                        </span>
                      </span>
                    }
                    title={title}
                    meta={`${record.m} min · ${record.e} ${record.e === 1 ? "event" : "events"}`}
                    value={`+${formatTokens(record.r)}`}
                    sub={
                      driver.balance > 0 && (
                        <span className="text-positive">+{((record.r / driver.balance) * 100).toFixed(1)}%</span>
                      )
                    }
                  />
                </a>
              </li>
            ))}
          </ol>
        )}
      </section>

      {devices.length > 0 && (
        <section className="rise rise-2 pt-5 lg:col-start-1 lg:pt-8" aria-labelledby="devices">
          <button
            type="button"
            id="devices"
            onClick={() => onNavigate("devices")}
            className="flex items-center gap-1.5 text-[26px] font-semibold tracking-[-0.02em]"
          >
            Connected Devices
            <Chevron />
          </button>
          <ul>
            {devices.map((device) => (
              <li key={device.id} className="flex items-center gap-3.5 pb-1 pt-[18px]">
                <DeviceRow device={device} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Phone only: the sidebar carries search-free navigation and this action on desktop. */}
      <div className="fixed inset-x-0 bottom-[calc(24px+env(safe-area-inset-bottom))] z-30 lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3.5 px-5">
          <label className="flex h-[60px] min-w-0 flex-1 items-center gap-3 rounded-full bg-surface px-[22px] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
            <Icon stroke="var(--color-ink-placeholder)" width={2.5}>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </Icon>
            <input
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search trips"
              aria-label="Search trips"
              className="min-w-0 flex-1 bg-transparent text-[18px] text-ink outline-none placeholder:text-ink-placeholder"
            />
          </label>
          <button
            type="button"
            onClick={demoMode ? onSimulate : () => onNavigate("devices")}
            disabled={demoMode && driving}
            aria-label={demoMode ? (driving ? "Paying out…" : "Simulate a trip") : "Connected devices"}
            title={demoMode ? "Simulate a trip" : "Connected devices"}
            className="press flex size-[60px] flex-none items-center justify-center rounded-full bg-accent hover:bg-accent-deep disabled:opacity-50"
          >
            <span className={driving ? "animate-spin motion-reduce:animate-none" : ""}>
              <Icon size={26} stroke="#000" width={2.5}>
                <path d="M12 5v14M5 12h14" />
              </Icon>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
