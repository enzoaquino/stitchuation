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

  it("returns 400 for password shorter than 8 characters", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `short-pw-${Date.now()}@example.com`,
        password: "short",
        displayName: "Short PW User",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for password longer than 72 characters", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `long-pw-${Date.now()}@example.com`,
        password: "a".repeat(73),
        displayName: "Long PW User",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for missing displayName", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `no-name-${Date.now()}@example.com`,
        password: "securepassword123",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });

  it("returns 409 for duplicate email", async () => {
    const email = `dup-route-${Date.now()}@example.com`;

    await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "securepassword123",
        displayName: "First User",
      }),
    });

    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "otherpassword123",
        displayName: "Second User",
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Email already registered");
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

  it("returns 400 for malformed JSON body", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });
});
