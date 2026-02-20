import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app.js";

describe("Image Routes", () => {
  let accessToken: string;
  let pieceId: string;

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

    // Create a piece to attach images to
    const pieceRes = await app.request("/pieces", {
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
    const pieceBody = await pieceRes.json();
    pieceId = pieceBody.id;
  });

  it("POST /pieces/:id/image uploads an image", async () => {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" });
    formData.append("image", blob, "test.jpg");

    const res = await app.request(`/pieces/${pieceId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imageKey).toBeDefined();
    expect(body.imageKey).toContain(pieceId);
  });

  it("GET /images/* serves an uploaded image", async () => {
    // First upload an image
    const formData = new FormData();
    const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const blob = new Blob([imageData], { type: "image/jpeg" });
    formData.append("image", blob, "serve-test.jpg");

    const uploadRes = await app.request(`/pieces/${pieceId}/image`, {
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


  it("GET /images/* returns immutable cache-control headers", async () => {
    // Upload an image first
    const formData = new FormData();
    const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const blob = new Blob([imageData], { type: "image/jpeg" });
    formData.append("image", blob, "cache-test.jpg");

    const uploadRes = await app.request(`/pieces/${pieceId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    const uploadBody = await uploadRes.json();

    // Fetch and check headers
    const res = await app.request(`/images/${uploadBody.imageKey}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });

  it("GET /images/* returns 404 for non-existent key", async () => {
    const res = await app.request("/images/nonexistent/key.jpg", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });

  it("GET /images/* rejects path traversal attempts", async () => {
    const res = await app.request("/images/../../src/app.ts", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect([400, 404]).toContain(res.status);
  });

  it("GET /images/* rejects unauthenticated requests", async () => {
    const res = await app.request("/images/some/key.jpg");
    expect(res.status).toBe(401);
  });

  it("POST /pieces/:id/image rejects unauthenticated requests", async () => {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array([0xff, 0xd8])], { type: "image/jpeg" });
    formData.append("image", blob, "test.jpg");

    const res = await app.request(`/pieces/${pieceId}/image`, {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(401);
  });

  it("POST /pieces/:id/image returns 404 for non-existent piece", async () => {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array([0xff, 0xd8])], { type: "image/jpeg" });
    formData.append("image", blob, "test.jpg");

    const res = await app.request("/pieces/00000000-0000-0000-0000-000000000000/image", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(404);
  });

  it("POST /pieces/:id/image rejects spoofed MIME type with invalid magic bytes", async () => {
    const formData = new FormData();
    // Claim image/jpeg but send non-image bytes
    const blob = new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x00])], { type: "image/jpeg" });
    formData.append("image", blob, "fake.jpg");

    const res = await app.request(`/pieces/${pieceId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("File content does not match an allowed image format");
  });

  it("POST /pieces/:id/image rejects disallowed MIME types", async () => {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array([0x00, 0x00])], { type: "application/pdf" });
    formData.append("image", blob, "test.pdf");

    const res = await app.request(`/pieces/${pieceId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Image must be JPEG, PNG, or HEIC");
  });

  it("DELETE /pieces/:id/image removes the image", async () => {
    // Upload first
    const formData = new FormData();
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" });
    formData.append("image", blob, "delete-test.jpg");

    await app.request(`/pieces/${pieceId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    // Delete the image
    const res = await app.request(`/pieces/${pieceId}/image`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);

    // Verify piece imageKey is cleared
    const pieceRes = await app.request(`/pieces/${pieceId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const piece = await pieceRes.json();
    expect(piece.imageKey).toBeNull();
  });
});
