import { describe, it, expect } from "vitest";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../src/auth/jwt.js";

describe("JWT helpers", () => {
  const payload = { userId: "test-user-id", email: "test@example.com" };

  describe("signAccessToken / verifyAccessToken", () => {
    it("signs and verifies a valid access token", () => {
      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.userId).toBe("test-user-id");
      expect(decoded.email).toBe("test@example.com");
    });

    it("rejects an invalid token", () => {
      expect(() => verifyAccessToken("garbage-token")).toThrow();
    });

    it("rejects a refresh token used as access token", () => {
      const refreshToken = signRefreshToken(payload);
      expect(() => verifyAccessToken(refreshToken)).toThrow();
    });
  });

  describe("signRefreshToken / verifyRefreshToken", () => {
    it("signs and verifies a valid refresh token", () => {
      const token = signRefreshToken(payload);
      const decoded = verifyRefreshToken(token);

      expect(decoded.userId).toBe("test-user-id");
      expect(decoded.email).toBe("test@example.com");
    });

    it("rejects an access token used as refresh token", () => {
      const accessToken = signAccessToken(payload);
      expect(() => verifyRefreshToken(accessToken)).toThrow();
    });
  });
});
