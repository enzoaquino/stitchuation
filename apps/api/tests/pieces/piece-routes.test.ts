import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app.js";

describe("Piece Routes - CRUD", () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `piece-routes-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Piece Route Tester",
      }),
    });
    const body = await res.json();
    accessToken = body.accessToken;
  });

  it("POST /pieces creates a piece with default stash status", async () => {
    const res = await app.request("/pieces", {
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
    expect(body.status).toBe("stash");
  });

  it("POST /pieces creates a piece with all optional fields", async () => {
    const res = await app.request("/pieces", {
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
    expect(body.notes).toBe("Gift from Mom");
  });

  it("GET /pieces lists user pieces", async () => {
    const res = await app.request("/pieces", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("GET /pieces/:id returns a single piece", async () => {
    const createRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "GetById", designName: "Test" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/pieces/${created.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.designer).toBe("GetById");
    expect(body.id).toBe(created.id);
  });

  it("GET /pieces/:id returns 404 for non-existent piece", async () => {
    const res = await app.request("/pieces/00000000-0000-0000-0000-000000000000", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });

  it("GET /pieces/:id returns 400 for invalid UUID", async () => {
    const res = await app.request("/pieces/not-a-uuid", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid piece ID");
  });

  it("PUT /pieces/:id updates a piece", async () => {
    const createRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "Update Test", designName: "Original" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/pieces/${created.id}`, {
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

  it("PUT /pieces/:id returns 400 for empty body", async () => {
    const createRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "Empty Update", designName: "Test" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/pieces/${created.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it("PUT /pieces/:id returns 404 for non-existent piece", async () => {
    const res = await app.request("/pieces/00000000-0000-0000-0000-000000000000", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "nope" }),
    });

    expect(res.status).toBe(404);
  });

  it("PUT /pieces/:id returns 400 for invalid UUID", async () => {
    const res = await app.request("/pieces/not-a-uuid", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "nope" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid piece ID");
  });

  it("DELETE /pieces/:id soft deletes a piece", async () => {
    const createRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "Delete Test", designName: "Bye" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/pieces/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const getRes = await app.request(`/pieces/${created.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(getRes.status).toBe(404);
  });

  it("DELETE /pieces/:id returns 404 for non-existent piece", async () => {
    const res = await app.request("/pieces/00000000-0000-0000-0000-000000000000", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });

  it("DELETE /pieces/:id returns 400 for invalid UUID", async () => {
    const res = await app.request("/pieces/not-a-uuid", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid piece ID");
  });

  it("rejects unauthenticated requests", async () => {
    const res = await app.request("/pieces");
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid piece input", async () => {
    const res = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON body on create", async () => {
    const res = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON body on update", async () => {
    const createRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "Malformed", designName: "Test" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/pieces/${created.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });
});

describe("Piece Routes - Status Actions", () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `piece-status-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Status Tester",
      }),
    });
    const body = await res.json();
    accessToken = body.accessToken;
  });

  it("POST /pieces/:id/status advances from stash to kitting", async () => {
    const createRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "Advance", designName: "Status Test" }),
    });
    const created = await createRes.json();
    expect(created.status).toBe("stash");

    const res = await app.request(`/pieces/${created.id}/status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("kitting");
    expect(body.startedAt).toBeTruthy();
  });

  it("POST /pieces/:id/status advances through full lifecycle", async () => {
    const createRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "Full", designName: "Lifecycle Test" }),
    });
    const created = await createRes.json();

    // stash -> kitting
    await app.request(`/pieces/${created.id}/status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // kitting -> wip
    await app.request(`/pieces/${created.id}/status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // wip -> stitched
    const stitchedRes = await app.request(`/pieces/${created.id}/status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const stitched = await stitchedRes.json();
    expect(stitched.status).toBe("stitched");
    expect(stitched.stitchedAt).toBeTruthy();

    // stitched -> at_finishing
    const finishingRes = await app.request(`/pieces/${created.id}/status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const finishing = await finishingRes.json();
    expect(finishing.status).toBe("at_finishing");
    expect(finishing.finishingAt).toBeTruthy();

    // at_finishing -> finished
    const finishedRes = await app.request(`/pieces/${created.id}/status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const finished = await finishedRes.json();
    expect(finished.status).toBe("finished");
    expect(finished.completedAt).toBeTruthy();
  });

  it("POST /pieces/:id/status returns 400 when already finished", async () => {
    const createRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "Already",
        designName: "Finished",
        status: "finished",
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/pieces/${created.id}/status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Piece is already finished");
  });

  it("POST /pieces/:id/status returns 404 for non-existent piece", async () => {
    const res = await app.request("/pieces/00000000-0000-0000-0000-000000000000/status", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });

  it("POST /pieces/:id/status returns 400 for invalid UUID", async () => {
    const res = await app.request("/pieces/not-a-uuid/status", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid piece ID");
  });

  it("PUT /pieces/:id/status/set sets an arbitrary status", async () => {
    const createRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "SetStatus", designName: "Test" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/pieces/${created.id}/status/set`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ status: "wip" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("wip");
  });

  it("PUT /pieces/:id/status/set returns 400 for invalid status", async () => {
    const createRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "BadStatus", designName: "Test" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/pieces/${created.id}/status/set`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ status: "invalid_status" }),
    });

    expect(res.status).toBe(400);
  });

  it("PUT /pieces/:id/status/set returns 404 for non-existent piece", async () => {
    const res = await app.request("/pieces/00000000-0000-0000-0000-000000000000/status/set", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ status: "wip" }),
    });

    expect(res.status).toBe(404);
  });

  it("PUT /pieces/:id/shelve returns piece to stash", async () => {
    const createRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "Shelve",
        designName: "Test",
        status: "wip",
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/pieces/${created.id}/shelve`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("stash");
    expect(body.startedAt).toBeNull();
  });

  it("PUT /pieces/:id/shelve returns 400 when already in stash", async () => {
    const createRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "AlreadyStash", designName: "Test" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/pieces/${created.id}/shelve`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Piece is already in stash");
  });

  it("PUT /pieces/:id/shelve returns 404 for non-existent piece", async () => {
    const res = await app.request("/pieces/00000000-0000-0000-0000-000000000000/shelve", {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });

  it("PUT /pieces/:id/shelve returns 400 for invalid UUID", async () => {
    const res = await app.request("/pieces/not-a-uuid/shelve", {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid piece ID");
  });
});

describe("Piece Routes - Image Management", () => {
  let accessToken: string;
  let pieceId: string;

  beforeAll(async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `piece-image-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Image Tester",
      }),
    });
    const body = await res.json();
    accessToken = body.accessToken;

    const pieceRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "Image Test Designer",
        designName: "Image Test Piece",
      }),
    });
    const pieceBody = await pieceRes.json();
    pieceId = pieceBody.id;
  });

  it("POST /pieces/:id/image uploads a valid JPEG", async () => {
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const jpegData = new Uint8Array(100);
    jpegData.set(jpegHeader);
    const blob = new Blob([jpegData], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("image", new File([blob], "test.jpg", { type: "image/jpeg" }));

    const res = await app.request(`/pieces/${pieceId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imageKey).toContain("pieces/");
    expect(body.imageKey).toContain(pieceId);
  });

  it("POST /pieces/:id/image rejects non-image file", async () => {
    const textData = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    const blob = new Blob([textData], { type: "text/plain" });

    const formData = new FormData();
    formData.append("image", new File([blob], "test.txt", { type: "text/plain" }));

    const res = await app.request(`/pieces/${pieceId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(400);
  });

  it("POST /pieces/:id/image rejects missing file", async () => {
    const formData = new FormData();

    const res = await app.request(`/pieces/${pieceId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(400);
  });

  it("POST /pieces/:id/image returns 404 for non-existent piece", async () => {
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const jpegData = new Uint8Array(100);
    jpegData.set(jpegHeader);
    const blob = new Blob([jpegData], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("image", new File([blob], "test.jpg", { type: "image/jpeg" }));

    const res = await app.request("/pieces/00000000-0000-0000-0000-000000000000/image", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(404);
  });

  it("POST /pieces/:id/image rejects file with spoofed MIME type", async () => {
    const textData = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello" but claiming JPEG
    const blob = new Blob([textData], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("image", new File([blob], "fake.jpg", { type: "image/jpeg" }));

    const res = await app.request(`/pieces/${pieceId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("File content does not match an allowed image format");
  });

  it("DELETE /pieces/:id/image deletes piece image", async () => {
    // Upload an image first
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const jpegData = new Uint8Array(100);
    jpegData.set(jpegHeader);
    const blob = new Blob([jpegData], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("image", new File([blob], "delete-test.jpg", { type: "image/jpeg" }));

    await app.request(`/pieces/${pieceId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    const res = await app.request(`/pieces/${pieceId}/image`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imageKey).toBeNull();
  });

  it("DELETE /pieces/:id/image returns 404 for non-existent piece", async () => {
    const res = await app.request("/pieces/00000000-0000-0000-0000-000000000000/image", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });
});

describe("Piece Routes - Journal Entries", () => {
  let accessToken: string;
  let pieceId: string;

  beforeAll(async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `piece-journal-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Journal Tester",
      }),
    });
    const body = await res.json();
    accessToken = body.accessToken;

    const pieceRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "Journal Test Designer",
        designName: "Journal Test Piece",
      }),
    });
    const pieceBody = await pieceRes.json();
    pieceId = pieceBody.id;
  });

  it("POST /pieces/:id/entries creates an entry with notes", async () => {
    const res = await app.request(`/pieces/${pieceId}/entries`, {
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
    expect(body.pieceId).toBe(pieceId);
  });

  it("POST /pieces/:id/entries creates an entry without notes", async () => {
    const res = await app.request(`/pieces/${pieceId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.pieceId).toBe(pieceId);
  });

  it("POST /pieces/:id/entries rejects non-existent piece", async () => {
    const res = await app.request("/pieces/00000000-0000-0000-0000-000000000000/entries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "Should fail" }),
    });

    expect(res.status).toBe(404);
  });

  it("POST /pieces/:id/entries returns 400 for invalid piece ID", async () => {
    const res = await app.request("/pieces/not-a-uuid/entries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "Should fail" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid piece ID");
  });

  it("GET /pieces/:id/entries lists entries", async () => {
    const res = await app.request(`/pieces/${pieceId}/entries`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("GET /pieces/:id/entries returns 404 for non-existent piece", async () => {
    const res = await app.request("/pieces/00000000-0000-0000-0000-000000000000/entries", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });

  it("GET /pieces/:id/entries/:entryId returns a single entry", async () => {
    const createRes = await app.request(`/pieces/${pieceId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "Single entry fetch test" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/pieces/${pieceId}/entries/${created.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(created.id);
    expect(body.notes).toBe("Single entry fetch test");
  });

  it("GET /pieces/:id/entries/:entryId returns 404 for non-existent entry", async () => {
    const res = await app.request(
      `/pieces/${pieceId}/entries/00000000-0000-0000-0000-000000000000`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(res.status).toBe(404);
  });

  it("GET /pieces/:id/entries/:entryId returns 400 for invalid entry ID", async () => {
    const res = await app.request(`/pieces/${pieceId}/entries/not-a-uuid`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid entry ID");
  });

  it("GET /pieces/:id/entries/:entryId returns 404 for non-existent piece", async () => {
    const createRes = await app.request(`/pieces/${pieceId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "Orphan test" }),
    });
    const created = await createRes.json();

    const res = await app.request(
      `/pieces/00000000-0000-0000-0000-000000000000/entries/${created.id}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(res.status).toBe(404);
  });

  it("PUT /pieces/:id/entries/:entryId updates entry notes", async () => {
    const createRes = await app.request(`/pieces/${pieceId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "Original notes" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/pieces/${pieceId}/entries/${created.id}`, {
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

  it("PUT /pieces/:id/entries/:entryId returns 404 for non-existent entry", async () => {
    const res = await app.request(
      `/pieces/${pieceId}/entries/00000000-0000-0000-0000-000000000000`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ notes: "Nope" }),
      },
    );

    expect(res.status).toBe(404);
  });

  it("PUT /pieces/:id/entries/:entryId returns 400 for invalid entry ID", async () => {
    const res = await app.request(`/pieces/${pieceId}/entries/not-a-uuid`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "Nope" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid entry ID");
  });

  it("DELETE /pieces/:id/entries/:entryId soft deletes an entry", async () => {
    const createRes = await app.request(`/pieces/${pieceId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "To be deleted" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/pieces/${pieceId}/entries/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("DELETE /pieces/:id/entries/:entryId returns 404 for non-existent entry", async () => {
    const res = await app.request(
      `/pieces/${pieceId}/entries/00000000-0000-0000-0000-000000000000`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(res.status).toBe(404);
  });

  it("DELETE /pieces/:id/entries/:entryId returns 404 for non-existent piece", async () => {
    const createRes = await app.request(`/pieces/${pieceId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "Orphan delete test" }),
    });
    const created = await createRes.json();

    const res = await app.request(
      `/pieces/00000000-0000-0000-0000-000000000000/entries/${created.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(res.status).toBe(404);
  });
});

describe("Piece Routes - Journal Images", () => {
  let accessToken: string;
  let pieceId: string;
  let entryId: string;

  beforeAll(async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `piece-journal-img-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Journal Image Tester",
      }),
    });
    const body = await res.json();
    accessToken = body.accessToken;

    const pieceRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "JournalImg Test Designer",
        designName: "JournalImg Test Piece",
      }),
    });
    const pieceBody = await pieceRes.json();
    pieceId = pieceBody.id;

    const entryRes = await app.request(`/pieces/${pieceId}/entries`, {
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

  it("POST /pieces/:id/entries/:entryId/images uploads a valid JPEG", async () => {
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const jpegData = new Uint8Array(100);
    jpegData.set(jpegHeader);
    const blob = new Blob([jpegData], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("image", new File([blob], "test.jpg", { type: "image/jpeg" }));

    const res = await app.request(`/pieces/${pieceId}/entries/${entryId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.imageKey).toContain("journals/");
    expect(body.sortOrder).toBe(0);
  });

  it("POST /pieces/:id/entries/:entryId/images auto-increments sortOrder", async () => {
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const jpegData = new Uint8Array(100);
    jpegData.set(jpegHeader);
    const blob = new Blob([jpegData], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("image", new File([blob], "test2.jpg", { type: "image/jpeg" }));

    const res = await app.request(`/pieces/${pieceId}/entries/${entryId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sortOrder).toBe(1);
  });

  it("POST /pieces/:id/entries/:entryId/images rejects non-image file", async () => {
    const textData = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    const blob = new Blob([textData], { type: "text/plain" });

    const formData = new FormData();
    formData.append("image", new File([blob], "test.txt", { type: "text/plain" }));

    const res = await app.request(`/pieces/${pieceId}/entries/${entryId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(400);
  });

  it("POST /pieces/:id/entries/:entryId/images rejects missing file", async () => {
    const formData = new FormData();

    const res = await app.request(`/pieces/${pieceId}/entries/${entryId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(400);
  });

  it("POST /pieces/:id/entries/:entryId/images rejects 5th image (max 4)", async () => {
    // Create a fresh entry for this test
    const entryRes = await app.request(`/pieces/${pieceId}/entries`, {
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
      const res = await app.request(`/pieces/${pieceId}/entries/${freshEntry.id}/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      expect(res.status).toBe(201);
    }

    // 5th upload should fail
    const formData = new FormData();
    formData.append("image", new File([makeJpeg()], "img4.jpg", { type: "image/jpeg" }));
    const res = await app.request(`/pieces/${pieceId}/entries/${freshEntry.id}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Maximum 4 images per entry");
  });

  it("POST /pieces/:id/entries/:entryId/images returns 404 for non-existent piece", async () => {
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const jpegData = new Uint8Array(100);
    jpegData.set(jpegHeader);
    const blob = new Blob([jpegData], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("image", new File([blob], "test.jpg", { type: "image/jpeg" }));

    const res = await app.request(
      `/pieces/00000000-0000-0000-0000-000000000000/entries/${entryId}/images`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      },
    );

    expect(res.status).toBe(404);
  });

  it("POST /pieces/:id/entries/:entryId/images returns 404 for non-existent entry", async () => {
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const jpegData = new Uint8Array(100);
    jpegData.set(jpegHeader);
    const blob = new Blob([jpegData], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("image", new File([blob], "test.jpg", { type: "image/jpeg" }));

    const res = await app.request(
      `/pieces/${pieceId}/entries/00000000-0000-0000-0000-000000000000/images`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      },
    );

    expect(res.status).toBe(404);
  });

  it("DELETE /pieces/:id/entries/:entryId/images/:imageId soft deletes an image", async () => {
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const jpegData = new Uint8Array(100);
    jpegData.set(jpegHeader);
    const blob = new Blob([jpegData], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("image", new File([blob], "delete-test.jpg", { type: "image/jpeg" }));

    const uploadRes = await app.request(`/pieces/${pieceId}/entries/${entryId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    const uploaded = await uploadRes.json();

    const res = await app.request(
      `/pieces/${pieceId}/entries/${entryId}/images/${uploaded.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("DELETE /pieces/:id/entries/:entryId/images/:imageId returns 404 for non-existent image", async () => {
    const res = await app.request(
      `/pieces/${pieceId}/entries/${entryId}/images/00000000-0000-0000-0000-000000000000`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(res.status).toBe(404);
  });

  it("DELETE /pieces/:id/entries/:entryId/images/:imageId rejects cross-user deletion", async () => {
    // Upload an image as the original user
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const jpegData = new Uint8Array(100);
    jpegData.set(jpegHeader);
    const blob = new Blob([jpegData], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("image", new File([blob], "cross-user.jpg", { type: "image/jpeg" }));

    const uploadRes = await app.request(`/pieces/${pieceId}/entries/${entryId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    const uploaded = await uploadRes.json();

    // Register another user
    const otherRes = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `cross-user-img-piece-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Other User",
      }),
    });
    const otherBody = await otherRes.json();

    // Other user tries to delete the image (should fail because piece lookup fails for wrong user)
    const deleteRes = await app.request(
      `/pieces/${pieceId}/entries/${entryId}/images/${uploaded.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${otherBody.accessToken}` },
      },
    );

    expect(deleteRes.status).toBe(404);
  });

  it("DELETE /pieces/:id/entries/:entryId/images/:imageId returns 400 for invalid image ID", async () => {
    const res = await app.request(
      `/pieces/${pieceId}/entries/${entryId}/images/not-a-uuid`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid image ID");
  });
});
