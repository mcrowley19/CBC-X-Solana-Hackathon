import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { MultiPolygon, Polygon, Position } from "geojson";
import land110m from "world-atlas/land-110m.json";

/**
 * A land/sea lookup built by rasterising Natural Earth's 1:110m land polygons onto an
 * equirectangular bitmap. Everything on the globe that should only happen on land (the dotted
 * continents, the cars) asks this. Longitude is in degrees east, latitude in degrees north.
 */
export interface LandMask {
  width: number;
  height: number;
  isLand(lat: number, lon: number): boolean;
}

export function buildLandMask(width = 2048, height = 1024): LandMask {
  const topology = land110m as unknown as Topology<{ land: GeometryCollection }>;
  const geo = feature(topology, topology.objects.land);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas unavailable");

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#fff";

  const project = ([lon, lat]: Position): [number, number] => [
    ((lon + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ];

  const drawRing = (ring: Position[], lonOffset: number) => {
    ring.forEach(([lon, lat], i) => {
      const [x, y] = project([lon + lonOffset, lat]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  };

  /**
   * Rings that cross the antimeridian (Fiji, Chukotka) jump from +180 to -180 between two
   * vertices; drawn naively that edge becomes a hairline of land across the whole map. Unwrap
   * the longitudes so the ring is continuous, then draw it once per side of the seam.
   */
  const drawPolygon = (rings: Position[][]) => {
    for (const ring of rings) {
      const unwrapped: Position[] = [];
      let minLon = Infinity;
      let maxLon = -Infinity;
      let prev = ring[0][0];
      for (const [lon0, lat] of ring) {
        let lon = lon0;
        while (lon - prev > 180) lon -= 360;
        while (lon - prev < -180) lon += 360;
        prev = lon;
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        unwrapped.push([lon, lat]);
      }
      drawRing(unwrapped, 0);
      if (maxLon > 180) drawRing(unwrapped, -360);
      if (minLon < -180) drawRing(unwrapped, 360);
    }
  };

  ctx.beginPath();
  for (const f of geo.features) {
    const g = f.geometry as Polygon | MultiPolygon;
    if (g.type === "Polygon") drawPolygon(g.coordinates);
    else for (const poly of g.coordinates) drawPolygon(poly);
  }
  ctx.fill("evenodd");

  const { data } = ctx.getImageData(0, 0, width, height);
  const bits = new Uint8Array(width * height);
  for (let i = 0; i < bits.length; i++) bits[i] = data[i * 4] > 127 ? 1 : 0;

  return {
    width,
    height,
    isLand(lat, lon) {
      const x = Math.floor(((lon + 180) / 360) * width);
      const y = Math.floor(((90 - lat) / 180) * height);
      const xi = ((x % width) + width) % width;
      const yi = Math.min(height - 1, Math.max(0, y));
      return bits[yi * width + xi] === 1;
    },
  };
}
