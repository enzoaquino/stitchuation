import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app.js";

describe("Thread Routes", () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `thread-routes-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Thread Route Tester",
      }),
    });
    const body = await res.json();
    accessToken = body.accessToken;
  });

  it("POST /threads creates a thread", async () => {
    const res = await app.request("/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        brand: "DMC",
        number: "310",
        colorName: "Black",
        quantity: 3,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.brand).toBe("DMC");
  });

  it("GET /threads lists user threads", async () => {
    const res = await app.request("/threads", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("PUT /threads/:id updates a thread", async () => {
    const createRes = await app.request("/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ brand: "Appleton", number: "100", quantity: 1 }),
    });
    const created = await createRes.json();

    const res = await app.request(`/threads/${created.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ quantity: 10 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quantity).toBe(10);
  });

  it("DELETE /threads/:id soft deletes a thread", async () => {
    const createRes = await app.request("/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ brand: "Silk", number: "999", quantity: 1 }),
    });
    const created = await createRes.json();

    const res = await app.request(`/threads/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await app.request("/threads");
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid thread input", async () => {
    const res = await app.request("/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ brand: "" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await app.request("/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 for updating non-existent thread", async () => {
    const res = await app.request(`/threads/00000000-0000-0000-0000-000000000000`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ quantity: 5 }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 for deleting non-existent thread", async () => {
    const res = await app.request(`/threads/00000000-0000-0000-0000-000000000000`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });
});
