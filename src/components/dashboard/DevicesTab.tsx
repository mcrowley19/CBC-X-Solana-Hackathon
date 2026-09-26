"use client";

import { devicesFromHistory, formatTokens, isOnline } from "@/lib/activity";
import { TOKEN_SYMBOL } from "@/lib/cluster";
import type { DriverSummary } from "@/lib/schemas";
import { DeviceRow, Empty, Figures, SectionHead } from "./ui";

/**
 * Our paired dashcam (PAIRED_DEVICES), plus any other camera that has uploaded a trip to this account,
 * from the device id each payout memo carries. Most recently seen first.
 */
export function DevicesTab({ driver }: { driver: DriverSummary | null }) {
  // The paired Pi is listed even before the ledger loads (or if it fails to).
  const devices = devicesFromHistory(driver?.history ?? []);
  const online = devices.filter((d) => isOnline(d)).length;

  return (
    <div className="space-y-6">
      <SectionHead title="Connected devices" />

      <Figures
        items={[
          ["Devices", devices.length],
          ["Online", driver ? online : undefined],
          ["Minutes", driver ? devices.reduce((sum, d) => sum + d.minutes, 0).toLocaleString() : undefined],
        ]}
      />

      {devices.length === 0 ? (
        <Empty>No dashcams yet. A dashcam shows up here once its first trip is paid out.</Empty>
      ) : (
        <ul className="space-y-3 lg:space-y-4">
          {devices.map((device) => (
            <li key={device.id} className="rounded-3xl bg-surface px-5 pb-4 pt-5">
              <div className="flex items-center gap-3.5 [&>span:first-child]:bg-surface-hover">
                <DeviceRow device={device} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2.5 text-[15px]">
                <div className="rounded-2xl bg-surface-hover px-4 py-3">
                  <dt className="text-ink-soft">Road events</dt>
                  <dd className="mt-0.5 text-[18px] font-medium">{device.events.toLocaleString()}</dd>
                </div>
                <div className="rounded-2xl bg-surface-hover px-4 py-3">
                  <dt className="text-ink-soft">Earned</dt>
                  <dd className="mt-0.5 text-[18px] font-medium">
                    <span className="text-positive">+{formatTokens(device.earned)}</span>{" "}
                    <span className="text-[15px] text-ink-soft">{TOKEN_SYMBOL}</span>
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
