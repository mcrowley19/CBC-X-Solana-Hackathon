"use client";

import { explorerTx } from "@/lib/cluster";
import { decodePolyline, fitRoute, formatDistance, mapsLink, routeDistanceMetres, type LatLng } from "@/lib/route";
import type { RewardRecord } from "@/lib/schemas";
import { LINK } from "./ui";

const MAP_W = 320;
const MAP_H = 180;

/**
 * The route as a line on a black card: north up, fitted to the box. No tiles, no keys, no network;
 * the whole track came out of the payout memo.
 */
export function RouteMap({ points }: { points: LatLng[] }) {
  const fitted = fitRoute(points, MAP_W, MAP_H, 20);
  if (!fitted) return null;
  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      className="block aspect-video w-full rounded-2xl bg-canvas"
      role="img"
      aria-label={`Route travelled, ${formatDistance(routeDistanceMetres(points))}`}
    >
      {/* A faint grid so the black reads as a map rather than a hole. */}
      <g stroke="var(--color-line)" strokeWidth="1">
        {[1, 2, 3].map((i) => (
          <line key={`v${i}`} x1={(i * MAP_W) / 4} y1="0" x2={(i * MAP_W) / 4} y2={MAP_H} />
        ))}
        {[1, 2].map((i) => (
          <line key={`h${i}`} x1="0" y1={(i * MAP_H) / 3} x2={MAP_W} y2={(i * MAP_H) / 3} />
        ))}
      </g>
      <path
        d={fitted.d}
        pathLength={1}
        className="route-draw"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={fitted.start.x} cy={fitted.start.y} r="4.5" fill="var(--color-canvas)" stroke="var(--color-ink)" strokeWidth="2.5" />
      <circle cx={fitted.end.x} cy={fitted.end.y} r="5" fill="var(--color-accent)" />
    </svg>
  );
}

/**
 * What opens under a trip row: the route, the drive's figures, and where to look it up.
 * `className` sets the panel's tone where it sits on a surface already (the desktop trips cards).
 */
export function TripDetail({ record, id, className = "" }: { record: RewardRecord; id: string; className?: string }) {
  const points = record.p ? decodePolyline(record.p) : [];
  const hasRoute = points.length >= 2;
  const directions = hasRoute ? mapsLink(points) : null;

  return (
    <div id={id} className={`unfold mb-2 rounded-3xl bg-surface p-3 ${className}`}>
      {hasRoute ? (
        <RouteMap points={points} />
      ) : (
        <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl bg-canvas px-6 text-center">
          <p className="text-[16px] font-medium">No route for this trip</p>
          <p className="mt-1 text-[14px] text-ink-soft">
            The dashcam didn&rsquo;t get a GPS track from the phone for this drive.
          </p>
        </div>
      )}

      <dl className="mt-3 grid grid-cols-3 gap-2.5">
        {(
          [
            ["Distance", hasRoute ? formatDistance(routeDistanceMetres(points)) : "—"],
            ["Duration", `${record.m} min`],
            ["Events", record.e],
          ] as [string, string | number][]
        ).map(([label, value]) => (
          <div key={label} className="px-2 py-1">
            <dt className="text-[13px] text-ink-soft">{label}</dt>
            <dd className="text-[17px] font-semibold tracking-[-0.01em]">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-2 flex items-center justify-between gap-4 px-2 pb-1 text-[15px] text-ink-soft">
        {directions ? (
          <a href={directions} target="_blank" rel="noreferrer" className={LINK}>
            Open in Maps
          </a>
        ) : (
          <span />
        )}
        <a href={explorerTx(record.signature)} target="_blank" rel="noreferrer" className={LINK}>
          Transaction {record.signature.slice(0, 4)}…{record.signature.slice(-4)}
        </a>
      </div>
    </div>
  );
}
