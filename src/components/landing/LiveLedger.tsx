"use client";

import { useDriver } from "@/hooks/useDriver";
import { formatBalance, formatTokens, tripTitle } from "@/lib/activity";
import { CLUSTER_LABEL, TOKEN_SYMBOL, explorerAddress, explorerTx } from "@/lib/cluster";

/*
 * Proof it runs: the demo driver's ledger, read straight from the chain, and (in demo mode) a button
 * that pays a real devnet transfer while the judges watch.
 */

function short(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function LiveLedger({ wallet, demoMode }: { wallet?: string; demoMode: boolean }) {
  const { driver, error, loading, driving, lastDrive, simulateDrive, refresh } = useDriver(wallet);

  if (!wallet) {
    return (
      <p className="max-w-xl text-[15px] leading-relaxed text-white/50">
        Set <span className="font-mono text-white/70">DRIVER_WALLET</span> and the demo driver&rsquo;s live ledger appears here.
      </p>
    );
  }

  const figures: [string, string | undefined][] = [
    [`${TOKEN_SYMBOL} balance`, driver ? formatBalance(driver.balance) : undefined],
    ["Trips paid", driver ? String(driver.sessions) : undefined],
    ["Minutes", driver ? String(driver.totals.minutes) : undefined],
    ["Events", driver ? String(driver.totals.events) : undefined],
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-16">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">Driver</p>
        <a
          href={explorerAddress(wallet)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block font-mono text-[14px] underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white"
        >
          {short(wallet)}
        </a>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">Solana {CLUSTER_LABEL}</p>

        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-white/10 pt-6">
          {figures.map(([label, value]) => (
            <div key={label}>
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/50">{label}</dt>
              <dd className={`mt-1.5 font-mono text-2xl tabular-nums ${value === undefined ? "skeleton text-white/30" : ""}`}>
                {value ?? "—"}
              </dd>
            </div>
          ))}
        </dl>

        {demoMode && (
          <div className="mt-8">
            <button
              type="button"
              onClick={simulateDrive}
              disabled={driving}
              className="press inline-flex h-12 w-full items-center justify-center rounded-full bg-white px-6 text-[14px] font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-50"
            >
              {driving ? "Paying on-chain…" : "Simulate a drive, pay it now"}
            </button>
            <p className="mt-3 text-[13px] leading-relaxed text-white/45">
              Fakes the Pi finishing a trip, runs the reward maths and sends a real {TOKEN_SYMBOL} transfer on {CLUSTER_LABEL}.
            </p>
            {lastDrive && (
              <p className="mt-4 border-t border-white/10 pt-4 text-[14px] leading-relaxed" aria-live="polite">
                {"error" in lastDrive ? (
                  <span className="text-white/60">{lastDrive.error}</span>
                ) : !lastDrive.paid ? (
                  <span className="text-white/60">Nothing to reward for that trip.</span>
                ) : (
                  <>
                    Paid <span className="font-mono">+{formatTokens(lastDrive.reward.total)} {TOKEN_SYMBOL}</span>
                    {lastDrive.simulated && (
                      <span className="text-white/50">
                        {" "}
                        for {Math.round(lastDrive.simulated.durationSeconds / 60)} min and {lastDrive.simulated.events.length} events
                      </span>
                    )}
                    .{" "}
                    <a
                      href={explorerTx(lastDrive.signature)}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white"
                    >
                      View transaction
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">Latest payouts, read back from the memo program</p>
        {error ? (
          <p className="mt-4 text-[15px] leading-relaxed text-white/50">
            Couldn&rsquo;t reach the chain: {error}{" "}
            <button type="button" onClick={refresh} className="underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white">
              Try again
            </button>
          </p>
        ) : loading && !driver ? (
          <ul className="mt-4 divide-y divide-white/10 border-y border-white/10" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="skeleton flex items-center gap-4 py-3.5">
                <span className="h-3 w-28 bg-white/15" />
                <span className="h-3 flex-1 bg-white/10" />
                <span className="h-3 w-16 bg-white/15" />
              </li>
            ))}
          </ul>
        ) : driver && driver.history.length === 0 ? (
          <p className="mt-4 text-[15px] text-white/50">No payouts yet. Simulate a drive and the first one lands here.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
            {driver?.history.slice(0, 6).map((record) => (
              <li key={record.signature} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 py-3.5 sm:grid-cols-[150px_minmax(0,1fr)_auto_auto]">
                <span className="font-mono text-[13px] text-white/60">{tripTitle(record)}</span>
                <span className="col-span-2 text-[15px] sm:col-span-1">
                  {record.m} min, {record.e} event{record.e === 1 ? "" : "s"}
                  {record.d && <span className="text-white/40"> · {record.d}</span>}
                </span>
                <span className="font-mono text-[15px] tabular-nums">
                  +{formatTokens(record.r)} {TOKEN_SYMBOL}
                </span>
                <a
                  href={explorerTx(record.signature)}
                  target="_blank"
                  rel="noreferrer"
                  className="justify-self-end font-mono text-[12px] text-white/50 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-white"
                >
                  {short(record.signature)}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
