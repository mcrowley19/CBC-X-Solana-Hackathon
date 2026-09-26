/**
 * Pure helpers that turn the on-chain reward history into what the dashboard shows:
 * this month's activity, and trips grouped by the day they were paid.
 * All dates are in the browser's local time, since that's the rider's own day.
 */
import type { RewardRecord } from "./schemas";

export type DayActivity = { day: number; trips: number; minutes: number; events: number; earned: number };

export type MonthActivity = {
  year: number;
  /** 0-based, like Date#getMonth. */
  month: number;
  trips: number;
  minutes: number;
  events: number;
  earned: number;
  /** One entry per calendar day of the month, index 0 = the 1st. */
  days: DayActivity[];
  /** 1-based day of the month with the highest earnings, or null if nothing was earned. */
  bestDay: number | null;
};

function recordDate(record: RewardRecord): Date | null {
  return record.blockTime ? new Date(record.blockTime * 1000) : null;
}

export function monthActivity(history: RewardRecord[], now = new Date()): MonthActivity {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: DayActivity[] = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    trips: 0,
    minutes: 0,
    events: 0,
    earned: 0,
  }));

  for (const record of history) {
    const date = recordDate(record);
    if (!date || date.getFullYear() !== year || date.getMonth() !== month) continue;
    const day = days[date.getDate() - 1];
    day.trips += 1;
    day.minutes += record.m;
    day.events += record.e;
    day.earned += record.r;
  }

  const totals = days.reduce(
    (acc, d) => ({
      trips: acc.trips + d.trips,
      minutes: acc.minutes + d.minutes,
      events: acc.events + d.events,
      earned: acc.earned + d.earned,
    }),
    { trips: 0, minutes: 0, events: 0, earned: 0 },
  );

  let bestDay: number | null = null;
  for (const d of days) {
    if (d.earned > 0 && (bestDay === null || d.earned > days[bestDay - 1].earned)) bestDay = d.day;
  }

  return { year, month, ...totals, days, bestDay };
}

export type DayGroup = { key: string; label: string; records: RewardRecord[]; earned: number };

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayLabel(date: Date, now: Date): string {
  const diffDays = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/** Groups trips by the local day they were paid, newest day first. Unconfirmed trips go in a "Pending" group on top. */
export function groupTripsByDay(history: RewardRecord[], now = new Date()): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  const sorted = [...history].sort((a, b) => (b.blockTime ?? Infinity) - (a.blockTime ?? Infinity));

  for (const record of sorted) {
    const date = recordDate(record);
    const key = date ? startOfDay(date).toISOString() : "pending";
    const label = date ? dayLabel(date, now) : "Pending";
    const group = groups.get(key) ?? { key, label, records: [], earned: 0 };
    group.records.push(record);
    group.earned += record.r;
    groups.set(key, group);
  }

  return [...groups.values()];
}

export function formatTime(blockTime: number | null): string {
  if (!blockTime) return "pending";
  return new Date(blockTime * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Whole tokens with thousands separators; decimals only when there are any. */
export function formatTokens(amount: number): string {
  return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** "Today 08:42", "Yesterday 17:05", "24 Sept 18:20", or "Pending" for an unconfirmed trip. */
export function tripTitle(record: RewardRecord, now = new Date()): string {
  const date = recordDate(record);
  return date ? `${dayLabel(date, now)} ${formatTime(record.blockTime)}` : "Pending";
}

/** Trips paid in the last seven days, counting an unconfirmed trip as recent. */
export function isThisWeek(record: RewardRecord, now = new Date()): boolean {
  return !record.blockTime || now.getTime() / 1000 - record.blockTime <= 7 * 86_400;
}

/** Balance with exactly two decimals, e.g. "1,284.50". */
export function formatBalance(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "just now", "2 min ago", "3 h ago", "5 days ago". */
export function timeAgo(blockTime: number, now = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() / 1000 - blockTime) / 60));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export type Device = { id: string; trips: number; minutes: number; events: number; earned: number; lastSeen: number | null };

/**
 * Our dashcam, always listed even before its first paid trip. Must match DEVICE_ID on the Pi
 * (the annotation service defaults to "pi-01").
 */
export const PAIRED_DEVICES = ["pi-01"];

/**
 * The paired dashcams plus any other device that has uploaded trips, from the device id in each
 * payout memo. Most recently seen first; devices with no trips yet go last.
 */
export function devicesFromHistory(history: RewardRecord[], paired: string[] = PAIRED_DEVICES): Device[] {
  const devices = new Map<string, Device>(
    paired.map((id) => [id, { id, trips: 0, minutes: 0, events: 0, earned: 0, lastSeen: null }]),
  );
  for (const record of history) {
    if (!record.d) continue;
    const device = devices.get(record.d) ?? { id: record.d, trips: 0, minutes: 0, events: 0, earned: 0, lastSeen: null };
    device.trips += 1;
    device.minutes += record.m;
    device.events += record.e;
    device.earned += record.r;
    if (record.blockTime && (device.lastSeen === null || record.blockTime > device.lastSeen)) device.lastSeen = record.blockTime;
    devices.set(record.d, device);
  }
  return [...devices.values()].sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));
}

/** A dashcam counts as online if it uploaded a trip within the last day. */
export function isOnline(device: Device, now = new Date()): boolean {
  return device.lastSeen !== null && now.getTime() / 1000 - device.lastSeen <= 86_400;
}
