"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";

const btn =
  "font-mono text-[12px] font-medium uppercase tracking-[0.14em] px-5 py-3 transition-colors";

export function shorten(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function ConnectButton({ primary = false }: { primary?: boolean }) {
  const { wallets, select, publicKey, disconnect, connecting } = useWallet();
  const [open, setOpen] = useState(false);
  const installed = wallets.filter((w) => w.readyState === WalletReadyState.Installed);

  const style = primary
    ? `${btn} bg-accent text-paper hover:bg-accent-deep`
    : `${btn} border border-ink/40 hover:border-ink hover:bg-ink hover:text-paper`;

  if (publicKey) {
    return (
      <button type="button" onClick={() => disconnect()} className={style} title="Disconnect">
        {shorten(publicKey.toBase58())} · Disconnect
      </button>
    );
  }

  if (installed.length === 0) {
    return (
      <a href="https://phantom.com/download" target="_blank" rel="noreferrer" className={style}>
        Install Phantom
      </a>
    );
  }

  if (installed.length === 1) {
    return (
      <button type="button" onClick={() => select(installed[0].adapter.name)} className={style} disabled={connecting}>
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={style} aria-expanded={open}>
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
      {open && (
        <ul className="absolute right-0 z-20 mt-2 min-w-full border border-ink bg-paper">
          {installed.map((w) => (
            <li key={w.adapter.name} className="border-t border-line first:border-t-0">
              <button
                type="button"
                onClick={() => {
                  select(w.adapter.name);
                  setOpen(false);
                }}
                className="block w-full px-5 py-3 text-left font-mono text-[12px] uppercase tracking-[0.12em] hover:bg-ink hover:text-paper"
              >
                {w.adapter.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
