"use client";

import { formatTime, formatTokens, groupTripsByDay } from "@/lib/activity";
import { TOKEN_SYMBOL, explorerTx } from "@/lib/cluster";
import type { DriverSummary } from "@/lib/schemas";
import { Empty, Figures, ICON_CIRCLE, Icon, Row, SectionHead } from "./ui";

/** Every trip the chain has paid for, newest first, grouped by day, with running totals at the top. */
export function TripsTab({ driver }: { driver: DriverSummary | null }) {
  const groups = driver ? groupTripsByDay(driver.history) : [];

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
                {group.records.map((record) => (
                  <li key={record.signature}>
                    <a
                      href={explorerTx(record.signature)}
                      target="_blank"
                      rel="noreferrer"
                      className="press flex items-center gap-3.5 py-3.5"
                      aria-label={`${formatTime(record.blockTime)}, ${record.m} min, +${formatTokens(record.r)} ${TOKEN_SYMBOL}. Open transaction`}
                    >
                      <Row
                        icon={
                          <span className={`${ICON_CIRCLE} lg:bg-surface-hover`}>
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
                        sub={<span className="text-ink-soft">Tx {record.signature.slice(0, 4)}</span>}
                      />
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
