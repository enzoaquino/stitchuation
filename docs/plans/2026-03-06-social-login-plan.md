# Social Login (Facebook + TikTok) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Facebook and TikTok OAuth login alongside Apple, demote email/password to a hidden fallback link.

**Architecture:** Server-side OAuth authorization code flow. iOS opens `ASWebAuthenticationSession` → API redirects to provider → provider redirects back to API with code → API exchanges code for tokens, fetches user profile, creates/links user, redirects back to iOS via custom URL scheme with JWT tokens. Reuses existing `providerAuth` pattern from Apple Sign-In.

**Tech Stack:** TypeScript (Hono, Drizzle, Zod), Swift (SwiftUI, AuthenticationServices), PostgreSQL

---

### Task 1: Add profileImageUrl column to users table

**Files:**
- Modify: `apps/api/src/db/schema.ts:15-26`

**Step 1: Update schema**

In `apps/api/src/db/schema.ts`, add `profileImageUrl` to the users table. Change lines 15-26 from:

```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  passwordHash: text("password_hash"),
  provider: text("provider").notNull().default("email"),
  providerUserId: text("provider_user_id"),
  bio: text("bio"),
  experienceLevel: text("experience_level"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

to:

```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  passwordHash: text("password_hash"),
  provider: text("provider").notNull().default("email"),
  providerUserId: text("provider_user_id"),
  profileImageUrl: text("profile_image_url"),
  bio: text("bio"),
  experienceLevel: text("experience_level"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**Step 2: Generate migration**

Run: `cd apps/api && npm run db:generate`

**Step 3: Run migration**

Run: `cd apps/api && npm run db:migrate`

**Step 4: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat(api): add profileImageUrl column to users table"
```

---

### Task 2: Create OAuth provider modules (Facebook + TikTok)

**Files:**
- Create: `apps/api/src/auth/oauth-providers.ts`

**Step 1: Create the OAuth provider module**

Create `apps/api/src/auth/oauth-providers.ts` with provider configurations and helper functions for both Facebook and TikTok:

```typescript
export class OAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthError";
  }
}

export interface OAuthUserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
}

interface OAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string;
  clientIdEnv: string;
  clientSecretEnv: string;
}

const providers: Record<string, OAuthProviderConfig> = {
  facebook: {
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    userInfoUrl: "https://graph.facebook.com/me",
    scopes: "email,public_profile",
    clientIdEnv: "FACEBOOK_APP_ID",
    clientSecretEnv: "FACEBOOK_APP_SECRET",
  },
  tiktok: {
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    userInfoUrl: "https://open.tiktokapis.com/v2/user/info/",
    scopes: "user.info.basic",
    clientIdEnv: "TIKTOK_CLIENT_KEY",
    clientSecretEnv: "TIKTOK_CLIENT_SECRET",
  },
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getRedirectBase(): string {
  return process.env.OAUTH_REDIRECT_BASE ?? "http://localhost:3000";
}

export function getAuthorizationUrl(provider: string, state: string): string {
  const config = providers[provider];
  if (!config) throw new OAuthError(`Unknown OAuth provider: ${provider}`);

  const clientId = requireEnv(config.clientIdEnv);
  const redirectUri = `${getRedirectBase()}/auth/${provider}/callback`;

  if (provider === "tiktok") {
    const params = new URLSearchParams({
      client_key: clientId,
      response_type: "code",
      scope: config.scopes,
      redirect_uri: redirectUri,
      state,
    });
    return `${config.authorizeUrl}?${params}`;
  }

  // Facebook
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: config.scopes,
    response_type: "code",
    state,
  });
  return `${config.authorizeUrl}?${params}`;
}

export async function exchangeCodeForProfile(
  provider: string,
  code: string,
): Promise<OAuthUserProfile> {
  const config = providers[provider];
  if (!config) throw new OAuthError(`Unknown OAuth provider: ${provider}`);

  if (provider === "facebook") {
    return exchangeFacebookCode(config, code);
  }
  if (provider === "tiktok") {
    return exchangeTikTokCode(config, code);
  }
  throw new OAuthError(`Unsupported OAuth provider: ${provider}`);
}

async function exchangeFacebookCode(
  config: OAuthProviderConfig,
  code: string,
): Promise<OAuthUserProfile> {
  const clientId = requireEnv(config.clientIdEnv);
  const clientSecret = requireEnv(config.clientSecretEnv);
  const redirectUri = `${getRedirectBase()}/auth/facebook/callback`;

  // Exchange code for access token
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  const tokenRes = await fetch(`${config.tokenUrl}?${tokenParams}`);
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new OAuthError(`Facebook token exchange failed: ${err}`);
  }
  const tokenData = await tokenRes.json() as { access_token: string };

  // Fetch user profile
  const profileParams = new URLSearchParams({
    fields: "id,name,email,picture.type(large)",
    access_token: tokenData.access_token,
  });
  const profileRes = await fetch(`${config.userInfoUrl}?${profileParams}`);
  if (!profileRes.ok) {
    throw new OAuthError("Failed to fetch Facebook user profile");
  }
  const profile = await profileRes.json() as {
    id: string;
    name?: string;
    email?: string;
    picture?: { data?: { url?: string } };
  };

  return {
    id: profile.id,
    email: profile.email ?? null,
    displayName: profile.name ?? null,
    profileImageUrl: profile.picture?.data?.url ?? null,
  };
}

async function exchangeTikTokCode(
  config: OAuthProviderConfig,
  code: string,
): Promise<OAuthUserProfile> {
  const clientKey = requireEnv(config.clientIdEnv);
  const clientSecret = requireEnv(config.clientSecretEnv);
  const redirectUri = `${getRedirectBase()}/auth/tiktok/callback`;

  // Exchange code for access token
  const tokenBody = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const tokenRes = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new OAuthError(`TikTok token exchange failed: ${err}`);
  }
  const tokenData = await tokenRes.json() as {
    access_token: string;
    open_id: string;
  };

  // Fetch user profile
  const profileRes = await fetch(
    `${config.userInfoUrl}?fields=open_id,display_name,avatar_url`,
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    },
  );
  if (!profileRes.ok) {
    throw new OAuthError("Failed to fetch TikTok user profile");
  }
  const profileWrapper = await profileRes.json() as {
    data: { user: { open_id: string; display_name?: string; avatar_url?: string } };
  };
  const profile = profileWrapper.data.user;

  return {
    id: profile.open_id || tokenData.open_id,
    email: null, // TikTok basic scope does not provide email
    displayName: profile.display_name ?? null,
    profileImageUrl: profile.avatar_url ?? null,
  };
}
```

**Step 2: Commit**

```bash
git add apps/api/src/auth/oauth-providers.ts
git commit -m "feat(api): add OAuth provider modules for Facebook and TikTok"
```

---

### Task 3: Add OAuth routes (authorize + callback)

**Files:**
- Create: `apps/api/src/auth/oauth-routes.ts`
- Modify: `apps/api/src/auth/auth-service.ts:1-7,105-108`
- Modify: `apps/api/src/app.ts:2,13`

**Step 1: Update auth-service to handle Facebook and TikTok**

In `apps/api/src/auth/auth-service.ts`, add the import for the new OAuth module. Change line 6 from:

```typescript
import { verifyAppleIdentityToken, AppleTokenError } from "./apple-token-verifier.js";
```

to:

```typescript
import { verifyAppleIdentityToken, AppleTokenError } from "./apple-token-verifier.js";
import { exchangeCodeForProfile, OAuthError } from "./oauth-providers.js";
```

Add a new method `oauthProviderAuth` to the `AuthService` class. Add this after the closing `}` of the `providerAuth` method (after line 208):

```typescript
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

    // Check for existing user with this provider ID
    const [existing] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.providerUserId, profile.id))
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

    // Check for existing user with same email — link provider to their account
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
            provider,
            providerUserId: profile.id,
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
```

Also add `profileImageUrl` to the `users` import if it's not already imported by reference. The `users` object from `schema.ts` already includes the new column from Task 1, so no import change needed — Drizzle picks it up.

**Step 2: Create OAuth routes**

Create `apps/api/src/auth/oauth-routes.ts`:

```typescript
import { Hono } from "hono";
import crypto from "node:crypto";
import { AuthService, AuthError } from "./auth-service.js";
import { getAuthorizationUrl } from "./oauth-providers.js";

const oauthRoutes = new Hono();
const authService = new AuthService();

// In-memory state store (maps state → { provider, createdAt })
// In production, use Redis or DB. For now this is sufficient.
const pendingStates = new Map<string, { provider: string; createdAt: number }>();

// Clean up expired states (older than 10 minutes)
function cleanupStates() {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [key, value] of pendingStates) {
    if (value.createdAt < tenMinutesAgo) {
      pendingStates.delete(key);
    }
  }
}

function createAuthorizeHandler(provider: string) {
  return (c: any) => {
    cleanupStates();
    const state = crypto.randomBytes(32).toString("hex");
    pendingStates.set(state, { provider, createdAt: Date.now() });

    const url = getAuthorizationUrl(provider, state);
    return c.redirect(url);
  };
}

function createCallbackHandler(provider: string) {
  return async (c: any) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");

    if (error) {
      return c.redirect(`stitchuation://auth/callback?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return c.redirect("stitchuation://auth/callback?error=missing_params");
    }

    // Verify state
    const pending = pendingStates.get(state);
    if (!pending || pending.provider !== provider) {
      return c.redirect("stitchuation://auth/callback?error=invalid_state");
    }
    pendingStates.delete(state);

    try {
      const result = await authService.oauthProviderAuth(provider, code);
      const params = new URLSearchParams({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        is_new_user: result.isNewUser.toString(),
      });
      return c.redirect(`stitchuation://auth/callback?${params}`);
    } catch (err) {
      const message = err instanceof AuthError ? err.message : "auth_failed";
      return c.redirect(`stitchuation://auth/callback?error=${encodeURIComponent(message)}`);
    }
  };
}

oauthRoutes.get("/facebook/authorize", createAuthorizeHandler("facebook"));
oauthRoutes.get("/facebook/callback", createCallbackHandler("facebook"));
oauthRoutes.get("/tiktok/authorize", createAuthorizeHandler("tiktok"));
oauthRoutes.get("/tiktok/callback", createCallbackHandler("tiktok"));

export { oauthRoutes };
```

**Step 3: Mount OAuth routes in app**

In `apps/api/src/app.ts`, add the import. Change line 2:

```typescript
import { authRoutes } from "./auth/auth-routes.js";
```

to:

```typescript
import { authRoutes } from "./auth/auth-routes.js";
import { oauthRoutes } from "./auth/oauth-routes.js";
```

Add after line 13 (`app.route("/auth", authRoutes);`):

```typescript
app.route("/auth", oauthRoutes);
```

**Step 4: Commit**

```bash
git add apps/api/src/auth/oauth-providers.ts apps/api/src/auth/oauth-routes.ts apps/api/src/auth/auth-service.ts apps/api/src/app.ts
git commit -m "feat(api): add OAuth routes and service for Facebook and TikTok login"
```

---

### Task 4: Update .env.example with new OAuth variables

**Files:**
- Modify: `apps/api/.env.example:8-9`

**Step 1: Add OAuth environment variables**

In `apps/api/.env.example`, after the Apple Sign-In section (line 9), add:

```
# Facebook OAuth
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# TikTok OAuth
TIKTOK_CLIENT_KEY=your-tiktok-client-key
TIKTOK_CLIENT_SECRET=your-tiktok-client-secret

# OAuth redirect base URL (must match provider app settings)
OAUTH_REDIRECT_BASE=https://api.dev.stitchuation.app
```

**Step 2: Commit**

```bash
git add apps/api/.env.example
git commit -m "feat(api): add Facebook and TikTok OAuth env vars to .env.example"
```

---

### Task 5: Add tests for OAuth routes

**Files:**
- Create: `apps/api/tests/auth/oauth-routes.test.ts`

**Step 1: Write the tests**

Create `apps/api/tests/auth/oauth-routes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../../src/app.js";

// Mock the oauth-providers module
vi.mock("../../src/auth/oauth-providers.js", () => ({
  OAuthError: class OAuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "OAuthError";
    }
  },
  getAuthorizationUrl: (provider: string, state: string) => {
    return `https://mock.${provider}.com/oauth?state=${state}`;
  },
  exchangeCodeForProfile: async (provider: string, code: string) => {
    if (code === "invalid-code") {
      const { OAuthError } = await import("../../src/auth/oauth-providers.js");
      throw new OAuthError("Token exchange failed");
    }
    const suffix = Date.now().toString();
    if (provider === "facebook") {
      return {
        id: `fb-${suffix}`,
        email: `fbuser-${suffix}@example.com`,
        displayName: "Facebook User",
        profileImageUrl: "https://graph.facebook.com/photo.jpg",
      };
    }
    if (provider === "tiktok") {
      return {
        id: `tt-${suffix}`,
        email: null,
        displayName: "TikTok User",
        profileImageUrl: "https://p16.tiktokcdn.com/avatar.jpg",
      };
    }
    throw new Error(`Unknown provider: ${provider}`);
  },
}));

describe("OAuth authorize routes", () => {
  it("GET /auth/facebook/authorize redirects to Facebook", async () => {
    const res = await app.request("/auth/facebook/authorize", {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("Location");
    expect(location).toContain("mock.facebook.com");
  });

  it("GET /auth/tiktok/authorize redirects to TikTok", async () => {
    const res = await app.request("/auth/tiktok/authorize", {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("Location");
    expect(location).toContain("mock.tiktok.com");
  });
});

describe("OAuth callback routes", () => {
  it("GET /auth/facebook/callback with missing params redirects with error", async () => {
    const res = await app.request("/auth/facebook/callback", {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("stitchuation://auth/callback");
    expect(location).toContain("error=missing_params");
  });

  it("GET /auth/facebook/callback with invalid state redirects with error", async () => {
    const res = await app.request("/auth/facebook/callback?code=abc&state=bad-state", {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("error=invalid_state");
  });

  it("GET /auth/facebook/callback with provider error redirects with error", async () => {
    const res = await app.request("/auth/facebook/callback?error=access_denied", {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("error=access_denied");
  });

  it("Facebook OAuth full flow: authorize then callback creates user", async () => {
    // Step 1: Get authorize redirect to capture the state
    const authorizeRes = await app.request("/auth/facebook/authorize", {
      redirect: "manual",
    });
    const authorizeLocation = authorizeRes.headers.get("Location")!;
    const stateMatch = authorizeLocation.match(/state=([^&]+)/);
    expect(stateMatch).toBeTruthy();
    const state = stateMatch![1];

    // Step 2: Simulate callback with the state
    const callbackRes = await app.request(
      `/auth/facebook/callback?code=valid-code&state=${state}`,
      { redirect: "manual" },
    );

    expect(callbackRes.status).toBe(302);
    const callbackLocation = callbackRes.headers.get("Location")!;
    expect(callbackLocation).toContain("stitchuation://auth/callback");
    expect(callbackLocation).toContain("access_token=");
    expect(callbackLocation).toContain("refresh_token=");
    expect(callbackLocation).toContain("is_new_user=true");
  });

  it("TikTok OAuth full flow: authorize then callback creates user", async () => {
    const authorizeRes = await app.request("/auth/tiktok/authorize", {
      redirect: "manual",
    });
    const authorizeLocation = authorizeRes.headers.get("Location")!;
    const stateMatch = authorizeLocation.match(/state=([^&]+)/);
    const state = stateMatch![1];

    const callbackRes = await app.request(
      `/auth/tiktok/callback?code=valid-code&state=${state}`,
      { redirect: "manual" },
    );

    expect(callbackRes.status).toBe(302);
    const callbackLocation = callbackRes.headers.get("Location")!;
    expect(callbackLocation).toContain("stitchuation://auth/callback");
    expect(callbackLocation).toContain("access_token=");
    expect(callbackLocation).toContain("is_new_user=true");
  });
});
```

**Step 2: Run tests**

Run: `cd apps/api && npx vitest run`

Expected: All tests pass (including the new OAuth tests).

**Step 3: Commit**

```bash
git add apps/api/tests/auth/oauth-routes.test.ts
git commit -m "test(api): add OAuth route tests for Facebook and TikTok flows"
```

---

### Task 6: Register URL scheme in iOS and add OAuth handler

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Info.plist`
- Modify: `apps/ios/stitchuation/stitchuation/stitchuationApp.swift:7,42-44`

**Step 1: Register custom URL scheme**

In `apps/ios/stitchuation/stitchuation/Info.plist`, add URL scheme configuration. Change the file to:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>stitchuation</string>
			</array>
			<key>CFBundleURLName</key>
			<string>com.enzoaquino.stitchuation</string>
		</dict>
	</array>
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsLocalNetworking</key>
		<true/>
	</dict>
	<key>ITSAppUsesNonExemptEncryption</key>
	<false/>
	<key>UIAppFonts</key>
	<array>
		<string>PlayfairDisplay-Variable.ttf</string>
		<string>SourceSerif4-Variable.ttf</string>
	</array>
</dict>
</plist>
```

**Step 2: Add URL handler to app entry point**

In `apps/ios/stitchuation/stitchuation/stitchuationApp.swift`, add `.onOpenURL` handler to handle the OAuth callback. After the `.task { ... }` block (around line 74), and before the `#if canImport(UIKit)` block (line 75), add:

```swift
                .onOpenURL { url in
                    guard url.scheme == "stitchuation",
                          url.host == "auth",
                          url.path == "/callback" || url.pathComponents.contains("callback") else { return }

                    let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
                    let queryItems = components?.queryItems ?? []

                    if let error = queryItems.first(where: { $0.name == "error" })?.value {
                        authViewModel?.errorMessage = "Sign-in failed: \(error)"
                        return
                    }

                    guard let accessToken = queryItems.first(where: { $0.name == "access_token" })?.value,
                          let refreshToken = queryItems.first(where: { $0.name == "refresh_token" })?.value else {
                        authViewModel?.errorMessage = "Sign-in failed: missing tokens"
                        return
                    }

                    let isNewUser = queryItems.first(where: { $0.name == "is_new_user" })?.value == "true"

                    Task {
                        await networkClient.setTokens(access: accessToken, refresh: refreshToken)
                        authViewModel?.isAuthenticated = true
                        if isNewUser {
                            authViewModel?.needsDisplayName = true
                        }
                    }
                }
```

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Info.plist apps/ios/stitchuation/stitchuation/stitchuationApp.swift
git commit -m "feat(ios): register URL scheme and add OAuth callback handler"
```

---

### Task 7: Add OAuth login methods to AuthViewModel

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Auth/AuthViewModel.swift:1-3,46-62`

**Step 1: Add import and OAuth methods**

In `apps/ios/stitchuation/stitchuation/Auth/AuthViewModel.swift`, add the `AuthenticationServices` import for `ASWebAuthenticationSession`. Change line 1-3 from:

```swift
import Foundation
import Observation
import AuthenticationServices
```

to:

```swift
import Foundation
import Observation
import AuthenticationServices
@preconcurrency import SafariServices
```

Add a new property to the class (after `private let networkClient: NetworkClient` on line 58):

```swift
    private var webAuthSession: ASWebAuthenticationSession?
```

Add the OAuth login methods after the `handleAppleSignIn` method (after line 181):

```swift
    func loginWithOAuth(provider: String) {
        isLoading = true
        errorMessage = nil

        let baseURL = networkClient.baseURL
        guard let authorizeURL = URL(string: "\(baseURL)/auth/\(provider)/authorize") else {
            errorMessage = "Invalid configuration"
            isLoading = false
            return
        }

        let session = ASWebAuthenticationSession(
            url: authorizeURL,
            callbackURLScheme: "stitchuation"
        ) { [weak self] callbackURL, error in
            Task { @MainActor in
                guard let self else { return }
                self.isLoading = false

                if let error {
                    if (error as NSError).code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                        return // User cancelled, no error message needed
                    }
                    self.errorMessage = "Sign-in failed. Please try again."
                    return
                }

                // Token extraction is handled by onOpenURL in stitchuationApp
                // The ASWebAuthenticationSession redirects to stitchuation://auth/callback
                // which triggers onOpenURL. We just need to handle errors here.
                guard callbackURL != nil else {
                    self.errorMessage = "Sign-in failed. Please try again."
                    return
                }
            }
        }

        session.prefersEphemeralWebBrowserSession = true
        session.presentationContextProvider = WebAuthContextProvider.shared
        session.start()
        webAuthSession = session
    }
```

Add a presentation context provider as a private helper class at the bottom of the file, after the `AuthViewModel` class closing brace:

```swift
private class WebAuthContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = WebAuthContextProvider()

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first else {
            return ASPresentationAnchor()
        }
        return window
    }
}
```

**Step 2: Expose baseURL on NetworkClient**

The `loginWithOAuth` method needs access to `networkClient.baseURL`. Check if `baseURL` is already public on `NetworkClient`. If it's private, make it accessible by changing:

```swift
    private let baseURL: URL
```

to:

```swift
    let baseURL: URL
```

in `apps/ios/stitchuation/stitchuation/Sync/NetworkClient.swift:7`.

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Auth/AuthViewModel.swift apps/ios/stitchuation/stitchuation/Sync/NetworkClient.swift
git commit -m "feat(ios): add OAuth login methods for Facebook and TikTok"
```

---

### Task 8: Redesign LoginView with social buttons

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/LoginView.swift`

**Step 1: Replace LoginView body**

Replace the entire body of `LoginView.swift` with the new design — three social buttons stacked (Apple, Facebook, TikTok), with email/password hidden behind a small link:

```swift
import SwiftUI
import AuthenticationServices

struct LoginView: View {
    let networkClient: NetworkClient
    @Bindable var authViewModel: AuthViewModel

    @State private var showTitle = false
    @State private var showTagline = false
    @State private var showForm = false
    @State private var showEmailForm = false

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()

            VStack(spacing: Spacing.xl) {
                Spacer()

                // Brand
                Text("Stitchuation")
                    .font(.typeStyle(.largeTitle))
                    .foregroundStyle(Color.espresso)
                    .opacity(showTitle ? 1 : 0)
                    .offset(y: showTitle ? 0 : 15)

                Text("Your craft companion")
                    .font(.sourceSerif(17, weight: .regular))
                    .italic()
                    .foregroundStyle(Color.walnut)
                    .opacity(showTagline ? 1 : 0)
                    .offset(y: showTagline ? 0 : 10)

                Spacer().frame(height: Spacing.lg)

                // Social login buttons
                VStack(spacing: Spacing.md) {
                    // Apple
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

                    // Facebook
                    Button {
                        authViewModel.loginWithOAuth(provider: "facebook")
                    } label: {
                        HStack(spacing: Spacing.sm) {
                            Image(systemName: "f.circle.fill")
                                .font(.system(size: 20))
                            Text("Continue with Facebook")
                        }
                        .font(.typeStyle(.headline))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color(red: 0.231, green: 0.349, blue: 0.596))
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                    }
                    .disabled(authViewModel.isLoading)

                    // TikTok
                    Button {
                        authViewModel.loginWithOAuth(provider: "tiktok")
                    } label: {
                        HStack(spacing: Spacing.sm) {
                            Image(systemName: "music.note")
                                .font(.system(size: 18))
                            Text("Continue with TikTok")
                        }
                        .font(.typeStyle(.headline))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color.espresso)
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                    }
                    .disabled(authViewModel.isLoading)

                    // Error message
                    if let error = authViewModel.errorMessage {
                        HStack(spacing: Spacing.sm) {
                            Image(systemName: "exclamationmark.triangle.fill")
                            Text(error)
                        }
                        .font(.typeStyle(.subheadline))
                        .foregroundStyle(Color.dustyRose)
                        .multilineTextAlignment(.center)
                        .padding(Spacing.md)
                        .frame(maxWidth: .infinity)
                        .background(Color.dustyRose.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                    }

                    // Loading indicator
                    if authViewModel.isLoading {
                        ProgressView()
                            .tint(Color.terracotta)
                    }

                    // Email fallback
                    if showEmailForm {
                        HStack {
                            Rectangle().fill(Color.clay.opacity(0.3)).frame(height: 0.5)
                            Text("or")
                                .font(.typeStyle(.footnote))
                                .foregroundStyle(Color.clay)
                            Rectangle().fill(Color.clay.opacity(0.3)).frame(height: 0.5)
                        }

                        VStack(spacing: Spacing.md) {
                            if authViewModel.isRegistering {
                                TextField("Display Name", text: $authViewModel.displayName)
                            }
                            TextField("Email", text: $authViewModel.email)
                                .textContentType(.emailAddress)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                            SecureField("Password", text: $authViewModel.password)
                                .textContentType(authViewModel.isRegistering ? .newPassword : .password)
                        }
                        .textFieldStyle(.plain)
                        .font(.typeStyle(.body))
                        .padding(Spacing.md)
                        .background(Color.parchment)
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))

                        Button {
                            Task {
                                if authViewModel.isRegistering {
                                    await authViewModel.register()
                                } else {
                                    await authViewModel.login()
                                }
                            }
                        } label: {
                            Text(authViewModel.isRegistering ? "Create Account" : "Sign In")
                                .font(.typeStyle(.headline))
                                .foregroundStyle(Color.cream)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, Spacing.md)
                                .background(Color.terracotta)
                                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                                .warmShadow(.elevated)
                        }
                        .disabled(authViewModel.isLoading)

                        Button(authViewModel.isRegistering ? "Already have an account? Sign in" : "Create an account") {
                            authViewModel.isRegistering.toggle()
                        }
                        .font(.typeStyle(.footnote))
                        .foregroundStyle(Color.terracotta)
                    } else {
                        Button("Sign in with email") {
                            withAnimation(Motion.gentle) {
                                showEmailForm = true
                            }
                        }
                        .font(.typeStyle(.footnote))
                        .foregroundStyle(Color.walnut)
                    }
                }
                .padding(.horizontal, Spacing.xl)
                .opacity(showForm ? 1 : 0)
                .offset(y: showForm ? 0 : 15)

                Spacer()
            }
        }
        .onAppear {
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 0))) {
                showTitle = true
            }
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 1))) {
                showTagline = true
            }
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 3))) {
                showForm = true
            }
        }
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
    }
}
```

**Step 2: Build and verify**

Run: `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' 2>&1 | tail -5`

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/LoginView.swift
git commit -m "feat(ios): redesign login screen with Facebook and TikTok social buttons"
```

---

### Task 9: Update existing provider auth test for new schema

**Files:**
- Modify: `apps/api/tests/auth/provider-auth-routes.test.ts:153-164`

**Step 1: Update the unsupported provider test**

The existing test on line 153-164 sends `provider: "instagram"` and expects 400. Now that the schema allows `["apple"]` only, this still works — but the test description says "unsupported provider". Update it to use a provider that's truly unsupported (not facebook or tiktok, which now have OAuth routes):

Change lines 153-164 from:

```typescript
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
```

to:

```typescript
  it("returns 400 for unsupported provider", async () => {
    const res = await app.request("/auth/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "github",
        identityToken: "some-token",
      }),
    });

    expect(res.status).toBe(400);
  });
```

Note: The `/auth/provider` POST endpoint still only accepts `"apple"` in its Zod schema. Facebook and TikTok use the separate `/auth/{provider}/authorize` + `/auth/{provider}/callback` GET routes. The Zod `providerAuthSchema` does NOT need to change — it stays `z.enum(["apple"])` because Facebook/TikTok don't use the POST `/auth/provider` endpoint.

**Step 2: Run all tests**

Run: `cd apps/api && npx vitest run`

Expected: All tests pass.

**Step 3: Commit**

```bash
git add apps/api/tests/auth/provider-auth-routes.test.ts
git commit -m "test(api): update unsupported provider test to use non-OAuth provider name"
```
