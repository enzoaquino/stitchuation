import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app.js";

describe("Journal Entry Routes", () => {
  let accessToken: string;
  let projectId: string;

  beforeAll(async () => {
    // Register a user
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `journal-routes-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Journal Route Tester",
      }),
    });
    const body = await res.json();
    accessToken = body.accessToken;

    // Create a canvas
    const canvasRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "Journal Test Designer",
        designName: "Journal Test Canvas",
      }),
    });
    const canvasBody = await canvasRes.json();

    // Create a project
    const projectRes = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ canvasId: canvasBody.id }),
    });
    const projectBody = await projectRes.json();
    projectId = projectBody.id;
  });

  it("POST /projects/:id/entries creates an entry with notes", async () => {
    const res = await app.request(`/projects/${projectId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "Finished the first section today!" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.notes).toBe("Finished the first section today!");
    expect(body.projectId).toBe(projectId);
  });

  it("POST /projects/:id/entries creates an entry without notes", async () => {
    const res = await app.request(`/projects/${projectId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.projectId).toBe(projectId);
  });

  it("POST /projects/:id/entries rejects non-existent project", async () => {
    const res = await app.request("/projects/00000000-0000-0000-0000-000000000000/entries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "Should fail" }),
    });

    expect(res.status).toBe(404);
  });

  it("GET /projects/:id/entries lists entries", async () => {
    const res = await app.request(`/projects/${projectId}/entries`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("GET /projects/:id/entries returns 404 for non-existent project", async () => {
    const res = await app.request("/projects/00000000-0000-0000-0000-000000000000/entries", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });

  it("GET /projects/:id/entries/:entryId returns a single entry", async () => {
    // Create an entry
    const createRes = await app.request(`/projects/${projectId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "Single entry fetch test" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/projects/${projectId}/entries/${created.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(created.id);
    expect(body.notes).toBe("Single entry fetch test");
  });

  it("GET /projects/:id/entries/:entryId returns 404 for non-existent entry", async () => {
    const res = await app.request(
      `/projects/${projectId}/entries/00000000-0000-0000-0000-000000000000`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(res.status).toBe(404);
  });

  it("GET /projects/:id/entries/:entryId returns 400 for invalid entry ID", async () => {
    const res = await app.request(`/projects/${projectId}/entries/not-a-uuid`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid entry ID");
  });

  it("GET /projects/:id/entries/:entryId returns 404 for non-existent project", async () => {
    // Create an entry first so the entryId is valid
    const createRes = await app.request(`/projects/${projectId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "Orphan test" }),
    });
    const created = await createRes.json();

    const res = await app.request(
      `/projects/00000000-0000-0000-0000-000000000000/entries/${created.id}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(res.status).toBe(404);
  });

  it("PUT /projects/:id/entries/:entryId updates entry notes", async () => {
    // Create an entry first
    const createRes = await app.request(`/projects/${projectId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "Original notes" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/projects/${projectId}/entries/${created.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "Updated notes" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notes).toBe("Updated notes");
  });

  it("PUT /projects/:id/entries/:entryId returns 404 for non-existent entry", async () => {
    const res = await app.request(`/projects/${projectId}/entries/00000000-0000-0000-0000-000000000000`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "Nope" }),
    });

    expect(res.status).toBe(404);
  });

  it("DELETE /projects/:id/entries/:entryId soft deletes an entry", async () => {
    // Create an entry first
    const createRes = await app.request(`/projects/${projectId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "To be deleted" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/projects/${projectId}/entries/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("DELETE /projects/:id/entries/:entryId returns 404 for non-existent entry", async () => {
    const res = await app.request(`/projects/${projectId}/entries/00000000-0000-0000-0000-000000000000`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });
});

describe("Journal Image Routes", () => {
  let accessToken: string;
  let projectId: string;
  let entryId: string;

  beforeAll(async () => {
    // Register a user
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `journal-images-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Image Route Tester",
      }),
    });
    const body = await res.json();
    accessToken = body.accessToken;

    // Create a canvas
    const canvasRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "Image Test Designer",
        designName: "Image Test Canvas",
      }),
    });
    const canvasBody = await canvasRes.json();

    // Create a project
    const projectRes = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ canvasId: canvasBody.id }),
    });
    const projectBody = await projectRes.json();
    projectId = projectBody.id;

    // Create a journal entry
    const entryRes = await app.request(`/projects/${projectId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "Entry for image tests" }),
    });
    const entryBody = await entryRes.json();
    entryId = entryBody.id;
  });

  it("POST /projects/:id/entries/:entryId/images uploads a valid JPEG", async () => {
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const jpegData = new Uint8Array(100);
    jpegData.set(jpegHeader);
    const blob = new Blob([jpegData], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("image", new File([blob], "test.jpg", { type: "image/jpeg" }));

    const res = await app.request(`/projects/${projectId}/entries/${entryId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.imageKey).toContain("journals/");
    expect(body.sortOrder).toBe(0);
  });

  it("POST /projects/:id/entries/:entryId/images auto-increments sortOrder", async () => {
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const jpegData = new Uint8Array(100);
    jpegData.set(jpegHeader);
    const blob = new Blob([jpegData], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("image", new File([blob], "test2.jpg", { type: "image/jpeg" }));

    const res = await app.request(`/projects/${projectId}/entries/${entryId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sortOrder).toBe(1);
  });

  it("POST /projects/:id/entries/:entryId/images rejects non-image file", async () => {
    const textData = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    const blob = new Blob([textData], { type: "text/plain" });

    const formData = new FormData();
    formData.append("image", new File([blob], "test.txt", { type: "text/plain" }));

    const res = await app.request(`/projects/${projectId}/entries/${entryId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(400);
  });

  it("POST /projects/:id/entries/:entryId/images rejects missing file", async () => {
    const formData = new FormData();

    const res = await app.request(`/projects/${projectId}/entries/${entryId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(400);
  });

  it("POST /projects/:id/entries/:entryId/images rejects 5th image (max 4)", async () => {
    // Create a fresh entry for this test
    const entryRes = await app.request(`/projects/${projectId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "Max images test" }),
    });
    const freshEntry = await entryRes.json();

    const makeJpeg = () => {
      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const jpegData = new Uint8Array(100);
      jpegData.set(jpegHeader);
      return new Blob([jpegData], { type: "image/jpeg" });
    };

    // Upload 4 images
    for (let i = 0; i < 4; i++) {
      const formData = new FormData();
      formData.append("image", new File([makeJpeg()], `img${i}.jpg`, { type: "image/jpeg" }));
      const res = await app.request(`/projects/${projectId}/entries/${freshEntry.id}/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      expect(res.status).toBe(201);
    }

    // 5th upload should fail
    const formData = new FormData();
    formData.append("image", new File([makeJpeg()], "img4.jpg", { type: "image/jpeg" }));
    const res = await app.request(`/projects/${projectId}/entries/${freshEntry.id}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Maximum 4 images per entry");
  });

  it("DELETE /projects/:id/entries/:entryId/images/:imageId soft deletes an image", async () => {
    // Upload an image first
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const jpegData = new Uint8Array(100);
    jpegData.set(jpegHeader);
    const blob = new Blob([jpegData], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("image", new File([blob], "delete-test.jpg", { type: "image/jpeg" }));

    const uploadRes = await app.request(`/projects/${projectId}/entries/${entryId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    const uploaded = await uploadRes.json();

    const res = await app.request(
      `/projects/${projectId}/entries/${entryId}/images/${uploaded.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("DELETE /projects/:id/entries/:entryId/images/:imageId returns 404 for non-existent image", async () => {
    const res = await app.request(
      `/projects/${projectId}/entries/${entryId}/images/00000000-0000-0000-0000-000000000000`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(res.status).toBe(404);
  });
});
