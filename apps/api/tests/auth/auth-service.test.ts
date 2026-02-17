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

  describe("login", () => {
    it("returns tokens for valid credentials", async () => {
      const email = `login-${Date.now()}@example.com`;
      await authService.register({
        email,
        password: "securepassword123",
        displayName: "Login User",
      });

      const result = await authService.login({
        email,
        password: "securepassword123",
      });

      expect(result.user.email).toBe(email);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it("rejects invalid password", async () => {
      const email = `bad-pw-${Date.now()}@example.com`;
      await authService.register({
        email,
        password: "securepassword123",
        displayName: "Bad PW User",
      });

      await expect(
        authService.login({ email, password: "wrongpassword" })
      ).rejects.toThrow("Invalid email or password");
    });

    it("rejects unknown email", async () => {
      await expect(
        authService.login({
          email: "nobody@example.com",
          password: "whatever",
        })
      ).rejects.toThrow("Invalid email or password");
    });
  });
});
