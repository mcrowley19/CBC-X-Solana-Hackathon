"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ConnectButton } from "./ConnectButton";

const SYMBOL = process.env.NEXT_PUBLIC_TOKEN_SYMBOL ?? "MILE";

type Record = { s: string; d?: string; m: number; e: number; r: number; signature: string; blockTime: number | null };
type Driver = {
  balance: number;
  sessions: number;
  totals: { minutes: number; events: number; earned: number };
  history: Record[];
};
type DriveResult = {
  paid?: boolean;
  signature?: string;
  error?: string;
  reward?: { total: number };
  simulated?: { durationSeconds: number; events: unknown[] };
};

function Odometer({ value }: { value: number }) {
  const [whole, dec] = value.toFixed(2).split(".");
  const digits = whole.padStart(6, "0");
  return (
    <div className="odometer inline-flex border border-ink font-mono text-[clamp(2.25rem,5vw,3.5rem)] leading-none tabular-nums">
      {digits.split("").map((d, i) => (
        <span key={`w${i}`} className="py-3">{d}</span>
      ))}
      {dec.split("").map((d, i) => (
        <span key={`d${i}`} className="dec py-3">{d}</span>
      ))}
    </div>
  );
}

async function fetchDriver(address: string): Promise<Driver> {
  const res = await fetch(`/api/drivers/${address}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to load");
  return json;
}

function formatDate(ts: number | null) {
  if (!ts) return "pending";
  return new Date(ts * 1000).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function Ledger({ demoMode }: { demoMode: boolean }) {
  const { publicKey } = useWallet();
  const address = publicKey?.toBase58();
  // Results are tagged with the wallet they belong to, so switching wallets never shows stale data.
  const [loaded, setLoaded] = useState<{ address: string; data: Driver } | null>(null);
  const [errorState, setError] = useState<{ address: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [driving, setDriving] = useState(false);
  const [lastDriveState, setLastDrive] = useState<(DriveResult & { address: string }) | null>(null);

  const driver = loaded && loaded.address === address ? loaded.data : null;
  const error = errorState && errorState.address === address ? errorState.message : null;
  const lastDrive = lastDriveState && lastDriveState.address === address ? lastDriveState : null;
  const loading = refreshing || (!!address && !driver && !error);

  const load = useCallback(async (addr: string) => {
    try {
      setLoaded({ address: addr, data: await fetchDriver(addr) });
      setError(null);
    } catch (e) {
      setError({ address: addr, message: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetchDriver(address)
      .then((data) => !cancelled && setLoaded({ address, data }))
      .catch((e) => !cancelled && setError({ address, message: (e as Error).message }));
    return () => {
      cancelled = true;
    };
  }, [address]);

  async function refresh() {
    if (!address) return;
    setRefreshing(true);
    await load(address);
    setRefreshing(false);
  }

  async function simulateDrive() {
    if (!address) return;
    setDriving(true);
    setLastDrive(null);
    try {
      const res = await fetch("/api/demo/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });
      setLastDrive({ ...(await res.json()), address });
      await load(address);
    } finally {
      setDriving(false);
    }
  }

  return (
    <>
      {/* Balance column of the hero */}
      <div className="rise rise-2 border-t border-ink pt-6 lg:mt-24">
        <p className="kicker mb-4">{address ? "Balance on devnet" : "Not connected"}</p>
        <Odometer value={driver?.balance ?? 0} />
        <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-tertiary">{SYMBOL}</p>

        {address ? (
          <dl className="mt-8 grid grid-cols-3 border-t border-line pt-4 font-mono text-sm">
            {[
              ["Drives", driver?.sessions ?? "—"],
              ["Minutes", driver?.totals.minutes ?? "—"],
              ["Events", driver?.totals.events ?? "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="kicker !text-[11px] !text-ink-tertiary">{k}</dt>
                <dd className="mt-1 text-xl tabular-nums">{v}</dd>
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

      {/* Full-width row beneath the hero grid (see page.tsx) */}
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
                className="border border-ink/40 px-5 py-3 font-mono text-[12px] font-medium uppercase tracking-[0.14em] transition-colors hover:border-ink hover:bg-ink hover:text-paper disabled:opacity-50"
              >
                {loading ? "Reading chain…" : "Refresh"}
              </button>
              {demoMode && (
                <button
                  type="button"
                  onClick={simulateDrive}
                  disabled={driving}
                  className="bg-accent px-5 py-3 font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent-deep disabled:opacity-60"
                >
                  {driving ? "Paying out…" : "Simulate a drive"}
                </button>
              )}
            </div>
          )}
        </div>

        {lastDrive && (
          <p className="border-b border-line py-4 font-mono text-sm" role="status">
            {lastDrive.paid && lastDrive.signature ? (
              <>
                Drive logged: {Math.round((lastDrive.simulated?.durationSeconds ?? 0) / 60)} min,{" "}
                {lastDrive.simulated?.events.length ?? 0} events,{" "}
                <span className="text-accent">+{lastDrive.reward?.total} {SYMBOL}</span>.{" "}
                <a
                  href={`https://explorer.solana.com/tx/${lastDrive.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-ink-tertiary underline-offset-4 hover:text-accent hover:decoration-accent"
                >
                  View transaction
                </a>
              </>
            ) : (
              <span className="text-accent">{lastDrive.error ?? "Nothing to reward for that drive."}</span>
            )}
          </p>
        )}

        {error && <p className="py-4 font-mono text-sm text-accent">{error}</p>}

        {!address ? (
          <p className="py-10 text-ink-soft">Connect a wallet to read its ledger from Solana.</p>
        ) : driver && driver.history.length === 0 ? (
          <p className="py-10 text-ink-soft">
            No drives yet. Once your dashcam uploads a trip and it&rsquo;s annotated, the payout appears here.
          </p>
        ) : (
          <ol>
            <li className="hidden grid-cols-[1.2fr_2fr_0.8fr_0.8fr_1fr_0.6fr] gap-4 py-3 md:grid">
              {["Date", "Session", "Minutes", "Events", SYMBOL, "Tx"].map((h, i) => (
                <span key={h} className={`kicker !text-[11px] !text-ink-tertiary ${i >= 2 ? "text-right" : ""}`}>
                  {h}
                </span>
              ))}
            </li>
            {driver?.history.map((r) => (
              <li
                key={r.signature}
                className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line py-4 font-mono text-sm md:grid-cols-[1.2fr_2fr_0.8fr_0.8fr_1fr_0.6fr] md:items-baseline"
              >
                <span className="text-ink-soft">{formatDate(r.blockTime)}</span>
                <span className="truncate text-right md:text-left">{r.s}</span>
                <span className="md:text-right"><span className="text-ink-tertiary md:hidden">min </span>{r.m}</span>
                <span className="text-right"><span className="text-ink-tertiary md:hidden">events </span>{r.e}</span>
                <span className="text-accent md:text-right">+{r.r.toLocaleString()}</span>
                <a
                  href={`https://explorer.solana.com/tx/${r.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-right underline decoration-ink-tertiary underline-offset-4 hover:text-accent hover:decoration-accent"
                >
                  {r.signature.slice(0, 4)}
                </a>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
