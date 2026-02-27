import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetStorage } from "../../src/storage/index.js";
import app from "../../src/app.js";

// This test requires Azurite running on localhost:10000 AND
// STORAGE_PROVIDER=azure in the environment (set in .env or vitest).
// Skip gracefully if not configured.
const isAzureConfigured =
  process.env.STORAGE_PROVIDER === "azure" &&
  !!process.env.AZURE_STORAGE_CONNECTION_STRING;

describe.skipIf(!isAzureConfigured)(
  "Azure Blob Storage Integration",
  () => {
    let accessToken: string;
    let pieceId: string;

    beforeAll(async () => {
      // Reset storage to pick up env
      resetStorage();

      // Register user
      const authRes = await app.request("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `azure-int-${Date.now()}@example.com`,
          password: "securepassword123",
          displayName: "Azure Tester",
        }),
      });
      const authBody = await authRes.json();
      accessToken = authBody.accessToken;

      // Create a piece
      const pieceRes = await app.request("/pieces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          designer: "Azure Test Designer",
          designName: "Azure Test Canvas",
        }),
      });
      const pieceBody = await pieceRes.json();
      pieceId = pieceBody.id;
    });

    afterAll(() => {
      resetStorage();
    });

    it("upload returns SAS URL as imageKey and image is directly fetchable", async () => {
      const formData = new FormData();
      const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const blob = new Blob([imageBytes], { type: "image/jpeg" });
      formData.append("image", blob, "azure-test.jpg");

      const uploadRes = await app.request(`/pieces/${pieceId}/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      expect(uploadRes.status).toBe(200);
      const body = await uploadRes.json();

      // imageKey should be a full URL with SAS token
      expect(body.imageKey).toContain("http");
      expect(body.imageKey).toContain("sig=");
      expect(body.imageKey).toContain(pieceId);

      // Fetch directly from blob storage (no API proxy)
      const directRes = await fetch(body.imageKey);
      expect(directRes.status).toBe(200);

      const directBytes = new Uint8Array(await directRes.arrayBuffer());
      // First 4 bytes should be JPEG magic bytes
      expect(directBytes[0]).toBe(0xff);
      expect(directBytes[1]).toBe(0xd8);
    });

    it("delete removes blob from storage", async () => {
      // Upload first
      const formData = new FormData();
      const blob = new Blob(
        [new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
        { type: "image/jpeg" },
      );
      formData.append("image", blob, "delete-test.jpg");

      const uploadRes = await app.request(`/pieces/${pieceId}/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const uploadBody = await uploadRes.json();
      const sasUrl = uploadBody.imageKey;

      // Delete via API
      const deleteRes = await app.request(`/pieces/${pieceId}/image`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(deleteRes.status).toBe(200);

      // Direct fetch should now 404
      const directRes = await fetch(sasUrl);
      expect(directRes.status).toBe(404);
    });
  },
);
