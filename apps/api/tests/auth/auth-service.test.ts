import { describe, it, expect, beforeEach } from "vitest";
import { AuthService } from "../../src/auth/auth-service.js";

describe("AuthService", () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe("register", () => {
    it("creates a user and returns tokens", async () => {
      const result = await authService.register({
        email: `test-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Test User",
      });

      expect(result.user.email).toContain("@example.com");
      expect(result.user.displayName).toBe("Test User");
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.id).toBeDefined();
    });

    it("rejects duplicate emails", async () => {
      const email = `dup-${Date.now()}@example.com`;
      await authService.register({
        email,
        password: "securepassword123",
        displayName: "First User",
      });

      await expect(
        authService.register({
          email,
          password: "otherpassword123",
          displayName: "Second User",
        })
      ).rejects.toThrow();
    });
  });
});
