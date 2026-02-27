import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app.js";

describe("User Routes", () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `user-routes-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Route Tester",
      }),
    });
    const body = await res.json();
    accessToken = (body as any).accessToken;
  });

  describe("GET /users/me", () => {
    it("returns 200 with profile for authenticated user", async () => {
      const res = await app.request("/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect((body as any).displayName).toBe("Route Tester");
      expect((body as any).bio).toBeNull();
      expect((body as any).experienceLevel).toBeNull();
    });

    it("returns 401 without auth", async () => {
      const res = await app.request("/users/me");
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /users/me", () => {
    it("returns 200 with updated profile", async () => {
      const res = await app.request("/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          displayName: "New Name",
          bio: "I love stitching",
          experienceLevel: "Intermediate",
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect((body as any).displayName).toBe("New Name");
      expect((body as any).bio).toBe("I love stitching");
      expect((body as any).experienceLevel).toBe("Intermediate");
    });

    it("returns 400 for invalid experienceLevel", async () => {
      const res = await app.request("/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ experienceLevel: "Master" }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 401 without auth", async () => {
      const res = await app.request("/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: "test" }),
      });
      expect(res.status).toBe(401);
    });
  });
});
