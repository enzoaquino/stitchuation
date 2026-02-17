import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import { signAccessToken, signRefreshToken } from "./jwt.js";
import type { RegisterInput, LoginInput } from "./schemas.js";

export class AuthService {
  async register(input: RegisterInput) {
    const passwordHash = await bcrypt.hash(input.password, 12);

    const [user] = await db
      .insert(users)
      .values({
        email: input.email,
        displayName: input.displayName,
        passwordHash,
        provider: "email",
      })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      });

    const tokenPayload = { userId: user.id, email: user.email };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    return { user, accessToken, refreshToken };
  }

  async login(input: LoginInput) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (!user || !user.passwordHash) {
      throw new Error("Invalid email or password");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new Error("Invalid email or password");
    }

    const tokenPayload = { userId: user.id, email: user.email };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      accessToken,
      refreshToken,
    };
  }
}
