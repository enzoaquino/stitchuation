import { describe, it, expect, beforeEach } from "vitest";
import { AuthService, AuthError } from "../../src/auth/auth-service.js";
import { verifyAccessToken, verifyRefreshToken } from "../../src/auth/jwt.js";

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

    it("returns tokens containing correct userId and email", async () => {
      const email = `jwt-verify-${Date.now()}@example.com`;
      const result = await authService.register({
        email,
        password: "securepassword123",
        displayName: "JWT User",
      });

      const accessPayload = verifyAccessToken(result.accessToken);
      expect(accessPayload.userId).toBe(result.user.id);
      expect(accessPayload.email).toBe(email);

      const refreshPayload = verifyRefreshToken(result.refreshToken);
      expect(refreshPayload.userId).toBe(result.user.id);
      expect(refreshPayload.email).toBe(email);
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

    it("rejects invalid password with AuthError", async () => {
      const email = `bad-pw-${Date.now()}@example.com`;
      await authService.register({
        email,
        password: "securepassword123",
        displayName: "Bad PW User",
      });

      try {
        await authService.login({ email, password: "wrongpassword" });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).message).toBe("Invalid email or password");
      }
    });

    it("rejects unknown email with AuthError", async () => {
      try {
        await authService.login({
          email: "nobody@example.com",
          password: "whatever",
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).message).toBe("Invalid email or password");
      }
    });
  });
});
