import { describe, expect, it, vi } from "vitest";

vi.stubEnv("APP_PASSWORD", "secret");
vi.stubEnv("SESSION_SECRET", "test-secret");

describe("auth", async () => {
  const auth = await import("../src/auth.js");

  it("verifies password using configured value", () => {
    expect(auth.verifyPassword("secret")).toBe(true);
    expect(auth.verifyPassword("wrong")).toBe(false);
  });

  it("creates signed session cookies", () => {
    const cookie = auth.createSessionCookie();
    expect(cookie.split(".")).toHaveLength(2);
  });
});
