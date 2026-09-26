"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { TOKEN_SYMBOL } from "@/lib/cluster";
import { Icon } from "./ui";

export type Tab = "home" | "trips" | "activity" | "devices";

export const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "trips", label: "Trips" },
  { id: "activity", label: "Activity" },
  { id: "devices", label: "Connected devices" },
];

function shorten(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** The account badge: the wallet's first two characters. Tapping it goes back to the landing page. */
function WalletBadge({ address }: { address: string }) {
  return (
    <Link
      href="/"
      className="press flex size-12 flex-none items-center justify-center rounded-full bg-accent text-[15px] font-bold text-canvas"
      title={shorten(address)}
      aria-label={`Account ${shorten(address)}. Back to GoMile home`}
    >
      {address.slice(0, 2)}
    </Link>
  );
}

type NavProps = { address: string; active: Tab; onChange: (tab: Tab) => void };

/**
 * Phone and tablet: a horizontally scrolling pill row at the top. It bleeds off the right edge on
 * narrow screens. Hidden from the `lg` breakpoint up, where `DesktopNav` takes over.
 */
export function TopNav({ address, active, onChange }: NavProps) {
  return (
    <nav aria-label="Dashboard sections" className="mx-auto max-w-lg pt-[env(safe-area-inset-top)] lg:hidden">
      <div role="tablist" className="no-scrollbar flex items-center gap-2.5 overflow-x-auto pl-5 pr-5 pt-5">
        <WalletBadge address={address} />
        {TABS.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              onClick={() => onChange(tab.id)}
              className={`press flex h-12 flex-none items-center rounded-full px-6 text-[18px] font-medium ${
                selected ? "bg-accent text-canvas" : "bg-surface text-ink hover:bg-surface-hover"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Top-bar search. "/" focuses it from anywhere on the page, as in most web apps. */
function NavSearch({ query, onQuery }: { query: string; onQuery: (query: string) => void }) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.key !== "/" || target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      e.preventDefault();
      input.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <label className="flex h-12 min-w-48 max-w-xl flex-1 items-center gap-3 rounded-full bg-surface px-5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
      <Icon size={20} stroke="var(--color-ink-placeholder)" width={2.5}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </Icon>
      <input
        ref={input}
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search trips"
        aria-label="Search trips"
        className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-placeholder"
      />
      <kbd className="font-sans text-[14px] text-ink-placeholder" aria-hidden>
        /
      </kbd>
    </label>
  );
}

/**
 * Desktop: one bar across the top, like a web wallet. Logo and text tabs on the left, trip search in
 * the middle, then balance, the page's primary action and the account on the right. Only from `lg` up.
 */
export function DesktopNav({
  address,
  active,
  onChange,
  balance,
  query,
  onQuery,
  action,
}: NavProps & { balance?: string; query: string; onQuery: (query: string) => void; action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 hidden bg-canvas/90 backdrop-blur lg:block">
      <nav aria-label="Dashboard sections" className="mx-auto flex h-20 max-w-[1400px] items-center gap-8 px-8">
        <div className="flex flex-none items-center gap-7">
          <Link
            href="/"
            className="press flex size-10 flex-none items-center justify-center rounded-full bg-accent text-canvas"
            aria-label="GoMile home"
          >
            <Icon size={20} width={2.5}>
              <circle cx="6" cy="18" r="2.5" />
              <circle cx="18" cy="6" r="2.5" />
              <path d="M8 16 16 8" />
            </Icon>
          </Link>
          <div role="tablist" className="flex items-center gap-7">
            {TABS.map((tab) => {
              const selected = tab.id === active;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => onChange(tab.id)}
                  className={`whitespace-nowrap text-[18px] font-medium transition-colors ${
                    selected ? "text-accent" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 justify-center">
          <NavSearch query={query} onQuery={onQuery} />
        </div>

        <div className="flex flex-none items-center gap-2.5">
          <span className="hidden h-12 items-center gap-2 whitespace-nowrap rounded-full bg-surface px-5 text-[16px] font-medium xl:flex">
            {balance ?? "—"}
            <span className="text-ink-soft">{TOKEN_SYMBOL}</span>
          </span>
          {action}
          <Link
            href="/"
            className="press flex h-12 items-center gap-2.5 rounded-full bg-surface pl-1.5 pr-4 hover:bg-surface-hover"
            title={address}
            aria-label={`Account ${shorten(address)}. Back to GoMile home`}
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-canvas">
              {address.slice(0, 2)}
            </span>
            <span className="text-[15px] font-medium">{shorten(address)}</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
