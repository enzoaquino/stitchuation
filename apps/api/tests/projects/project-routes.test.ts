import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app.js";

describe("Project Routes", () => {
  let accessToken: string;
  let canvasId: string;

  beforeAll(async () => {
    // Register a user
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `project-routes-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Project Route Tester",
      }),
    });
    const body = await res.json();
    accessToken = body.accessToken;

    // Create a canvas to use for projects
    const canvasRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "Test Designer",
        designName: "Test Canvas for Projects",
      }),
    });
    const canvasBody = await canvasRes.json();
    canvasId = canvasBody.id;
  });

  it("POST /projects creates a project", async () => {
    const res = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ canvasId }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.canvasId).toBe(canvasId);
    expect(body.status).toBe("wip");
    expect(body.startedAt).toBeTruthy();
  });

  it("POST /projects rejects missing canvasId", async () => {
    const res = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it("POST /projects rejects unauthenticated requests", async () => {
    const res = await app.request("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canvasId }),
    });

    expect(res.status).toBe(401);
  });

  it("POST /projects returns 400 for duplicate canvasId", async () => {
    // canvasId already used in the first POST test, so unique constraint should fire
    // Create a fresh canvas for a clean project
    const canvasRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "Dup Test",
        designName: "Dup Canvas",
      }),
    });
    const canvasBody = await canvasRes.json();

    // First create should succeed
    const res1 = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ canvasId: canvasBody.id }),
    });
    expect(res1.status).toBe(201);

    // Second create with same canvasId should fail (unique constraint)
    const res2 = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ canvasId: canvasBody.id }),
    });
    expect(res2.status).toBe(400);
  });

  it("GET /projects lists user projects", async () => {
    const res = await app.request("/projects", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("GET /projects/:id returns a single project", async () => {
    const canvasRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "GetById", designName: "Project Test" }),
    });
    const canvasBody = await canvasRes.json();

    const createRes = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ canvasId: canvasBody.id }),
    });
    const created = await createRes.json();

    const res = await app.request(`/projects/${created.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(created.id);
    expect(body.canvasId).toBe(canvasBody.id);
  });

  it("GET /projects/:id returns 404 for non-existent project", async () => {
    const res = await app.request("/projects/00000000-0000-0000-0000-000000000000", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });

  it("GET /projects/:id returns 400 for invalid UUID", async () => {
    const res = await app.request("/projects/not-a-uuid", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid project ID");
  });

  it("PUT /projects/:id/status advances status from wip to at_finishing", async () => {
    const canvasRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "Status", designName: "Advance Test" }),
    });
    const canvasBody = await canvasRes.json();

    const createRes = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ canvasId: canvasBody.id }),
    });
    const created = await createRes.json();
    expect(created.status).toBe("wip");

    const res = await app.request(`/projects/${created.id}/status`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("at_finishing");
    expect(body.finishingAt).toBeTruthy();
  });

  it("PUT /projects/:id/status advances from at_finishing to completed", async () => {
    const canvasRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "Status2", designName: "Complete Test" }),
    });
    const canvasBody = await canvasRes.json();

    const createRes = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ canvasId: canvasBody.id }),
    });
    const created = await createRes.json();

    // Advance to at_finishing
    await app.request(`/projects/${created.id}/status`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Advance to completed
    const res = await app.request(`/projects/${created.id}/status`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("completed");
    expect(body.completedAt).toBeTruthy();
  });

  it("PUT /projects/:id/status returns 400 when already completed", async () => {
    const canvasRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "Status3", designName: "Already Done" }),
    });
    const canvasBody = await canvasRes.json();

    const createRes = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ canvasId: canvasBody.id }),
    });
    const created = await createRes.json();

    // Advance to at_finishing
    await app.request(`/projects/${created.id}/status`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Advance to completed
    await app.request(`/projects/${created.id}/status`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Try to advance past completed — should fail
    const res = await app.request(`/projects/${created.id}/status`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("DELETE /projects/:id soft deletes a project", async () => {
    const canvasRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "Delete", designName: "Soft Delete Test" }),
    });
    const canvasBody = await canvasRes.json();

    const createRes = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ canvasId: canvasBody.id }),
    });
    const created = await createRes.json();

    const res = await app.request(`/projects/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify it's gone
    const getRes = await app.request(`/projects/${created.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(getRes.status).toBe(404);
  });

  it("DELETE /projects/:id returns 404 for non-existent project", async () => {
    const res = await app.request("/projects/00000000-0000-0000-0000-000000000000", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });

  it("DELETE /projects/:id returns 400 for invalid UUID", async () => {
    const res = await app.request("/projects/not-a-uuid", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid project ID");
  });

  it("POST /projects returns 400 for malformed JSON body", async () => {
    const res = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });
});
