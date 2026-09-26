import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Checks `Authorization: Bearer <key>` in constant time. Both sides are hashed first
 * so the comparison doesn't reveal the expected key's length.
 */
export function hasValidBearer(request: Request, expectedKey: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header.slice("Bearer ".length)), digest(expectedKey));
}
