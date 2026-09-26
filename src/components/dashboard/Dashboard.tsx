"use client";

import { useSyncExternalStore } from "react";
import { useDriver } from "@/hooks/useDriver";
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
 * Pill tabs across the top on small screens; from `lg` up a single top bar carries the tabs and
 * account. The URL hash tracks the open tab either way.
 */
export function Dashboard({ address }: { address?: string }) {
  const { driver, error, loading } = useDriver(address);
  const tab = useTab();

  function openTab(next: Tab) {
    if (next === tab) return;
    window.location.hash = next === "home" ? "" : next;
    window.scrollTo({ top: 0 });
  }

  return (
    <>
      {address && (
        <>
          <TopNav address={address} active={tab} onChange={openTab} />
          <DesktopNav address={address} active={tab} onChange={openTab} />
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
                  <HomeTab driver={driver} loading={loading} error={error} onNavigate={openTab} />
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
