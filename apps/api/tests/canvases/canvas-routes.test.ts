import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app.js";

describe("Canvas Routes", () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `canvas-routes-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Canvas Route Tester",
      }),
    });
    const body = await res.json();
    accessToken = body.accessToken;
  });

  it("POST /canvases creates a canvas", async () => {
    const res = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "Melissa Shirley",
        designName: "Christmas Nutcracker",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.designer).toBe("Melissa Shirley");
    expect(body.designName).toBe("Christmas Nutcracker");
  });

  it("POST /canvases creates a canvas with all optional fields", async () => {
    const res = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "Kirk & Bradley",
        designName: "Gingerbread House",
        acquiredAt: "2025-12-25T00:00:00.000Z",
        size: "14x18",
        meshCount: 18,
        notes: "Gift from Mom",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.size).toBe("14x18");
    expect(body.meshCount).toBe(18);
  });

  it("GET /canvases lists user canvases", async () => {
    const res = await app.request("/canvases", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("GET /canvases/:id returns a single canvas", async () => {
    const createRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "GetById", designName: "Test" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/canvases/${created.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.designer).toBe("GetById");
    expect(body.id).toBe(created.id);
  });

  it("GET /canvases/:id returns 404 for non-existent canvas", async () => {
    const res = await app.request("/canvases/00000000-0000-0000-0000-000000000000", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });

  it("GET /canvases/:id returns 400 for invalid UUID", async () => {
    const res = await app.request("/canvases/not-a-uuid", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid canvas ID");
  });

  it("PUT /canvases/:id updates a canvas", async () => {
    const createRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "Update Test", designName: "Original" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/canvases/${created.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ meshCount: 13, notes: "Updated" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meshCount).toBe(13);
    expect(body.notes).toBe("Updated");
  });

  it("DELETE /canvases/:id soft deletes a canvas", async () => {
    const createRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "Delete Test", designName: "Bye" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/canvases/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const getRes = await app.request(`/canvases/${created.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(getRes.status).toBe(404);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await app.request("/canvases");
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid canvas input", async () => {
    const res = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 for updating non-existent canvas", async () => {
    const res = await app.request("/canvases/00000000-0000-0000-0000-000000000000", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "nope" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 400 for updating with invalid UUID", async () => {
    const res = await app.request("/canvases/not-a-uuid", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "nope" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid canvas ID");
  });

  it("returns 404 for deleting non-existent canvas", async () => {
    const res = await app.request("/canvases/00000000-0000-0000-0000-000000000000", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });

  it("returns 400 for updating with empty body", async () => {
    const createRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "Empty Update", designName: "Test" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/canvases/${created.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for deleting with invalid UUID", async () => {
    const res = await app.request("/canvases/not-a-uuid", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid canvas ID");
  });
});
