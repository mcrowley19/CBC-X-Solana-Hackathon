"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiError, DriverSummary, SessionResult } from "@/lib/schemas";

export type DriveResult = (SessionResult & { simulated?: { durationSeconds: number; events: unknown[] } }) | ApiError;

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { cache: "no-store", ...init });
  const json = (await res.json()) as T | ApiError;
  if (!res.ok) throw new Error((json as ApiError).error ?? `Request failed (${res.status})`);
  return json as T;
}

/**
 * Loads a driver's balance and ledger, and exposes refresh / simulate actions.
 * Every result is tagged with the wallet it belongs to, so switching wallets never shows stale data.
 */
export function useDriver(address: string | undefined) {
  const [loaded, setLoaded] = useState<{ address: string; data: DriverSummary } | null>(null);
  const [failure, setFailure] = useState<{ address: string; message: string } | null>(null);
  const [lastDriveState, setLastDrive] = useState<{ address: string; result: DriveResult } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [driving, setDriving] = useState(false);

  const fetchSummary = useCallback(async (addr: string) => {
    try {
      setLoaded({ address: addr, data: await requestJson<DriverSummary>(`/api/drivers/${addr}`) });
      setFailure(null);
    } catch (e) {
      setFailure({ address: addr, message: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    requestJson<DriverSummary>(`/api/drivers/${address}`)
      .then((data) => !cancelled && setLoaded({ address, data }))
      .catch((e: Error) => !cancelled && setFailure({ address, message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [address]);

  async function refresh() {
    if (!address) return;
    setRefreshing(true);
    await fetchSummary(address);
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
      setLastDrive({ address, result: (await res.json()) as DriveResult });
      await fetchSummary(address);
    } catch (e) {
      setLastDrive({ address, result: { error: (e as Error).message } });
    } finally {
      setDriving(false);
    }
  }

  const driver = loaded && loaded.address === address ? loaded.data : null;
  const error = failure && failure.address === address ? failure.message : null;
  const lastDrive = lastDriveState && lastDriveState.address === address ? lastDriveState.result : null;

  return {
    driver,
    error,
    lastDrive,
    loading: refreshing || (!!address && !driver && !error),
    driving,
    refresh,
    simulateDrive,
  };
}
