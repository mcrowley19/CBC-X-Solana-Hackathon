import "server-only";
import type { z } from "zod";
import { formatZodError, type ApiError } from "./schemas";

export function jsonError(status: number, error: string) {
  return Response.json({ error } satisfies ApiError, { status });
}

/** Parses and validates a JSON body, or returns a 400 response describing what's wrong. */
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T; response?: never } | { data?: never; response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: jsonError(400, "Body must be valid JSON") };
  }
  const result = schema.safeParse(body);
  if (!result.success) return { response: jsonError(400, formatZodError(result.error)) };
  return { data: result.data };
}

/** Logs the real error server-side and returns a generic message, so internals never leak to callers. */
export function internalError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
  return jsonError(500, `${context} failed. See server logs for details.`);
}
