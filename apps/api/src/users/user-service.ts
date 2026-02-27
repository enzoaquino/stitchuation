import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import { NotFoundError } from "../errors.js";
import type { UpdateProfileInput } from "./schemas.js";

export class UserService {
  async getProfile(userId: string) {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        bio: users.bio,
        experienceLevel: users.experienceLevel,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundError("User");
    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.displayName !== undefined) updateData.displayName = input.displayName;
    if (input.bio !== undefined) updateData.bio = input.bio;
    if (input.experienceLevel !== undefined) updateData.experienceLevel = input.experienceLevel;

    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        bio: users.bio,
        experienceLevel: users.experienceLevel,
      });

    if (!user) throw new NotFoundError("User");
    return user;
  }
}
