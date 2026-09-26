import { describe, expect, it } from "vitest";
import { DEFAULT_RPC_URL, resolveRpcUrl } from "./cluster";

describe("resolveRpcUrl", () => {
  it("keeps a valid http(s) endpoint, trimming stray whitespace", () => {
    expect(resolveRpcUrl("https://rpc.example.com")).toBe("https://rpc.example.com");
    expect(resolveRpcUrl(" http://127.0.0.1:8899\n")).toBe("http://127.0.0.1:8899");
  });

  it("falls back to devnet when the variable is unset, blank, or not an http URL", () => {
    expect(resolveRpcUrl(undefined)).toBe(DEFAULT_RPC_URL);
    expect(resolveRpcUrl("")).toBe(DEFAULT_RPC_URL);
    expect(resolveRpcUrl("   ")).toBe(DEFAULT_RPC_URL);
    expect(resolveRpcUrl("devnet")).toBe(DEFAULT_RPC_URL);
    expect(resolveRpcUrl("wss://rpc.example.com")).toBe(DEFAULT_RPC_URL);
  });
});
