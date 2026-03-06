import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./jwt.js";
import { verifyAppleIdentityToken, AppleTokenError } from "./apple-token-verifier.js";
import { exchangeCodeForProfile, OAuthError } from "./oauth-providers.js";
import type { RegisterInput, LoginInput, ProviderAuthInput } from "./schemas.js";

function requireEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} must be set in production`);
  }
  return fallback;
}

const APPLE_BUNDLE_ID = requireEnv("APPLE_BUNDLE_ID", "com.enzoaquino.stitchuation");

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

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

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AuthError("Invalid refresh token");
    }

    // Verify user still exists
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user) {
      throw new AuthError("User not found");
    }

    const tokenPayload = { userId: user.id, email: user.email };
    const accessToken = signAccessToken(tokenPayload);
    const newRefreshToken = signRefreshToken(tokenPayload);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async login(input: LoginInput) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (!user || !user.passwordHash) {
      throw new AuthError("Invalid email or password");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new AuthError("Invalid email or password");
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

  async providerAuth(input: ProviderAuthInput) {
    if (input.provider !== "apple") {
      throw new AuthError(`Unsupported provider: ${input.provider}`);
    }

    let claims;
    try {
      claims = await verifyAppleIdentityToken(input.identityToken, APPLE_BUNDLE_ID);
    } catch (error) {
      if (error instanceof AppleTokenError) {
        throw new AuthError(`Invalid Apple identity token: ${error.message}`);
      }
      throw error;
    }

    // Check for existing user with this Apple ID
    const [existing] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.providerUserId, claims.sub))
      .limit(1);

    if (existing) {
      const tokenPayload = { userId: existing.id, email: existing.email };
      const accessToken = signAccessToken(tokenPayload);
      const refreshToken = signRefreshToken(tokenPayload);
      return {
        user: existing,
        accessToken,
        refreshToken,
        isNewUser: false,
      };
    }

    // Check for existing user with same email — link Apple ID to their account
    if (claims.email) {
      const [emailMatch] = await db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
        })
        .from(users)
        .where(eq(users.email, claims.email))
        .limit(1);

      if (emailMatch) {
        await db
          .update(users)
          .set({ providerUserId: claims.sub })
          .where(eq(users.id, emailMatch.id));

        const tokenPayload = { userId: emailMatch.id, email: emailMatch.email };
        const accessToken = signAccessToken(tokenPayload);
        const refreshToken = signRefreshToken(tokenPayload);
        return {
          user: emailMatch,
          accessToken,
          refreshToken,
          isNewUser: false,
        };
      }
    }

    // Build display name from Apple's fullName (only sent on first sign-in)
    let displayName: string | null = null;
    if (input.fullName) {
      const parts = [input.fullName.givenName, input.fullName.familyName].filter(Boolean);
      if (parts.length > 0) {
        displayName = parts.join(" ");
      }
    }

    // Create new user
    const email = claims.email ?? `${claims.sub}@privaterelay.appleid.com`;
    const [user] = await db
      .insert(users)
      .values({
        email,
        displayName,
        provider: "apple",
        providerUserId: claims.sub,
      })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      });

    const tokenPayload = { userId: user.id, email: user.email };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    return {
      user,
      accessToken,
      refreshToken,
      isNewUser: true,
    };
  }

  async oauthProviderAuth(provider: string, code: string) {
    let profile;
    try {
      profile = await exchangeCodeForProfile(provider, code);
    } catch (error) {
      if (error instanceof OAuthError) {
        throw new AuthError(`OAuth failed: ${error.message}`);
      }
      throw error;
    }

    // Check for existing user with this provider ID (scoped by provider)
    const [existing] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      })
      .from(users)
      .where(and(eq(users.providerUserId, profile.id), eq(users.provider, provider)))
      .limit(1);

    if (existing) {
      const tokenPayload = { userId: existing.id, email: existing.email };
      const accessToken = signAccessToken(tokenPayload);
      const refreshToken = signRefreshToken(tokenPayload);
      return {
        user: existing,
        accessToken,
        refreshToken,
        isNewUser: false,
      };
    }

    // Check for existing user with same email — log them in (don't overwrite their provider binding)
    if (profile.email) {
      const [emailMatch] = await db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
        })
        .from(users)
        .where(eq(users.email, profile.email))
        .limit(1);

      if (emailMatch) {
        await db
          .update(users)
          .set({
            profileImageUrl: profile.profileImageUrl,
          })
          .where(eq(users.id, emailMatch.id));

        const tokenPayload = { userId: emailMatch.id, email: emailMatch.email };
        const accessToken = signAccessToken(tokenPayload);
        const refreshToken = signRefreshToken(tokenPayload);
        return {
          user: emailMatch,
          accessToken,
          refreshToken,
          isNewUser: false,
        };
      }
    }

    // Create new user
    const email = profile.email ?? `${provider}-${profile.id}@noreply.stitchuation.app`;
    const [user] = await db
      .insert(users)
      .values({
        email,
        displayName: profile.displayName,
        provider,
        providerUserId: profile.id,
        profileImageUrl: profile.profileImageUrl,
      })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      });

    const tokenPayload = { userId: user.id, email: user.email };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    return {
      user,
      accessToken,
      refreshToken,
      isNewUser: true,
    };
  }
}
