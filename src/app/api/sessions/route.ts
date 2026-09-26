import { timingSafeEqual } from "node:crypto";
import { processSession, validateReport } from "@/lib/process-session";

/**
 * Called by the Raspberry Pi / annotation pipeline after a drive has been uploaded and annotated.
 *
 *   POST /api/sessions
 *   Authorization: Bearer <DEVICE_API_KEY>
 *   { "sessionId": "pi-01-2026-09-26T10:00", "wallet": "<driver pubkey>", "deviceId": "pi-01",
 *     "durationSeconds": 1800, "events": [{ "type": "pedestrian", "t": 42.1, "confidence": 0.9 }] }
 */
export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const report = validateReport(body);
  if (typeof report === "string") return Response.json({ error: report }, { status: 400 });

  const result = await processSession(report);
  return Response.json(result.body, { status: result.status });
}

function authorized(request: Request) {
  const expected = process.env.DEVICE_API_KEY;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
