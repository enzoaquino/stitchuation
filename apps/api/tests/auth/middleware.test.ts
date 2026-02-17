import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../../src/auth/middleware.js";
import { signAccessToken, signRefreshToken } from "../../src/auth/jwt.js";

describe("authMiddleware", () => {
  const app = new Hono();
  app.use("/protected/*", authMiddleware);
  app.get("/protected/test", (c) => {
    const userId = c.get("userId");
    return c.json({ userId });
  });

  it("allows requests with valid token", async () => {
    const token = signAccessToken({ userId: "test-id", email: "test@test.com" });
    const res = await app.request("/protected/test", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("test-id");
  });

  it("rejects requests without token", async () => {
    const res = await app.request("/protected/test");
    expect(res.status).toBe(401);
  });

  it("rejects requests with invalid token", async () => {
    const res = await app.request("/protected/test", {
      headers: { Authorization: "Bearer invalid-token" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects requests with refresh token instead of access token", async () => {
    const token = signRefreshToken({ userId: "test-id", email: "test@test.com" });
    const res = await app.request("/protected/test", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it("rejects requests with malformed Authorization header", async () => {
    const res = await app.request("/protected/test", {
      headers: { Authorization: "NotBearer some-token" },
    });
    expect(res.status).toBe(401);
  });
});
