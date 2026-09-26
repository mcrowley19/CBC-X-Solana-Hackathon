"use client";

import { useState, useSyncExternalStore } from "react";
import { useDriver } from "@/hooks/useDriver";
import { formatBalance } from "@/lib/activity";
import { ActivityTab } from "./ActivityTab";
import { DevicesTab } from "./DevicesTab";
import { HomeTab } from "./HomeTab";
import { DesktopNav, TABS, TopNav, type Tab } from "./TopNav";
import { TripsTab } from "./TripsTab";
import { NOTICE } from "./ui";

function isTab(value: string): value is Tab {
  return TABS.some((t) => t.id === value);
}

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function tabFromHash(): Tab {
  const hash = window.location.hash.slice(1);
  return isTab(hash) ? hash : "home";
}

/** The open tab lives in the URL hash, so the back button moves between tabs like a native app. */
function useTab(): Tab {
  return useSyncExternalStore(subscribeToHash, tabFromHash, () => "home");
}

/**
 * Concept: "Wallet" — a wallet app at phone width, and a web wallet on desktop.
 * Pill tabs across the top on small screens; from `lg` up a single top bar carries the tabs, trip
 * search, balance and account, and the content grows to a two-column layout. The URL hash tracks the
 * open tab either way.
 */
export function Dashboard({ demoMode, address }: { demoMode: boolean; address?: string }) {
  const { driver, error, lastDrive, loading, driving, simulateDrive } = useDriver(address);
  const tab = useTab();
  // Trip search is shared by the phone's bottom bar and the desktop top bar. It filters Home's trips.
  const [query, setQuery] = useState("");

  function openTab(next: Tab) {
    if (next === tab) return;
    window.location.hash = next === "home" ? "" : next;
    window.scrollTo({ top: 0 });
  }

  function search(next: string) {
    setQuery(next);
    openTab("home");
  }

  // In demo mode the desktop bar carries the same action as the phone's floating button.
  const action = demoMode ? (
    <button
      type="button"
      onClick={simulateDrive}
      disabled={driving}
      className="press flex h-12 items-center gap-2 whitespace-nowrap rounded-full bg-accent px-5 text-[16px] font-semibold text-canvas hover:bg-accent-deep disabled:opacity-50"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden
        className={driving ? "animate-spin motion-reduce:animate-none" : ""}
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      {driving ? "Paying out…" : "Simulate a trip"}
    </button>
  ) : null;

  return (
    <>
      {address && (
        <>
          <TopNav address={address} active={tab} onChange={openTab} />
          <DesktopNav
            address={address}
            active={tab}
            onChange={openTab}
            balance={driver ? formatBalance(driver.balance) : undefined}
            query={query}
            onQuery={search}
            action={action}
          />
        </>
      )}

      <main>
        <div className="mx-auto max-w-lg px-5 pb-28 pt-9 lg:max-w-6xl lg:px-8 lg:pb-16 lg:pt-8">
          {!address ? (
            <p className={NOTICE} role="alert">
              No account is set up yet. Set <code>DRIVER_WALLET</code> to the dashcam&rsquo;s payout address and restart
              the server.
            </p>
          ) : (
            <>
              {error && tab !== "home" && (
                <p className={`${NOTICE} mb-6`} role="alert">
                  {error}
                </p>
              )}
              <div id={`panel-${tab}`} role="tabpanel" key={tab}>
                {tab === "home" && (
                  <HomeTab
                    driver={driver}
                    loading={loading}
                    driving={driving}
                    demoMode={demoMode}
                    error={error}
                    lastDrive={lastDrive}
                    query={query}
                    onQuery={setQuery}
                    onSimulate={simulateDrive}
                    onNavigate={openTab}
                  />
                )}
                {tab === "trips" && <TripsTab driver={driver} />}
                {tab === "activity" && <ActivityTab driver={driver} />}
                {tab === "devices" && <DevicesTab driver={driver} />}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
