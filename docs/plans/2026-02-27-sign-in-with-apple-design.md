# Sign in with Apple — Design

## Goal

Add Sign in with Apple as an authentication method alongside existing email/password, plus implement the missing `/auth/refresh` endpoint.

## Decisions

- **Auth methods**: Apple + email/password (both available)
- **API design**: Generic `POST /auth/provider` endpoint (supports future Instagram/TikTok)
- **Token verification**: Server-side JWKS verification (Option A) — verify Apple's identity token JWT using their public keys, no Apple secrets needed on server
- **Display name**: Capture from Apple's first sign-in; prompt user if missing
- **Token refresh**: Include in this work since it's currently broken (iOS calls it, API doesn't have it)

## Architecture

### API: `POST /auth/provider`

**Request:**
```json
{
  "provider": "apple",
  "identityToken": "<JWT signed by Apple>",
  "fullName": { "givenName": "Enzo", "familyName": "Aquino" }
}
```

`fullName` is optional — Apple only sends it on the user's first sign-in.

**Flow:**
1. Validate request with Zod (`provider` must be `"apple"`, `identityToken` required)
2. Fetch Apple's JWKS from `https://appleid.apple.com/auth/keys` (cached in-memory, 24h TTL)
3. Verify identity token JWT: signature, issuer (`https://appleid.apple.com`), audience (bundle ID from `APPLE_BUNDLE_ID` env var), expiry
4. Extract `sub` (Apple's stable user ID) and `email` from token claims
5. Look up user by `provider = "apple"` AND `providerUserId = sub`
6. If found → existing user, issue new JWT tokens
7. If not found → create user (email from token, displayName from fullName or null), issue tokens
8. Return `{ user, accessToken, refreshToken, isNewUser }`

**Response:**
- `200` for existing user, `201` for new user
- `isNewUser: true` signals iOS to prompt for display name if none was provided

### API: `POST /auth/refresh`

**Request:**
```json
{ "refreshToken": "..." }
```

**Flow:**
1. Verify refresh token JWT signature and expiry
2. Look up user by `userId` from token claims (confirm user still exists)
3. Issue new access + refresh token pair
4. Return `{ accessToken, refreshToken }`

Fixes existing iOS `NetworkClient.attemptTokenRefresh()` which already calls this endpoint.

### JWKS Caching

Apple's public keys change infrequently. Cache strategy:
- In-memory cache with 24-hour TTL
- If verification fails with cached key, refresh cache once and retry (handles key rotation)
- No external cache dependency (Redis, etc.)

### iOS: Sign in with Apple Flow

1. User taps `SignInWithAppleButton` on `LoginView`
2. `AuthenticationServices` framework presents Apple's native sign-in sheet
3. On success, `AuthViewModel` receives `ASAuthorization` containing identity token + optional name
4. `AuthViewModel` sends `POST /auth/provider` with token and name
5. On success, store JWT tokens in Keychain via `NetworkClient.setTokens()`
6. If `isNewUser == true` and no displayName → prompt user to enter one, then `PATCH /users/me`
7. Navigate to main app

### Environment Config

New env var: `APPLE_BUNDLE_ID` — your app's bundle identifier, used to verify the `aud` claim in Apple's identity token.

## Existing Infrastructure

Already in place:
- `users.provider` column (default `"email"`, supports `"apple"`)
- `users.providerUserId` column (nullable, stores Apple's `sub`)
- `users.passwordHash` nullable (Apple users won't have one)
- `SignInWithAppleButton` in `LoginView.swift` (needs wiring)
- `NetworkClient.attemptTokenRefresh()` calls `POST /auth/refresh` (needs API endpoint)
- `KeychainHelper` for secure token storage
- JWT access (15m) + refresh (30d) token system

## Out of Scope

- Instagram/TikTok OAuth (future work, but `POST /auth/provider` is ready for them)
- Password reset flow
- Account linking (e.g., connecting Apple to existing email account)
- Rate limiting on auth endpoints
