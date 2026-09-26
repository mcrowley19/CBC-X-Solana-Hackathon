/**
 * A drive's GPS track, squeezed small enough to ride along in the payout memo.
 *
 * The chain is our database, so the route has to fit in the same transaction as the transfer.
 * The phone track is simplified (Douglas-Peucker) until its Google-style encoded polyline fits
 * the byte budget the memo has left, and the dashboard decodes it again to draw the map.
 * Pure functions: safe to import from client or server.
 */

export type LatLng = { lat: number; lng: number };

/** Five decimals is about a metre, the same precision Google's encoder uses. */
const PRECISION = 1e5;

function encodeValue(value: number, out: string[]) {
  let v = value < 0 ? ~(value << 1) : value << 1;
  while (v >= 0x20) {
    out.push(String.fromCharCode((0x20 | (v & 0x1f)) + 63));
    v >>= 5;
  }
  out.push(String.fromCharCode(v + 63));
}

export function encodePolyline(points: LatLng[]): string {
  const out: string[] = [];
  let lastLat = 0;
  let lastLng = 0;
  for (const p of points) {
    const lat = Math.round(p.lat * PRECISION);
    const lng = Math.round(p.lng * PRECISION);
    encodeValue(lat - lastLat, out);
    encodeValue(lng - lastLng, out);
    lastLat = lat;
    lastLng = lng;
  }
  return out.join("");
}

/** Returns [] for anything that isn't a well-formed polyline instead of throwing. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  try {
    while (index < encoded.length) {
      for (const which of ["lat", "lng"] as const) {
        let result = 0;
        let shift = 0;
        let byte: number;
        do {
          if (index >= encoded.length) return [];
          byte = encoded.charCodeAt(index++) - 63;
          if (byte < 0 || byte > 0x3f) return [];
          result |= (byte & 0x1f) << shift;
          shift += 5;
        } while (byte >= 0x20);
        const delta = result & 1 ? ~(result >> 1) : result >> 1;
        if (which === "lat") lat += delta;
        else lng += delta;
      }
      const point = { lat: lat / PRECISION, lng: lng / PRECISION };
      if (Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) return [];
      points.push(point);
    }
  } catch {
    return [];
  }
  return points;
}

/** Planar coordinates in degrees with longitude scaled so a degree is the same length both ways. */
function plane(points: LatLng[]) {
  const mid = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const scale = Math.cos((mid * Math.PI) / 180) || 1e-6;
  return points.map((p) => ({ x: p.lng * scale, y: p.lat }));
}

function segmentDistance(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Douglas-Peucker: keeps the points that bend the line by more than `tolerance` degrees. */
export function simplify(points: LatLng[], tolerance: number): LatLng[] {
  if (points.length <= 2) return points;
  const flat = plane(points);
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let farthest = 0;
    let at = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance(flat[i], flat[first], flat[last]);
      if (d > farthest) {
        farthest = d;
        at = i;
      }
    }
    if (at !== -1 && farthest > tolerance) {
      keep[at] = true;
      stack.push([first, at], [at, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** The polyline's length once it's inside a JSON string: backslashes cost two bytes there. */
function jsonLength(encoded: string): number {
  return JSON.stringify(encoded).length - 2;
}

/**
 * Encodes a track so its JSON-escaped polyline is at most `maxChars` long, simplifying as much as
 * needed. Returns undefined when even the start and end don't fit, or the track has under two points.
 */
export function encodeRoute(points: LatLng[], maxChars: number): string | undefined {
  const clean = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (clean.length < 2 || maxChars < 4) return undefined;

  let candidate = simplify(clean, 1 / PRECISION);
  let encoded = encodePolyline(candidate);
  // Roughly a metre, then coarser each pass; 40 passes reach continent scale.
  let tolerance = 2 / PRECISION;
  for (let pass = 0; pass < 40 && jsonLength(encoded) > maxChars; pass++) {
    candidate = simplify(candidate, tolerance);
    encoded = encodePolyline(candidate);
    tolerance *= 1.5;
  }
  if (jsonLength(encoded) > maxChars) {
    encoded = encodePolyline([clean[0], clean[clean.length - 1]]);
  }
  return jsonLength(encoded) <= maxChars ? encoded : undefined;
}

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle length of the track in metres. */
export function routeDistanceMetres(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const la1 = (a.lat * Math.PI) / 180;
    const la2 = (b.lat * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    total += 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
  }
  return total;
}

/** "850 m" under a kilometre, otherwise "3.2 km". */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
}

export type FittedRoute = {
  /** SVG path data in pixel space. */
  d: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
};

/**
 * Scales the track to fit a width x height box with `pad` pixels of breathing room, preserving
 * its shape (north up). A route that's a single spot still gets a sensible centre.
 */
export function fitRoute(points: LatLng[], width: number, height: number, pad = 16): FittedRoute | null {
  if (points.length === 0) return null;
  const flat = plane(points);
  const xs = flat.map((p) => p.x);
  const ys = flat.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  // A zero span divides to Infinity and loses the min(); a single spot has no scale at all.
  const scale = spanX === 0 && spanY === 0 ? 0 : Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  const px = flat.map((p) => ({
    x: offsetX + (p.x - minX) * scale,
    // SVG y grows downward; latitude grows upward.
    y: offsetY + (maxY - p.y) * scale,
  }));
  const round = (n: number) => Math.round(n * 10) / 10;
  const d = px.map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)} ${round(p.y)}`).join(" ");
  return { d, start: px[0], end: px[px.length - 1] };
}

/** A directions link from where the drive started to where it ended. */
export function mapsLink(points: LatLng[]): string | null {
  if (points.length === 0) return null;
  const a = points[0];
  const b = points[points.length - 1];
  const fmt = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
  return `https://www.google.com/maps/dir/${fmt(a)}/${fmt(b)}`;
}
