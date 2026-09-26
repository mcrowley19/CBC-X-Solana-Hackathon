import { isDemoMode } from "@/lib/config";
import { internalError, jsonError, parseJsonBody } from "@/lib/http";
import { processSession } from "@/lib/process-session";
import { RATES, type AnnotatedEvent } from "@/lib/rewards";
import { demoDriveSchema } from "@/lib/schemas";

/**
 * Demo only: simulates the Pi finishing a drive so the reward flow can be shown without hardware.
 * It is unauthenticated, so it's disabled unless DEMO_MODE=true. Never enable it on a treasury holding real value.
 */
const EVENT_TYPES = Object.keys(RATES.events).filter((type) => type !== "other");

function randomDrive() {
  const durationSeconds = 60 * (5 + Math.floor(Math.random() * 40));
  // Skewed towards the start of the list so common events appear more often than rare ones.
  const events: AnnotatedEvent[] = Array.from({ length: Math.floor(Math.random() * 12) }, () => ({
    type: EVENT_TYPES[Math.floor(Math.random() ** 1.6 * EVENT_TYPES.length)],
    t: Math.round(Math.random() * durationSeconds),
    confidence: 0.6 + Math.random() * 0.4,
  }));
  return { durationSeconds, events };
}

export async function POST(request: Request) {
  if (!isDemoMode()) return jsonError(403, "Demo mode is disabled");

  const body = await parseJsonBody(request, demoDriveSchema);
  if (body.response) return body.response;

  try {
    const simulated = randomDrive();
    const outcome = await processSession({
      sessionId: `demo-${Date.now().toString(36)}`,
      wallet: body.data.wallet,
      deviceId: "demo-pi",
      ...simulated,
    });
    return outcome.ok
      ? Response.json({ ...outcome.result, simulated }, { status: outcome.status })
      : jsonError(outcome.status, outcome.error);
  } catch (error) {
    return internalError("Demo payout", error);
  }
}
