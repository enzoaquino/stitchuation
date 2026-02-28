import { createRemoteJWKSet, jwtVerify } from "jose";

const APPLE_JWKS_URL = new URL("https://appleid.apple.com/auth/keys");
const jwks = createRemoteJWKSet(APPLE_JWKS_URL);

export class AppleTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppleTokenError";
  }
}

export interface AppleTokenClaims {
  /** Apple's stable user identifier (unique per developer team) */
  sub: string;
  /** User's email (may be a private relay address), null if not shared */
  email: string | null;
}

export async function verifyAppleIdentityToken(
  identityToken: string,
  bundleId: string,
): Promise<AppleTokenClaims> {
  try {
    const { payload } = await jwtVerify(identityToken, jwks, {
      issuer: "https://appleid.apple.com",
      audience: bundleId,
    });

    if (!payload.sub) {
      throw new AppleTokenError("Token missing sub claim");
    }

    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
    };
  } catch (error) {
    throw new AppleTokenError(
      error instanceof Error ? error.message : "Invalid Apple identity token",
    );
  }
}
