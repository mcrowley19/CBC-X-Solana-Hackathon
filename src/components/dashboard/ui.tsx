/** Small shared pieces for the dashboard tabs. */
import type { ReactNode } from "react";
import { isOnline, timeAgo, type Device } from "@/lib/activity";

/** A status or error message: a filled rounded card. */
export const NOTICE = "rounded-2xl bg-surface px-5 py-4 text-[15px] text-ink";
export const LINK = "underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent";

/** A tab's heading, set like Home's section headings. */
export function SectionHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] lg:text-[32px]">{title}</h2>
      {aside}
    </div>
  );
}

/** A row of figures as filled tiles: label above, number below. */
export function Figures({ items }: { items: [label: string, value: ReactNode][] }) {
  return (
    <dl className="grid grid-cols-3 gap-2.5">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-2xl bg-surface px-4 py-3.5 lg:px-5 lg:py-4">
          <dt className="truncate text-[14px] text-ink-soft">{label}</dt>
          <dd className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em] lg:text-[26px]">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-[16px] text-ink-soft">{children}</p>;
}

export const ICON_CIRCLE = "relative flex size-12 flex-none items-center justify-center rounded-full bg-surface";

export function Icon({ size = 22, stroke = "currentColor", width = 2, children }: { size?: number; stroke?: string; width?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

export const Chevron = () => (
  <Icon size={20} width={2.5}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);

/** Icon, title and meta on the left, two figures on the right. Shared by trip and device rows. */
export function Row({ icon, title, meta, value, sub }: { icon: ReactNode; title: string; meta: string; value: string; sub: ReactNode }) {
  return (
    <>
      {icon}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[18px] font-semibold">{title}</div>
        <div className="mt-0.5 truncate text-[15px] text-ink-soft">{meta}</div>
      </div>
      <div className="text-right">
        <div className="text-[18px] font-medium">{value}</div>
        <div className="mt-0.5 text-[15px]">{sub}</div>
      </div>
    </>
  );
}

export function SkeletonRow() {
  return (
    <div className="skeleton flex items-center gap-3.5 py-4" aria-hidden>
      <span className="size-12 flex-none rounded-full bg-surface" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 rounded-full bg-surface" />
        <div className="h-3.5 w-24 rounded-full bg-surface" />
      </div>
      <div className="h-4 w-14 rounded-full bg-surface" />
    </div>
  );
}

/** A dashcam: camera icon with an online dot, when it was last seen, and how much it has recorded. */
export function DeviceRow({ device }: { device: Device }) {
  const online = isOnline(device);
  return (
    <Row
      icon={
        <span className={ICON_CIRCLE}>
          <Icon>
            <rect x="3" y="7" width="18" height="12" rx="2" />
            <circle cx="12" cy="13" r="3.5" />
            <path d="M8 7l1.5-3h5L16 7" />
          </Icon>
          <span
            className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-canvas ${
              online ? "bg-positive" : "bg-ink-tertiary"
            }`}
            aria-label={online ? "Online" : "Offline"}
          />
        </span>
      }
      title={`Dashcam ${device.id}`}
      meta={device.lastSeen ? `${online ? "Recording" : "Idle"} · last seen ${timeAgo(device.lastSeen)}` : "Paired · no trips yet"}
      value={`${device.trips} ${device.trips === 1 ? "trip" : "trips"}`}
      sub={<span className="text-ink-soft">{device.minutes.toLocaleString()} min</span>}
    />
  );
}
