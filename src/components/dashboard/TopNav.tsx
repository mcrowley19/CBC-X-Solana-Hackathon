"use client";

import Link from "next/link";
import type { ReactNode } from "react";

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

/**
 * Desktop: one bar across the top, like a web wallet. Logo and text tabs on the left, then the page's
 * primary action and the account on the right. Only from `lg` up.
 */
export function DesktopNav({
  address,
  active,
  onChange,
  action,
}: NavProps & { action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 hidden bg-canvas/90 backdrop-blur lg:block">
      <nav aria-label="Dashboard sections" className="mx-auto flex h-20 max-w-[1400px] items-center gap-8 px-8">
        <div className="flex flex-none items-center gap-7">
          {/* The same wordmark as the landing page header. */}
          <Link
            href="/"
            className="flex-none text-[20px] font-medium text-ink transition-colors hover:text-accent"
            aria-label="GoMile home"
          >
            GoMile
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
                  className={`whitespace-nowrap text-[15px] font-medium transition-colors ${
                    selected ? "text-accent" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ml-auto flex flex-none items-center gap-2.5">
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
