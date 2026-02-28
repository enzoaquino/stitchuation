# Sign in with Apple Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Sign in with Apple as an auth method alongside email/password, plus implement the missing `/auth/refresh` endpoint.

**Architecture:** iOS uses `AuthenticationServices` to get an Apple identity token (JWT signed by Apple). iOS sends this token to a generic `POST /auth/provider` endpoint. The API verifies the token against Apple's JWKS public keys, creates or finds the user, and returns our JWT tokens. A new `POST /auth/refresh` endpoint handles token refresh (iOS already calls it but the endpoint doesn't exist).

**Tech Stack:** jose (JWT/JWKS verification), Zod (validation), Vitest (testing), AuthenticationServices (iOS)

---

### Task 1: Install jose and add APPLE_BUNDLE_ID env var

The `jose` library handles fetching Apple's JWKS and verifying JWTs — it's the standard choice for this. The existing `jsonwebtoken` library can't fetch JWKS.

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/.env.example`

**Step 1: Install jose**

```bash
cd apps/api && npm install jose
```

**Step 2: Add APPLE_BUNDLE_ID to .env.example**

Add after the `JWT_REFRESH_SECRET` line in `apps/api/.env.example`:

```env
# Apple Sign-In
APPLE_BUNDLE_ID=com.enzoaquino.stitchuation
```

**Step 3: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json apps/api/.env.example
git commit -m "feat(api): add jose dependency and APPLE_BUNDLE_ID env var"
```

---

### Task 2: Apple token verifier service

Create a standalone module that verifies Apple identity tokens against Apple's JWKS. This is isolated from auth logic so it's independently testable.

**Files:**
- Create: `apps/api/src/auth/apple-token-verifier.ts`
- Create: `apps/api/tests/auth/apple-token-verifier.test.ts`

**Step 1: Write the tests**

Create `apps/api/tests/auth/apple-token-verifier.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run tests/auth/apple-token-verifier.test.ts
```

Expected: FAIL — module `../../src/auth/apple-token-verifier.js` not found.

**Step 3: Write the implementation**

Create `apps/api/src/auth/apple-token-verifier.ts`:

```typescript
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

    return {
      sub: payload.sub!,
      email: typeof payload.email === "string" ? payload.email : null,
    };
  } catch (error) {
    throw new AppleTokenError(
      error instanceof Error ? error.message : "Invalid Apple identity token",
    );
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd apps/api && npx vitest run tests/auth/apple-token-verifier.test.ts
```

Expected: All 6 tests PASS.

**Step 5: Commit**

```bash
git add apps/api/src/auth/apple-token-verifier.ts apps/api/tests/auth/apple-token-verifier.test.ts
git commit -m "feat(api): add Apple identity token verifier with JWKS"
```

---

### Task 3: Token refresh endpoint

The iOS `NetworkClient.attemptTokenRefresh()` already calls `POST /auth/refresh` but the endpoint doesn't exist. Add it.

**Files:**
- Modify: `apps/api/src/auth/schemas.ts` (add refreshSchema)
- Modify: `apps/api/src/auth/auth-service.ts` (add refresh method)
- Modify: `apps/api/src/auth/auth-routes.ts` (add refresh route)
- Create: `apps/api/tests/auth/refresh-routes.test.ts`

**Step 1: Write the tests**

Create `apps/api/tests/auth/refresh-routes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import app from "../../src/app.js";
import { signRefreshToken, signAccessToken } from "../../src/auth/jwt.js";

describe("POST /auth/refresh", () => {
  it("returns new tokens for a valid refresh token", async () => {
    // Register a user to get a valid refresh token
    const regRes = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `refresh-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Refresh User",
      }),
    });
    const { refreshToken } = await regRes.json();

    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });

  it("returns 401 for an invalid refresh token", async () => {
    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "garbage" }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 for an access token used as refresh token", async () => {
    const accessToken = signAccessToken({ userId: "fake-id", email: "a@b.com" });

    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: accessToken }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 when user no longer exists", async () => {
    // Create a refresh token for a non-existent user
    const refreshToken = signRefreshToken({ userId: "00000000-0000-0000-0000-000000000000", email: "gone@example.com" });

    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 for missing refreshToken field", async () => {
    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run tests/auth/refresh-routes.test.ts
```

Expected: FAIL — 404 on `/auth/refresh`.

**Step 3: Add the refresh schema**

In `apps/api/src/auth/schemas.ts`, add after the `loginSchema`:

```typescript
export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshInput = z.infer<typeof refreshSchema>;
```

**Step 4: Add the refresh method to AuthService**

In `apps/api/src/auth/auth-service.ts`, add this import at the top:

```typescript
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./jwt.js";
```

(Replace the existing import that only imports `signAccessToken, signRefreshToken`.)

Add this method to the `AuthService` class:

```typescript
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
```

**Step 5: Add the refresh route**

In `apps/api/src/auth/auth-routes.ts`, add the import for `refreshSchema`:

```typescript
import { registerSchema, loginSchema, refreshSchema } from "./schemas.js";
```

Add this route after the `/login` route:

```typescript
authRoutes.post("/refresh", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await authService.refresh(parsed.data.refreshToken);
    return c.json(result, 200);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message }, 401);
    }
    throw error;
  }
});
```

**Step 6: Run tests**

```bash
cd apps/api && npx vitest run tests/auth/refresh-routes.test.ts
```

Expected: All 5 tests PASS.

**Step 7: Run full test suite**

```bash
cd apps/api && npx vitest run
```

Expected: All tests pass (existing + new).

**Step 8: Commit**

```bash
git add apps/api/src/auth/schemas.ts apps/api/src/auth/auth-service.ts apps/api/src/auth/auth-routes.ts apps/api/tests/auth/refresh-routes.test.ts
git commit -m "feat(api): add POST /auth/refresh endpoint for token renewal"
```

---

### Task 4: Provider auth endpoint (POST /auth/provider)

Generic endpoint that accepts a provider name and identity token. Currently only supports "apple" but designed for future providers.

**Files:**
- Modify: `apps/api/src/auth/schemas.ts` (add providerAuthSchema)
- Modify: `apps/api/src/auth/auth-service.ts` (add providerAuth method)
- Modify: `apps/api/src/auth/auth-routes.ts` (add provider route)
- Create: `apps/api/tests/auth/provider-auth-routes.test.ts`

**Step 1: Write the tests**

Create `apps/api/tests/auth/provider-auth-routes.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import app from "../../src/app.js";

// Mock the Apple token verifier for route-level tests
vi.mock("../../src/auth/apple-token-verifier.js", () => ({
  AppleTokenError: class AppleTokenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AppleTokenError";
    }
  },
  verifyAppleIdentityToken: async (token: string, _bundleId: string) => {
    if (token === "valid-apple-token") {
      return {
        sub: "001234.testuser.1234",
        email: "apple@privaterelay.appleid.com",
      };
    }
    if (token === "valid-no-email") {
      return {
        sub: "001234.noemail.5678",
        email: null,
      };
    }
    throw new (class AppleTokenError extends Error {
      name = "AppleTokenError";
    })("Invalid token");
  },
}));

describe("POST /auth/provider", () => {
  it("returns 201 for a new Apple user with name", async () => {
    const res = await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "apple",
        identityToken: "valid-apple-token",
        fullName: { givenName: "Enzo", familyName: "Aquino" },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe("apple@privaterelay.appleid.com");
    expect(body.user.displayName).toBe("Enzo Aquino");
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.isNewUser).toBe(true);
  });

  it("returns 200 for an existing Apple user", async () => {
    // First sign-in creates the user
    await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "apple",
        identityToken: "valid-apple-token",
        fullName: { givenName: "Enzo", familyName: "Aquino" },
      }),
    });

    // Second sign-in finds existing user
    const res = await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "apple",
        identityToken: "valid-apple-token",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isNewUser).toBe(false);
    expect(body.user.displayName).toBe("Enzo Aquino");
  });

  it("returns 201 with null displayName when no name or email provided", async () => {
    const res = await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "apple",
        identityToken: "valid-no-email",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.displayName).toBeNull();
    expect(body.isNewUser).toBe(true);
  });

  it("returns 401 for an invalid Apple identity token", async () => {
    const res = await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "apple",
        identityToken: "bad-token",
      }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Invalid");
  });

  it("returns 400 for unsupported provider", async () => {
    const res = await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "instagram",
        identityToken: "some-token",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for missing identityToken", async () => {
    const res = await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "apple",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json{{{",
    });

    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run tests/auth/provider-auth-routes.test.ts
```

Expected: FAIL — 404 on `/auth/provider`.

**Step 3: Add the provider auth schema**

In `apps/api/src/auth/schemas.ts`, add:

```typescript
export const providerAuthSchema = z.object({
  provider: z.enum(["apple"]),
  identityToken: z.string().min(1),
  fullName: z.object({
    givenName: z.string().optional(),
    familyName: z.string().optional(),
  }).optional(),
});

export type ProviderAuthInput = z.infer<typeof providerAuthSchema>;
```

**Step 4: Add providerAuth method to AuthService**

In `apps/api/src/auth/auth-service.ts`, add this import:

```typescript
import { verifyAppleIdentityToken, AppleTokenError } from "./apple-token-verifier.js";
import type { ProviderAuthInput } from "./schemas.js";
```

And update the existing `RegisterInput, LoginInput` import to also include the new type (or keep the import from `./schemas.js` if already importing from there).

Add an env helper at the top of the file (after imports):

```typescript
function requireEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} must be set in production`);
  }
  return fallback;
}

const APPLE_BUNDLE_ID = requireEnv("APPLE_BUNDLE_ID", "com.enzoaquino.stitchuation");
```

Add this method to the `AuthService` class:

```typescript
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
```

**Important:** The `displayName` column is `notNull()` in the schema. We need to make it nullable for Apple users who don't provide a name on first sign-in. Add a Drizzle migration:

In `apps/api/src/db/schema.ts`, change line 14 from:

```typescript
  displayName: text("display_name").notNull(),
```

to:

```typescript
  displayName: text("display_name"),
```

Then generate and apply the migration:

```bash
cd apps/api && npx drizzle-kit generate && npx drizzle-kit migrate
```

**Step 5: Add the provider route**

In `apps/api/src/auth/auth-routes.ts`, update imports:

```typescript
import { registerSchema, loginSchema, refreshSchema, providerAuthSchema } from "./schemas.js";
```

Add this route after the `/refresh` route:

```typescript
authRoutes.post("/provider", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = providerAuthSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await authService.providerAuth(parsed.data);
    const status = result.isNewUser ? 201 : 200;
    return c.json(result, status);
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.message.includes("Unsupported provider")) {
        return c.json({ error: error.message }, 400);
      }
      return c.json({ error: error.message }, 401);
    }
    throw error;
  }
});
```

**Step 6: Run tests**

```bash
cd apps/api && npx vitest run tests/auth/provider-auth-routes.test.ts
```

Expected: All 7 tests PASS.

**Step 7: Run full test suite**

```bash
cd apps/api && npx vitest run
```

Expected: All tests pass. Some existing tests may need adjustment if they depend on `displayName` being required — check for failures and fix any that break due to the nullable `displayName` change.

**Step 8: Commit**

```bash
git add apps/api/src/auth/schemas.ts apps/api/src/auth/auth-service.ts apps/api/src/auth/auth-routes.ts apps/api/src/db/schema.ts apps/api/tests/auth/provider-auth-routes.test.ts apps/api/drizzle/
git commit -m "feat(api): add POST /auth/provider endpoint for Apple sign-in"
```

---

### Task 5: Deploy env var to Azure

Add `APPLE_BUNDLE_ID` to the Container App environment variables so the production API can verify Apple tokens.

**Files:**
- Modify: `infra/modules/container-apps.bicep`
- Modify: `.github/workflows/deploy.yml` (add env var to test job)

**Step 1: Add APPLE_BUNDLE_ID to container-apps.bicep**

In the `env` array of the container template (alongside existing env vars like `STORAGE_PROVIDER`, `PORT`, etc.), add:

```bicep
{
  name: 'APPLE_BUNDLE_ID'
  value: 'com.enzoaquino.stitchuation'
}
```

This is not a secret — it's a public bundle identifier.

**Step 2: Add to CI test job**

In `.github/workflows/deploy.yml`, add to the test job's `env` section:

```yaml
APPLE_BUNDLE_ID: com.enzoaquino.stitchuation
```

**Step 3: Commit**

```bash
git add infra/modules/container-apps.bicep .github/workflows/deploy.yml
git commit -m "feat(infra): add APPLE_BUNDLE_ID env var to container app and CI"
```

---

### Task 6: iOS — Wire up Sign in with Apple in AuthViewModel

Connect the `SignInWithAppleButton` to the backend via `AuthViewModel`.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Auth/AuthViewModel.swift`

**Step 1: Add Apple sign-in types and method**

Add these request/response types in `AuthViewModel.swift` (after the existing `LoginRequest` struct):

```swift
struct ProviderAuthRequest: Encodable {
    let provider: String
    let identityToken: String
    let fullName: FullName?

    struct FullName: Encodable {
        let givenName: String?
        let familyName: String?
    }
}

struct ProviderAuthResponse: Decodable {
    let user: AuthUser
    let accessToken: String
    let refreshToken: String
    let isNewUser: Bool
}
```

Add a new property to `AuthViewModel`:

```swift
    var needsDisplayName = false
```

Add this method to `AuthViewModel`:

```swift
    func handleAppleSignIn(result: Result<ASAuthorization, any Error>) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        guard case .success(let authorization) = result,
              let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            errorMessage = "Apple sign-in failed. Please try again."
            return
        }

        let fullName: ProviderAuthRequest.FullName?
        if let name = credential.fullName,
           (name.givenName != nil || name.familyName != nil) {
            fullName = ProviderAuthRequest.FullName(
                givenName: name.givenName,
                familyName: name.familyName
            )
        } else {
            fullName = nil
        }

        do {
            let response: ProviderAuthResponse = try await networkClient.request(
                method: "POST",
                path: "/auth/provider",
                body: ProviderAuthRequest(
                    provider: "apple",
                    identityToken: identityToken,
                    fullName: fullName
                )
            )
            await networkClient.setTokens(access: response.accessToken, refresh: response.refreshToken)

            if response.isNewUser && response.user.displayName == nil {
                needsDisplayName = true
            }

            isAuthenticated = true
        } catch let error as APIError {
            switch error {
            case .unauthorized:
                errorMessage = "Apple sign-in verification failed"
            default:
                errorMessage = "Something went wrong. Please try again."
            }
        } catch {
            errorMessage = "Network error. Please check your connection."
        }
    }

    func updateDisplayName() async {
        guard !displayName.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            let _: AuthUser = try await networkClient.request(
                method: "PATCH",
                path: "/users/me",
                body: ["displayName": displayName]
            )
            needsDisplayName = false
        } catch {
            errorMessage = "Could not save name. Please try again."
        }
    }
```

**Step 2: Update AuthUser to handle nullable displayName**

Change the `AuthUser` struct:

```swift
struct AuthUser: Decodable {
    let id: String
    let email: String
    let displayName: String?
}
```

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Auth/AuthViewModel.swift
git commit -m "feat(ios): add Apple sign-in handling to AuthViewModel"
```

---

### Task 7: iOS — Wire up LoginView to call AuthViewModel

Connect the `SignInWithAppleButton` in `LoginView` and add a display name prompt for new Apple users.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/LoginView.swift`

**Step 1: Update SignInWithAppleButton**

In `LoginView.swift`, replace the `SignInWithAppleButton` block (lines 37-44):

```swift
                    SignInWithAppleButton(.signIn) { request in
                        request.requestedScopes = [.email, .fullName]
                    } onCompletion: { result in
                        Task {
                            await authViewModel.handleAppleSignIn(result: result)
                        }
                    }
                    .signInWithAppleButtonStyle(.whiteOutline)
                    .frame(height: 50)
                    .cornerRadius(CornerRadius.subtle)
```

**Step 2: Add display name prompt sheet**

Add a `.sheet` modifier to the outermost `ZStack` (after `.onAppear`):

```swift
        .sheet(isPresented: Binding(
            get: { authViewModel.needsDisplayName },
            set: { authViewModel.needsDisplayName = $0 }
        )) {
            VStack(spacing: Spacing.xl) {
                Text("What should we call you?")
                    .font(.typeStyle(.title2))
                    .foregroundStyle(Color.espresso)

                TextField("Display Name", text: $authViewModel.displayName)
                    .textFieldStyle(.plain)
                    .font(.typeStyle(.body))
                    .padding(Spacing.md)
                    .background(Color.parchment)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))

                Button {
                    Task { await authViewModel.updateDisplayName() }
                } label: {
                    Text("Continue")
                        .font(.typeStyle(.headline))
                        .foregroundStyle(Color.cream)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.md)
                        .background(Color.terracotta)
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                        .warmShadow(.elevated)
                }
                .disabled(authViewModel.displayName.isEmpty || authViewModel.isLoading)
            }
            .padding(Spacing.xl)
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
            .interactiveDismissDisabled()
        }
```

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/LoginView.swift
git commit -m "feat(ios): wire Sign in with Apple button and display name prompt"
```

---

### Task 8: Run full API test suite and verify

**Step 1: Run all API tests**

```bash
cd apps/api && npx vitest run
```

Expected: All tests pass.

**Step 2: Verify no TypeScript errors**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

**Step 3: Final commit (if any fixes needed)**

If any tests or type checks fail, fix them and commit:

```bash
git add -A
git commit -m "fix(api): address test/type issues from Apple sign-in implementation"
```
