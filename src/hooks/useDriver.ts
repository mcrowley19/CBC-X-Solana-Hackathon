"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiError, DriverSummary } from "@/lib/schemas";

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { cache: "no-store", ...init });
  const json = (await res.json()) as T | ApiError;
  if (!res.ok) throw new Error((json as ApiError).error ?? `Request failed (${res.status})`);
  return json as T;
}

/**
 * Loads a driver's balance and ledger, and exposes a refresh action.
 * Every result is tagged with the wallet it belongs to, so switching wallets never shows stale data.
 */
export function useDriver(address: string | undefined) {
  const [loaded, setLoaded] = useState<{ address: string; data: DriverSummary } | null>(null);
  const [failure, setFailure] = useState<{ address: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const driver = loaded && loaded.address === address ? loaded.data : null;
  const error = failure && failure.address === address ? failure.message : null;

  return {
    driver,
    error,
    loading: refreshing || (!!address && !driver && !error),
    refresh,
  };
}
