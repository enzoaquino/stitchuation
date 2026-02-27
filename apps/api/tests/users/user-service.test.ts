import { describe, it, expect, beforeAll } from "vitest";
import { UserService } from "../../src/users/user-service.js";
import { AuthService } from "../../src/auth/auth-service.js";

describe("UserService", () => {
  const userService = new UserService();
  const authService = new AuthService();
  let userId: string;

  beforeAll(async () => {
    const result = await authService.register({
      email: `user-svc-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Test User",
    });
    userId = result.user.id;
  });

  describe("getProfile", () => {
    it("returns the user profile", async () => {
      const profile = await userService.getProfile(userId);
      expect(profile.id).toBe(userId);
      expect(profile.displayName).toBe("Test User");
      expect(profile.bio).toBeNull();
      expect(profile.experienceLevel).toBeNull();
    });

    it("throws NotFoundError for non-existent user", async () => {
      await expect(
        userService.getProfile("00000000-0000-0000-0000-000000000000")
      ).rejects.toThrow("User not found");
    });
  });

  describe("updateProfile", () => {
    it("updates displayName", async () => {
      const profile = await userService.updateProfile(userId, {
        displayName: "Updated Name",
      });
      expect(profile.displayName).toBe("Updated Name");
    });

    it("updates bio and experienceLevel", async () => {
      const profile = await userService.updateProfile(userId, {
        bio: "Loves needlepoint",
        experienceLevel: "Advanced",
      });
      expect(profile.bio).toBe("Loves needlepoint");
      expect(profile.experienceLevel).toBe("Advanced");
    });

    it("partially updates without overwriting other fields", async () => {
      await userService.updateProfile(userId, { bio: "Original bio" });
      const profile = await userService.updateProfile(userId, {
        experienceLevel: "Expert",
      });
      expect(profile.bio).toBe("Original bio");
      expect(profile.experienceLevel).toBe("Expert");
    });
  });
});
