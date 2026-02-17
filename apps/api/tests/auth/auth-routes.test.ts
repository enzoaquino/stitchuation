import { describe, it, expect } from "vitest";
import app from "../../src/app.js";

describe("POST /auth/register", () => {
  it("returns 201 with tokens for valid input", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `route-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Route User",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toContain("@example.com");
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });

  it("returns 400 for invalid input", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("returns 200 with tokens for valid credentials", async () => {
    const email = `login-route-${Date.now()}@example.com`;

    await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "securepassword123",
        displayName: "Login Route User",
      }),
    });

    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "securepassword123" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accessToken).toBeDefined();
  });

  it("returns 401 for bad credentials", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nobody@example.com",
        password: "wrong",
      }),
    });

    expect(res.status).toBe(401);
  });
});
