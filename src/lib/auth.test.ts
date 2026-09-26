import { describe, expect, it } from "vitest";
import { hasValidBearer } from "./auth";

const KEY = "0123456789abcdef0123";

function request(authorization?: string) {
  return new Request("http://test", { headers: authorization ? { authorization } : {} });
}

describe("hasValidBearer", () => {
  it("accepts the matching key", () => {
    expect(hasValidBearer(request(`Bearer ${KEY}`), KEY)).toBe(true);
  });

  it.each([
    ["no header", undefined],
    ["wrong key", "Bearer nope"],
    ["key prefix", `Bearer ${KEY.slice(0, 10)}`],
    ["missing scheme", KEY],
  ])("rejects %s", (_label, header) => {
    expect(hasValidBearer(request(header), KEY)).toBe(false);
  });
});
