"use client";

import { useState } from "react";
import { formatTime, formatTokens, groupTripsByDay } from "@/lib/activity";
import { TOKEN_SYMBOL } from "@/lib/cluster";
import type { DriverSummary } from "@/lib/schemas";
import { TripDetail } from "./TripDetail";
import { Empty, Figures, ICON_CIRCLE, ICON_CIRCLE_ACTIVE, Icon, Row, SectionHead } from "./ui";

/** Every trip the chain has paid for, newest first, grouped by day, with running totals at the top. */
export function TripsTab({ driver }: { driver: DriverSummary | null }) {
  const groups = driver ? groupTripsByDay(driver.history) : [];
  // Which trip is unfolded, by transaction signature. One at a time keeps the day cards tidy.
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <SectionHead title="Every trip" />

      <Figures
        items={[
          ["Trips", driver?.sessions],
          ["Minutes", driver?.totals.minutes.toLocaleString()],
          [`${TOKEN_SYMBOL} earned`, driver ? formatTokens(driver.totals.earned) : undefined],
        ]}
      />

      {!driver ? (
        <Empty>Reading your ledger from Solana…</Empty>
      ) : groups.length === 0 ? (
        <Empty>No trips yet. Once your dashcam uploads a trip and it&rsquo;s annotated, the payout appears here.</Empty>
      ) : (
        <div className="space-y-6 lg:columns-2 lg:gap-4 lg:space-y-0">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label} className="lg:mb-4 lg:break-inside-avoid lg:rounded-3xl lg:bg-surface lg:px-6 lg:py-5">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[20px] font-semibold tracking-[-0.01em]">{group.label}</h3>
                <span className="text-[15px] text-positive">
                  +{formatTokens(group.earned)} {TOKEN_SYMBOL}
                </span>
              </div>
              <ol>
                {group.records.map((record) => {
                  const isOpen = open === record.signature;
                  const panelId = `trip-${record.signature.slice(0, 8)}`;
                  return (
                    <li key={record.signature}>
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : record.signature)}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        className="press flex w-full items-center gap-3.5 py-3.5 text-left"
                        aria-label={`${formatTime(record.blockTime)}, ${record.m} min, +${formatTokens(record.r)} ${TOKEN_SYMBOL}. ${isOpen ? "Hide" : "Show"} route`}
                      >
                        <Row
                          icon={
                            <span className={isOpen ? ICON_CIRCLE_ACTIVE : `${ICON_CIRCLE} lg:bg-surface-hover`}>
                              <Icon>
                                <circle cx="6" cy="18" r="2.5" />
                                <circle cx="18" cy="6" r="2.5" />
                                <path d="M8 16 16 8" />
                              </Icon>
                            </span>
                          }
                          title={formatTime(record.blockTime)}
                          meta={`${record.m} min · ${record.e} ${record.e === 1 ? "event" : "events"}${record.d ? ` · ${record.d}` : ""}`}
                          value={`+${formatTokens(record.r)}`}
                          sub={<span className="text-ink-soft">{record.p ? "Route" : `Tx ${record.signature.slice(0, 4)}`}</span>}
                        />
                      </button>
                      {isOpen && <TripDetail record={record} id={panelId} className="lg:bg-surface-hover" />}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
