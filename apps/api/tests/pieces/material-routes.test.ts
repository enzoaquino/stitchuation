import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app.js";

describe("Material Routes", () => {
  let accessToken: string;
  let pieceId: string;

  beforeAll(async () => {
    const authRes = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `material-routes-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Material Route Tester",
      }),
    });
    const authBody = await authRes.json();
    accessToken = authBody.accessToken;

    const pieceRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "Test Designer",
        designName: "Test Canvas",
      }),
    });
    const pieceBody = await pieceRes.json();
    pieceId = pieceBody.id;
  });

  // --- POST /pieces/:id/materials ---

  it("POST /pieces/:id/materials creates a material with minimal fields", async () => {
    const res = await app.request(`/pieces/${pieceId}/materials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: "DMC 310 Black" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("DMC 310 Black");
    expect(body.pieceId).toBe(pieceId);
    expect(body.materialType).toBe("other");
    expect(body.quantity).toBe(1);
  });

  it("POST /pieces/:id/materials creates a material with all fields", async () => {
    const res = await app.request(`/pieces/${pieceId}/materials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: "Silk Mori 1001",
        materialType: "thread",
        brand: "Caron Collection",
        code: "1001",
        quantity: 3,
        unit: "skeins",
        notes: "For background fill",
        acquired: true,
        sortOrder: 5,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Silk Mori 1001");
    expect(body.materialType).toBe("thread");
    expect(body.brand).toBe("Caron Collection");
    expect(body.code).toBe("1001");
    expect(body.quantity).toBe(3);
    expect(body.unit).toBe("skeins");
    expect(body.notes).toBe("For background fill");
    expect(body.acquired).toBe(1);
    expect(body.sortOrder).toBe(5);
  });

  it("POST /pieces/:id/materials returns 404 for non-existent piece", async () => {
    const res = await app.request(
      "/pieces/00000000-0000-0000-0000-000000000000/materials",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name: "Should fail" }),
      },
    );

    expect(res.status).toBe(404);
  });

  it("POST /pieces/:id/materials returns 400 for invalid body", async () => {
    const res = await app.request(`/pieces/${pieceId}/materials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it("POST /pieces/:id/materials returns 400 for invalid piece ID", async () => {
    const res = await app.request("/pieces/not-a-uuid/materials", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: "Should fail" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid piece ID");
  });

  // --- POST /pieces/:id/materials/batch ---

  it("POST /pieces/:id/materials/batch creates multiple materials", async () => {
    const res = await app.request(`/pieces/${pieceId}/materials/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify([
        { name: "Batch Thread 1", materialType: "thread", brand: "DMC" },
        { name: "Batch Bead 1", materialType: "bead", code: "M42" },
        { name: "Batch Accessory 1", materialType: "accessory" },
      ]),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(3);
    expect(body[0].name).toBe("Batch Thread 1");
    expect(body[1].name).toBe("Batch Bead 1");
    expect(body[2].name).toBe("Batch Accessory 1");
  });

  it("POST /pieces/:id/materials/batch rejects empty array", async () => {
    const res = await app.request(`/pieces/${pieceId}/materials/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify([]),
    });

    expect(res.status).toBe(400);
  });

  it("POST /pieces/:id/materials/batch returns 404 for non-existent piece", async () => {
    const res = await app.request(
      "/pieces/00000000-0000-0000-0000-000000000000/materials/batch",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify([{ name: "Should fail" }]),
      },
    );

    expect(res.status).toBe(404);
  });

  // --- GET /pieces/:id/materials ---

  it("GET /pieces/:id/materials lists materials", async () => {
    const res = await app.request(`/pieces/${pieceId}/materials`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("GET /pieces/:id/materials returns 404 for non-existent piece", async () => {
    const res = await app.request(
      "/pieces/00000000-0000-0000-0000-000000000000/materials",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(res.status).toBe(404);
  });

  it("GET /pieces/:id/materials returns 400 for invalid piece ID", async () => {
    const res = await app.request("/pieces/not-a-uuid/materials", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid piece ID");
  });

  // --- PUT /pieces/:id/materials/:materialId ---

  it("PUT /pieces/:id/materials/:materialId updates a material", async () => {
    // Create a material first
    const createRes = await app.request(`/pieces/${pieceId}/materials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: "Update Test Thread" }),
    });
    const created = await createRes.json();

    const res = await app.request(
      `/pieces/${pieceId}/materials/${created.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: "Updated Thread Name",
          acquired: true,
          quantity: 5,
        }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Updated Thread Name");
    expect(body.acquired).toBe(1);
    expect(body.quantity).toBe(5);
  });

  it("PUT /pieces/:id/materials/:materialId returns 404 for material on different piece", async () => {
    // Create a second piece
    const piece2Res = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "Cross", designName: "Material Check" }),
    });
    const piece2 = await piece2Res.json();

    // Create a material on piece2
    const matRes = await app.request(`/pieces/${piece2.id}/materials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: "Belongs to piece2" }),
    });
    const material = await matRes.json();

    // Try to update via original pieceId -- should fail
    const res = await app.request(
      `/pieces/${pieceId}/materials/${material.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name: "Hijacked" }),
      },
    );

    expect(res.status).toBe(404);
  });

  it("PUT /pieces/:id/materials/:materialId returns 404 for non-existent material", async () => {
    const res = await app.request(
      `/pieces/${pieceId}/materials/00000000-0000-0000-0000-000000000000`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name: "Nope" }),
      },
    );

    expect(res.status).toBe(404);
  });

  it("PUT /pieces/:id/materials/:materialId returns 400 for invalid material ID", async () => {
    const res = await app.request(
      `/pieces/${pieceId}/materials/not-a-uuid`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name: "Nope" }),
      },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid material ID");
  });

  it("PUT /pieces/:id/materials/:materialId returns 400 for empty body", async () => {
    const createRes = await app.request(`/pieces/${pieceId}/materials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: "Empty Update Test" }),
    });
    const created = await createRes.json();

    const res = await app.request(
      `/pieces/${pieceId}/materials/${created.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      },
    );

    expect(res.status).toBe(400);
  });

  // --- DELETE /pieces/:id/materials/:materialId ---

  it("DELETE /pieces/:id/materials/:materialId soft deletes a material", async () => {
    // Create a material to delete
    const createRes = await app.request(`/pieces/${pieceId}/materials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: "To be deleted" }),
    });
    const created = await createRes.json();

    const res = await app.request(
      `/pieces/${pieceId}/materials/${created.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("DELETE /pieces/:id/materials/:materialId removes material from listing", async () => {
    // Create a material
    const createRes = await app.request(`/pieces/${pieceId}/materials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: "Delete and verify gone" }),
    });
    const created = await createRes.json();

    // Delete it
    await app.request(`/pieces/${pieceId}/materials/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // List materials and verify it's gone
    const listRes = await app.request(`/pieces/${pieceId}/materials`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const materials = await listRes.json();
    const found = materials.find(
      (m: { id: string }) => m.id === created.id,
    );
    expect(found).toBeUndefined();
  });

  it("DELETE /pieces/:id/materials/:materialId returns 404 for non-existent material", async () => {
    const res = await app.request(
      `/pieces/${pieceId}/materials/00000000-0000-0000-0000-000000000000`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(res.status).toBe(404);
  });

  it("DELETE /pieces/:id/materials/:materialId returns 404 for material on different piece", async () => {
    // Create another piece
    const piece2Res = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "CrossDelete",
        designName: "Material Check",
      }),
    });
    const piece2 = await piece2Res.json();

    // Create a material on piece2
    const matRes = await app.request(`/pieces/${piece2.id}/materials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: "Belongs to piece2 for delete" }),
    });
    const material = await matRes.json();

    // Try to delete via original pieceId -- should fail
    const res = await app.request(
      `/pieces/${pieceId}/materials/${material.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(res.status).toBe(404);
  });

  it("DELETE /pieces/:id/materials/:materialId returns 400 for invalid material ID", async () => {
    const res = await app.request(
      `/pieces/${pieceId}/materials/not-a-uuid`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid material ID");
  });
});
