import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app.js";

describe("Sync Routes", () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `sync-routes-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Sync Route Tester",
      }),
    });
    const body = await res.json();
    accessToken = body.accessToken;
  });

  it("POST /sync pushes and pulls changes", async () => {
    const threadId = crypto.randomUUID();
    const res = await app.request("/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        lastSync: null,
        changes: [
          {
            type: "thread",
            action: "upsert",
            id: threadId,
            data: {
              brand: "DMC",
              number: "310",
              colorName: "Black",
              fiberType: "cotton",
              quantity: 3,
            },
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.serverTimestamp).toBeDefined();
    expect(Array.isArray(body.changes)).toBe(true);
  });

  it("returns created threads in subsequent sync", async () => {
    const threadId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Push a thread
    await app.request("/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        lastSync: null,
        changes: [
          {
            type: "thread",
            action: "upsert",
            id: threadId,
            data: { brand: "Appleton", number: "500", quantity: 2 },
            updatedAt: now,
          },
        ],
      }),
    });

    // Pull with a past timestamp
    const pullRes = await app.request("/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        lastSync: new Date(Date.now() - 5000).toISOString(),
        changes: [],
      }),
    });

    expect(pullRes.status).toBe(200);
    const pullBody = await pullRes.json();
    const found = pullBody.changes.find(
      (c: any) => c.id === threadId
    );
    expect(found).toBeDefined();
    expect(found.data.brand).toBe("Appleton");
  });

  it("rejects unauthenticated requests", async () => {
    const res = await app.request("/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastSync: null, changes: [] }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid sync request body", async () => {
    const res = await app.request("/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ changes: "not-an-array" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await app.request("/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid change ID (non-UUID)", async () => {
    const res = await app.request("/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        lastSync: null,
        changes: [
          {
            type: "thread",
            action: "upsert",
            id: "not-a-uuid",
            data: { brand: "DMC", number: "310", quantity: 1 },
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    });

    expect(res.status).toBe(400);
  });
});
