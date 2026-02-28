import { describe, it, expect, vi } from "vitest";
import app from "../../src/app.js";

// Mock the Apple token verifier for route-level tests
const { MockAppleTokenError, testSuffix } = vi.hoisted(() => {
  class MockAppleTokenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AppleTokenError";
    }
  }
  const testSuffix = Date.now().toString();
  return { MockAppleTokenError, testSuffix };
});

vi.mock("../../src/auth/apple-token-verifier.js", () => ({
  AppleTokenError: MockAppleTokenError,
  verifyAppleIdentityToken: async (token: string, _bundleId: string) => {
    if (token === "valid-apple-token") {
      return {
        sub: `001234.testuser.${testSuffix}`,
        email: `apple-${testSuffix}@privaterelay.appleid.com`,
      };
    }
    if (token === "valid-no-email") {
      return {
        sub: `001234.noemail.${testSuffix}`,
        email: null,
      };
    }
    throw new MockAppleTokenError("Invalid token");
  },
}));

describe("POST /auth/provider", () => {
  it("returns 201 for a new Apple user with name", async () => {
    const res = await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "apple",
        identityToken: "valid-apple-token",
        fullName: { givenName: "Enzo", familyName: "Aquino" },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toContain("@privaterelay.appleid.com");
    expect(body.user.displayName).toBe("Enzo Aquino");
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.isNewUser).toBe(true);
  });

  it("returns 200 for an existing Apple user", async () => {
    // First sign-in creates the user
    await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "apple",
        identityToken: "valid-apple-token",
        fullName: { givenName: "Enzo", familyName: "Aquino" },
      }),
    });

    // Second sign-in finds existing user
    const res = await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "apple",
        identityToken: "valid-apple-token",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isNewUser).toBe(false);
    expect(body.user.displayName).toBe("Enzo Aquino");
  });

  it("returns 201 with null displayName when no name or email provided", async () => {
    const res = await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "apple",
        identityToken: "valid-no-email",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.displayName).toBeNull();
    expect(body.isNewUser).toBe(true);
  });

  it("returns 401 for an invalid Apple identity token", async () => {
    const res = await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "apple",
        identityToken: "bad-token",
      }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Invalid");
  });

  it("returns 400 for unsupported provider", async () => {
    const res = await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "instagram",
        identityToken: "some-token",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for missing identityToken", async () => {
    const res = await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "apple",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json{{{",
    });

    expect(res.status).toBe(400);
  });
});
