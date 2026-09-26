import { hasValidBearer } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { internalError, jsonError, parseJsonBody } from "@/lib/http";
import { processSession } from "@/lib/process-session";
import { sessionReportSchema } from "@/lib/schemas";

/**
 * Called by the Raspberry Pi / annotation pipeline after a drive has been uploaded and annotated.
 *
 *   POST /api/sessions
 *   Authorization: Bearer <DEVICE_API_KEY>
 *   { "sessionId": "pi-01-2026-09-26T10-00", "wallet": "<driver pubkey>", "deviceId": "pi-01",
 *     "durationSeconds": 1800, "events": [{ "type": "pedestrian", "t": 42.1, "confidence": 0.9 }] }
 */
export async function POST(request: Request) {
  try {
    if (!hasValidBearer(request, getConfig().deviceApiKey)) return jsonError(401, "Unauthorized");

    const body = await parseJsonBody(request, sessionReportSchema);
    if (body.response) return body.response;

    const outcome = await processSession(body.data);
    return outcome.ok
      ? Response.json(outcome.result, { status: outcome.status })
      : jsonError(outcome.status, outcome.error);
  } catch (error) {
    return internalError("Payout", error);
  }
}
