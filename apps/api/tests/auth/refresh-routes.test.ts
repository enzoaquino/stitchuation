import { describe, it, expect } from "vitest";
import app from "../../src/app.js";
import { signRefreshToken, signAccessToken } from "../../src/auth/jwt.js";

describe("POST /auth/refresh", () => {
  it("returns new tokens for a valid refresh token", async () => {
    // Register a user to get a valid refresh token
    const regRes = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `refresh-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Refresh User",
      }),
    });
    const { refreshToken } = await regRes.json();

    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });

  it("returns 401 for an invalid refresh token", async () => {
    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "garbage" }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 for an access token used as refresh token", async () => {
    const accessToken = signAccessToken({ userId: "fake-id", email: "a@b.com" });

    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: accessToken }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 when user no longer exists", async () => {
    const refreshToken = signRefreshToken({ userId: "00000000-0000-0000-0000-000000000000", email: "gone@example.com" });

    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 for missing refreshToken field", async () => {
    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});
