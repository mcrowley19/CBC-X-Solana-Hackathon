"use client";

import { useState } from "react";
import {
  devicesFromHistory,
  formatBalance,
  formatTokens,
  isThisWeek,
  monthActivity,
  tripTitle,
} from "@/lib/activity";
import { TOKEN_SYMBOL } from "@/lib/cluster";
import type { DriverSummary, RewardRecord } from "@/lib/schemas";
import type { Tab } from "./TopNav";
import { TripDetail } from "./TripDetail";
import { Chevron, DeviceRow, ICON_CIRCLE, ICON_CIRCLE_ACTIVE, Icon, NOTICE, Row, SkeletonRow } from "./ui";

type Filter = "all" | "week" | "events" | "favorites";

const FILTERS: { id: Exclude<Filter, "favorites">; label: string }[] = [
  { id: "all", label: "All" },
  { id: "week", label: "This week" },
  { id: "events", label: "Events" },
];

function matches(record: RewardRecord, filter: Filter): boolean {
  if (filter === "week" && !isThisWeek(record)) return false;
  if (filter === "events" && record.e < 1) return false;
  return true;
}

export function HomeTab({
  driver,
  loading,
  error,
  onNavigate,
}: {
  driver: DriverSummary | null;
  loading: boolean;
  error: string | null;
  onNavigate: (tab: Tab) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  // The trip that's unfolded to show its route, by transaction signature.
  const [open, setOpen] = useState<string | null>(null);

  const month = driver ? monthActivity(driver.history) : null;
  const devices = devicesFromHistory(driver?.history ?? []);

  const candidates = (driver?.history ?? [])
    .map((record) => ({ record, title: tripTitle(record) }))
    .filter(({ record }) => matches(record, filter));
  // Favourites stands in as the rider's best trips until trips can be starred.
  if (filter === "favorites") candidates.sort((a, b) => b.record.r - a.record.r);
  // Four trips on a phone; desktop has room for six (rows five and six are hidden below `lg`).
  const trips = candidates.slice(0, 6);

  return (
    <div>
      <section className="rise rounded-3xl bg-surface px-6 pb-6 pt-9 text-center lg:px-7 lg:pb-7 lg:pt-8 lg:text-left">
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

      {error && (
        <div className="mt-4">
          <p className={NOTICE} role="alert">
            {error}
          </p>
        </div>
      )}

      <section
        className="rise rise-1 pt-9 lg:pt-12"
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
            {trips.map(({ record, title }, i) => {
              const isOpen = open === record.signature;
              const panelId = `recent-${record.signature.slice(0, 8)}`;
              return (
                <li key={record.signature} className={i >= 4 ? "hidden lg:block" : undefined}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : record.signature)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="press flex w-full items-center gap-3.5 py-4 text-left"
                    aria-label={`${title}, ${record.m} min, +${formatTokens(record.r)} ${TOKEN_SYMBOL}. ${isOpen ? "Hide" : "Show"} route`}
                  >
                    <Row
                      icon={
                        <span className={isOpen ? ICON_CIRCLE_ACTIVE : ICON_CIRCLE}>
                          <Icon>
                            <circle cx="6" cy="18" r="2.5" />
                            <circle cx="18" cy="6" r="2.5" />
                            <path d="M8 16 16 8" />
                          </Icon>
                          <span
                            className={`absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-canvas text-[11px] font-bold text-canvas ${
                              isOpen ? "bg-ink" : "bg-accent"
                            }`}
                          >
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
                  </button>
                  {isOpen && <TripDetail record={record} id={panelId} />}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {devices.length > 0 && (
        <section className="rise rise-2 pt-5 lg:pt-12" aria-labelledby="devices">
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

      {/* Phone only: a floating shortcut to connected devices. */}
      <div className="fixed inset-x-0 bottom-[calc(24px+env(safe-area-inset-bottom))] z-30 lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-end px-5">
          <button
            type="button"
            onClick={() => onNavigate("devices")}
            aria-label="Connected devices"
            title="Connected devices"
            className="press flex size-[60px] flex-none items-center justify-center rounded-full bg-accent hover:bg-accent-deep"
          >
            <Icon size={26} stroke="#000" width={2.5}>
              <path d="M12 5v14M5 12h14" />
            </Icon>
          </button>
        </div>
      </div>
    </div>
  );
}
