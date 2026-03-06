import { describe, it, expect, vi } from "vitest";
import app from "../../src/app.js";

// Mock the oauth-providers module
const { MockOAuthError } = vi.hoisted(() => {
  class MockOAuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "OAuthError";
    }
  }
  return { MockOAuthError };
});

vi.mock("../../src/auth/oauth-providers.js", () => ({
  OAuthError: MockOAuthError,
  getAuthorizationUrl: (provider: string, state: string) => {
    return `https://mock.${provider}.com/oauth?state=${state}`;
  },
  exchangeCodeForProfile: async (provider: string, code: string) => {
    if (code === "invalid-code") {
      throw new MockOAuthError("Token exchange failed");
    }
    const suffix = Date.now().toString();
    if (provider === "facebook") {
      return {
        id: `fb-${suffix}`,
        email: `fbuser-${suffix}@example.com`,
        displayName: "Facebook User",
        profileImageUrl: "https://graph.facebook.com/photo.jpg",
      };
    }
    if (provider === "tiktok") {
      return {
        id: `tt-${suffix}`,
        email: null,
        displayName: "TikTok User",
        profileImageUrl: "https://p16.tiktokcdn.com/avatar.jpg",
      };
    }
    throw new Error(`Unknown provider: ${provider}`);
  },
}));

describe("OAuth authorize routes", () => {
  it("GET /auth/facebook/authorize redirects to Facebook", async () => {
    const res = await app.request("/auth/facebook/authorize", {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("Location");
    expect(location).toContain("mock.facebook.com");
  });

  it("GET /auth/tiktok/authorize redirects to TikTok", async () => {
    const res = await app.request("/auth/tiktok/authorize", {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("Location");
    expect(location).toContain("mock.tiktok.com");
  });
});

describe("OAuth callback routes", () => {
  it("GET /auth/facebook/callback with missing params redirects with error", async () => {
    const res = await app.request("/auth/facebook/callback", {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("stitchuation://auth/callback");
    expect(location).toContain("error=missing_params");
  });

  it("GET /auth/facebook/callback with invalid state redirects with error", async () => {
    const res = await app.request("/auth/facebook/callback?code=abc&state=bad-state", {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("error=invalid_state");
  });

  it("GET /auth/facebook/callback with provider error redirects with error", async () => {
    const res = await app.request("/auth/facebook/callback?error=access_denied", {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("error=access_denied");
  });

  it("Facebook OAuth full flow: authorize then callback creates user", async () => {
    // Step 1: Get authorize redirect to capture the state
    const authorizeRes = await app.request("/auth/facebook/authorize", {
      redirect: "manual",
    });
    const authorizeLocation = authorizeRes.headers.get("Location")!;
    const stateMatch = authorizeLocation.match(/state=([^&]+)/);
    expect(stateMatch).toBeTruthy();
    const state = stateMatch![1];

    // Step 2: Simulate callback with the state
    const callbackRes = await app.request(
      `/auth/facebook/callback?code=valid-code&state=${state}`,
      { redirect: "manual" },
    );

    expect(callbackRes.status).toBe(302);
    const callbackLocation = callbackRes.headers.get("Location")!;
    expect(callbackLocation).toContain("stitchuation://auth/callback");
    expect(callbackLocation).toContain("access_token=");
    expect(callbackLocation).toContain("refresh_token=");
    expect(callbackLocation).toContain("is_new_user=true");
  });

  it("TikTok OAuth full flow: authorize then callback creates user", async () => {
    const authorizeRes = await app.request("/auth/tiktok/authorize", {
      redirect: "manual",
    });
    const authorizeLocation = authorizeRes.headers.get("Location")!;
    const stateMatch = authorizeLocation.match(/state=([^&]+)/);
    const state = stateMatch![1];

    const callbackRes = await app.request(
      `/auth/tiktok/callback?code=valid-code&state=${state}`,
      { redirect: "manual" },
    );

    expect(callbackRes.status).toBe(302);
    const callbackLocation = callbackRes.headers.get("Location")!;
    expect(callbackLocation).toContain("stitchuation://auth/callback");
    expect(callbackLocation).toContain("access_token=");
    expect(callbackLocation).toContain("is_new_user=true");
  });
});
