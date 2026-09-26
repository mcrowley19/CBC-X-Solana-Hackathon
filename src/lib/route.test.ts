import { describe, expect, it } from "vitest";
import { decodePolyline, encodePolyline, encodeRoute, fitRoute, routeDistanceMetres, simplify } from "./route";

/** A wiggly 2 km drive through Bristol, one point every ~10 m. */
function drive(count = 200) {
  const points = [];
  let lat = 51.4545;
  let lng = -2.5879;
  let heading = 0.6;
  for (let i = 0; i < count; i++) {
    heading += Math.sin(i / 9) * 0.08;
    lat += Math.cos(heading) * 0.00009;
    lng += Math.sin(heading) * 0.00014;
    points.push({ lat, lng });
  }
  return points;
}

describe("polyline", () => {
  it("round-trips Google's reference example", () => {
    const points = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    expect(encodePolyline(points)).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual(points);
  });

  it("round-trips a long track to five decimals", () => {
    const points = drive();
    const decoded = decodePolyline(encodePolyline(points));
    expect(decoded).toHaveLength(points.length);
    decoded.forEach((p, i) => {
      expect(p.lat).toBeCloseTo(points[i].lat, 5);
      expect(p.lng).toBeCloseTo(points[i].lng, 5);
    });
  });

  it("returns [] for garbage instead of throwing", () => {
    expect(decodePolyline("")).toEqual([]);
    expect(decodePolyline("_p~iF")).toEqual([]);
    expect(decodePolyline("\u0001\u0002")).toEqual([]);
  });
});

describe("simplify", () => {
  it("drops points on a straight line and keeps the ends", () => {
    const line = Array.from({ length: 50 }, (_, i) => ({ lat: 51 + i * 0.001, lng: -2 + i * 0.001 }));
    expect(simplify(line, 0.00001)).toEqual([line[0], line[49]]);
  });

  it("keeps a corner", () => {
    const corner = [
      { lat: 51, lng: -2 },
      { lat: 51.01, lng: -2 },
      { lat: 51.01, lng: -1.99 },
    ];
    expect(simplify(corner, 0.0001)).toEqual(corner);
  });
});

describe("encodeRoute", () => {
  it("fits a long drive into the byte budget while keeping its ends and shape", () => {
    const points = drive(2000);
    const encoded = encodeRoute(points, 500);
    expect(encoded).toBeDefined();
    expect(JSON.stringify(encoded).length - 2).toBeLessThanOrEqual(500);
    const decoded = decodePolyline(encoded!);
    expect(decoded.length).toBeGreaterThan(20);
    expect(decoded[0].lat).toBeCloseTo(points[0].lat, 4);
    expect(decoded.at(-1)!.lng).toBeCloseTo(points.at(-1)!.lng, 4);
    // Simplifying shouldn't lose more than a few percent of the distance.
    expect(routeDistanceMetres(decoded)).toBeGreaterThan(routeDistanceMetres(points) * 0.95);
  });

  it("falls back to start and end when the budget is tiny", () => {
    const encoded = encodeRoute(drive(), 30);
    expect(decodePolyline(encoded!)).toHaveLength(2);
  });

  it("gives up on fewer than two points, non-finite input, or no budget", () => {
    expect(encodeRoute([{ lat: 1, lng: 2 }], 500)).toBeUndefined();
    expect(encodeRoute([{ lat: NaN, lng: 2 }, { lat: 1, lng: 2 }], 500)).toBeUndefined();
    expect(encodeRoute(drive(), 2)).toBeUndefined();
  });
});

describe("routeDistanceMetres", () => {
  it("measures a known distance", () => {
    // One degree of latitude is about 111 km.
    const metres = routeDistanceMetres([{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }]);
    expect(metres).toBeGreaterThan(110_000);
    expect(metres).toBeLessThan(112_000);
  });
});

describe("fitRoute", () => {
  it("centres the track inside the box, north up", () => {
    const fitted = fitRoute(
      [
        { lat: 51, lng: -2 },
        { lat: 51.01, lng: -2 },
      ],
      200,
      100,
      10,
    );
    expect(fitted).not.toBeNull();
    // Heading north: the end is above the start, both on the vertical centre line.
    expect(fitted!.start.x).toBeCloseTo(100);
    expect(fitted!.end.x).toBeCloseTo(100);
    expect(fitted!.start.y).toBeCloseTo(90);
    expect(fitted!.end.y).toBeCloseTo(10);
    expect(fitted!.d.startsWith("M")).toBe(true);
  });

  it("handles a single point and an empty track", () => {
    expect(fitRoute([], 100, 100)).toBeNull();
    const fitted = fitRoute([{ lat: 51, lng: -2 }], 100, 100);
    expect(fitted!.start).toEqual({ x: 50, y: 50 });
  });
});
