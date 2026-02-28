import { describe, it, expect, vi } from "vitest";
import { verifyAppleIdentityToken, AppleTokenError } from "../../src/auth/apple-token-verifier.js";
import { SignJWT, exportJWK, generateKeyPair } from "jose";

// Generate a test RSA key pair for signing fake Apple tokens
const { publicKey, privateKey } = await generateKeyPair("RS256");
const publicJwk = await exportJWK(publicKey);
publicJwk.kid = "test-key-id";
publicJwk.alg = "RS256";
publicJwk.use = "sig";

const BUNDLE_ID = "com.enzoaquino.stitchuation";

// Helper to create a signed JWT that looks like an Apple identity token
async function createFakeAppleToken(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, unknown> = {
    iss: "https://appleid.apple.com",
    aud: BUNDLE_ID,
    exp: now + 3600,
    iat: now,
    sub: "001234.abcdef1234567890.1234",
    email: "test@privaterelay.appleid.com",
    email_verified: true,
    ...overrides,
  };

  let builder = new SignJWT(claims as any)
    .setProtectedHeader({ alg: "RS256", kid: "test-key-id" });

  return builder.sign(privateKey);
}

// Mock the JWKS fetcher to return our test key
vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    createRemoteJWKSet: () => {
      // Return a function that resolves our test public key
      return async (protectedHeader: any) => {
        if (protectedHeader.kid === "test-key-id") {
          return publicKey;
        }
        throw new Error("Key not found");
      };
    },
  };
});

describe("verifyAppleIdentityToken", () => {
  it("returns claims for a valid token", async () => {
    const token = await createFakeAppleToken();
    const claims = await verifyAppleIdentityToken(token, BUNDLE_ID);

    expect(claims.sub).toBe("001234.abcdef1234567890.1234");
    expect(claims.email).toBe("test@privaterelay.appleid.com");
  });

  it("throws AppleTokenError for wrong audience", async () => {
    const token = await createFakeAppleToken({ aud: "com.wrong.app" });

    await expect(
      verifyAppleIdentityToken(token, BUNDLE_ID),
    ).rejects.toThrow(AppleTokenError);
  });

  it("throws AppleTokenError for wrong issuer", async () => {
    const token = await createFakeAppleToken({ iss: "https://evil.com" });

    await expect(
      verifyAppleIdentityToken(token, BUNDLE_ID),
    ).rejects.toThrow(AppleTokenError);
  });

  it("throws AppleTokenError for expired token", async () => {
    const token = await createFakeAppleToken({
      exp: Math.floor(Date.now() / 1000) - 3600,
      iat: Math.floor(Date.now() / 1000) - 7200,
    });

    await expect(
      verifyAppleIdentityToken(token, BUNDLE_ID),
    ).rejects.toThrow(AppleTokenError);
  });

  it("extracts email even when email_verified is a string 'true'", async () => {
    const token = await createFakeAppleToken({ email_verified: "true" });
    const claims = await verifyAppleIdentityToken(token, BUNDLE_ID);

    expect(claims.email).toBe("test@privaterelay.appleid.com");
  });

  it("returns null email when not present in token", async () => {
    const token = await createFakeAppleToken({ email: undefined });
    const claims = await verifyAppleIdentityToken(token, BUNDLE_ID);

    expect(claims.email).toBeNull();
  });
});
