import { processSession } from "@/lib/process-session";
import type { AnnotatedEvent } from "@/lib/rewards";

/**
 * Demo-only: simulates the Pi finishing a drive so the reward flow can be shown
 * without hardware. Disabled unless DEMO_MODE=true.
 */
const EVENT_TYPES = ["pedestrian", "stop_sign", "lane_change", "traffic_light", "cyclist", "hazard", "near_miss"];

export async function POST(request: Request) {
  if (process.env.DEMO_MODE !== "true") {
    return Response.json({ error: "Demo mode is disabled" }, { status: 403 });
  }
  const { wallet } = (await request.json().catch(() => ({}))) as { wallet?: string };
  if (!wallet) return Response.json({ error: "wallet is required" }, { status: 400 });

  const durationSeconds = 60 * (5 + Math.floor(Math.random() * 40));
  const events: AnnotatedEvent[] = Array.from({ length: Math.floor(Math.random() * 12) }, () => ({
    type: EVENT_TYPES[Math.floor(Math.random() ** 1.6 * EVENT_TYPES.length)],
    t: Math.round(Math.random() * durationSeconds),
    confidence: 0.6 + Math.random() * 0.4,
  }));

  const result = await processSession({
    sessionId: `demo-${Date.now().toString(36)}`,
    wallet,
    deviceId: "demo-pi",
    durationSeconds,
    events,
  });
  return Response.json({ ...result.body, simulated: { durationSeconds, events } }, { status: result.status });
}
