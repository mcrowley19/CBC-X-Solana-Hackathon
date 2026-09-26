"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useDriver, type DriveResult } from "@/hooks/useDriver";
import { CLUSTER_LABEL, TOKEN_SYMBOL, explorerTx } from "@/lib/cluster";
import { ConnectButton } from "./ConnectButton";
import { Odometer } from "./Odometer";
import { TripTable } from "./TripTable";

const BUTTON = "px-5 py-3 font-mono text-[12px] font-medium uppercase tracking-[0.14em] transition-colors";
const LINK = "underline decoration-ink-tertiary underline-offset-4 hover:text-accent hover:decoration-accent";

function DriveStatus({ result }: { result: DriveResult }) {
  if ("error" in result) return <span className="text-accent">{result.error}</span>;
  if (!result.paid) return <span className="text-accent">Nothing to reward for that drive.</span>;
  const minutes = Math.round((result.simulated?.durationSeconds ?? 0) / 60);
  return (
    <>
      Drive logged: {minutes} min, {result.simulated?.events.length ?? 0} events,{" "}
      <span className="text-accent">
        +{result.reward.total} {TOKEN_SYMBOL}
      </span>
      .{" "}
      <a href={explorerTx(result.signature)} target="_blank" rel="noreferrer" className={LINK}>
        View transaction
      </a>
    </>
  );
}

/**
 * Renders two grid children of the hero in page.tsx: the balance column, and a
 * full-width trip ledger row beneath it. Both share the connected driver's data.
 */
export function Ledger({ demoMode }: { demoMode: boolean }) {
  const { publicKey } = useWallet();
  const address = publicKey?.toBase58();
  const { driver, error, lastDrive, loading, driving, refresh, simulateDrive } = useDriver(address);

  return (
    <>
      <div className="rise rise-2 border-t border-ink pt-6 lg:mt-24">
        <p className="kicker mb-4">{address ? `Balance on ${CLUSTER_LABEL}` : "Not connected"}</p>
        <Odometer value={driver?.balance ?? 0} />
        <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-tertiary">{TOKEN_SYMBOL}</p>

        {address ? (
          <dl className="mt-8 grid grid-cols-3 border-t border-line pt-4 font-mono text-sm">
            {[
              ["Drives", driver?.sessions],
              ["Minutes", driver?.totals.minutes],
              ["Events", driver?.totals.events],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="kicker !text-[11px] !text-ink-tertiary">{label}</dt>
                <dd className="mt-1 text-xl tabular-nums">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="mt-8">
            <p className="mb-5 max-w-[34ch] text-ink-soft">
              Connect the wallet you registered on your dashcam to see what you&rsquo;ve earned.
            </p>
            <ConnectButton primary />
          </div>
        )}
      </div>

      <section id="ledger" className="col-span-full mt-[clamp(4rem,8vw,7rem)] lg:pl-[8%]">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink pb-5">
          <div>
            <p className="kicker mb-2">01 — Trip ledger</p>
            <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-light leading-none tracking-[-0.015em]">
              Every drive, on the record.
            </h2>
          </div>
          {address && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className={`${BUTTON} border border-ink/40 hover:border-ink hover:bg-ink hover:text-paper disabled:opacity-50`}
              >
                {loading ? "Reading chain…" : "Refresh"}
              </button>
              {demoMode && (
                <button
                  type="button"
                  onClick={simulateDrive}
                  disabled={driving}
                  className={`${BUTTON} bg-accent text-paper hover:bg-accent-deep disabled:opacity-60`}
                >
                  {driving ? "Paying out…" : "Simulate a drive"}
                </button>
              )}
            </div>
          )}
        </div>

        {lastDrive && (
          <p className="border-b border-line py-4 font-mono text-sm" role="status">
            <DriveStatus result={lastDrive} />
          </p>
        )}

        {error && (
          <p className="py-4 font-mono text-sm text-accent" role="alert">
            {error}
          </p>
        )}

        {!address ? (
          <p className="py-10 text-ink-soft">Connect a wallet to read its ledger from Solana.</p>
        ) : driver?.history.length === 0 ? (
          <p className="py-10 text-ink-soft">
            No drives yet. Once your dashcam uploads a trip and it&rsquo;s annotated, the payout appears here.
          </p>
        ) : (
          <TripTable records={driver?.history ?? []} />
        )}
      </section>
    </>
  );
}
