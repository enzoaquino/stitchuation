import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app.js";

describe("Image Routes", () => {
  let accessToken: string;
  let canvasId: string;

  beforeAll(async () => {
    // Register user
    const authRes = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `image-routes-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Image Route Tester",
      }),
    });
    const authBody = await authRes.json();
    accessToken = authBody.accessToken;

    // Create a canvas to attach images to
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
    canvasId = canvasBody.id;
  });

  it("POST /canvases/:id/image uploads an image", async () => {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" });
    formData.append("image", blob, "test.jpg");

    const res = await app.request(`/canvases/${canvasId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imageKey).toBeDefined();
    expect(body.imageKey).toContain(canvasId);
  });

  it("GET /images/* serves an uploaded image", async () => {
    // First upload an image
    const formData = new FormData();
    const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const blob = new Blob([imageData], { type: "image/jpeg" });
    formData.append("image", blob, "serve-test.jpg");

    const uploadRes = await app.request(`/canvases/${canvasId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    const uploadBody = await uploadRes.json();

    // Then retrieve it
    const res = await app.request(`/images/${uploadBody.imageKey}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
  });

  it("GET /images/* returns 404 for non-existent key", async () => {
    const res = await app.request("/images/nonexistent/key.jpg", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });

  it("GET /images/* rejects unauthenticated requests", async () => {
    const res = await app.request("/images/some/key.jpg");
    expect(res.status).toBe(401);
  });

  it("POST /canvases/:id/image rejects unauthenticated requests", async () => {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array([0xff, 0xd8])], { type: "image/jpeg" });
    formData.append("image", blob, "test.jpg");

    const res = await app.request(`/canvases/${canvasId}/image`, {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(401);
  });

  it("POST /canvases/:id/image returns 404 for non-existent canvas", async () => {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array([0xff, 0xd8])], { type: "image/jpeg" });
    formData.append("image", blob, "test.jpg");

    const res = await app.request("/canvases/00000000-0000-0000-0000-000000000000/image", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(404);
  });

  it("DELETE /canvases/:id/image removes the image", async () => {
    // Upload first
    const formData = new FormData();
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" });
    formData.append("image", blob, "delete-test.jpg");

    await app.request(`/canvases/${canvasId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    // Delete the image
    const res = await app.request(`/canvases/${canvasId}/image`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);

    // Verify canvas imageKey is cleared
    const canvasRes = await app.request(`/canvases/${canvasId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const canvas = await canvasRes.json();
    expect(canvas.imageKey).toBeNull();
  });
});
