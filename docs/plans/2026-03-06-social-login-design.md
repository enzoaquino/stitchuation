# Social Login (Facebook + TikTok) Design

Add Facebook and TikTok login alongside Apple. Demote email/password to a subtle fallback link.

## Motivation

Target audience (crafters) is heavily on Instagram/TikTok. Instagram's API only supports Business/Creator accounts and prohibits auth use, so Facebook Login covers the Meta ecosystem instead.

## Auth Methods (after)

| Provider | Role | Notes |
|----------|------|-------|
| Apple | Primary | Existing, native iOS SDK |
| Facebook | Primary | New, server-side OAuth |
| TikTok | Primary | New, server-side OAuth |
| Email/password | Hidden fallback | Small "Sign in with email" link at bottom |

## OAuth Flow (Facebook & TikTok)

Both use server-side authorization code flow. Secrets stay on the API.

```
iOS App                    API                      Provider
   |                        |                            |
   |-- ASWebAuthSession --->|                            |
   |   opens /auth/{p}/authorize                         |
   |                        |-- 302 to provider -------->|
   |                        |                            |
   |   User logs in --------|------------------------->  |
   |                        |                            |
   |                        |<-- callback with code -----|
   |                        |                            |
   |                        |-- POST token exchange ---->|
   |                        |<-- access_token -----------|
   |                        |                            |
   |                        |-- GET user profile ------->|
   |                        |<-- id, name, avatar -------|
   |                        |                            |
   |<-- stitchuation://auth/callback?access_token=...&refresh_token=...
```

1. iOS opens `ASWebAuthenticationSession` pointing at `{apiBaseURL}/auth/{provider}/authorize`
2. API redirects to provider's consent screen
3. Provider redirects back to `{apiBaseURL}/auth/{provider}/callback` with authorization code
4. API exchanges code for provider access token, fetches user profile
5. API creates/links user, generates JWT tokens
6. API redirects to `stitchuation://auth/callback?access_token=...&refresh_token=...`
7. iOS extracts tokens from the callback URL

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/auth/facebook/authorize` | GET | Redirect to Facebook OAuth consent |
| `/auth/facebook/callback` | GET | Exchange code, create/link user, redirect to app |
| `/auth/tiktok/authorize` | GET | Redirect to TikTok OAuth consent |
| `/auth/tiktok/callback` | GET | Exchange code, create/link user, redirect to app |

## Provider Details

### Facebook

- **Auth URL**: `https://www.facebook.com/v21.0/dialog/oauth`
- **Token URL**: `https://graph.facebook.com/v21.0/oauth/access_token`
- **User Info URL**: `https://graph.facebook.com/me?fields=id,name,email,picture`
- **Scopes**: `email,public_profile`
- **User ID field**: `id`

### TikTok

- **Auth URL**: `https://www.tiktok.com/v2/auth/authorize/`
- **Token URL**: `https://open.tiktokapis.com/v2/oauth/token/`
- **User Info URL**: `https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url`
- **Scopes**: `user.info.basic`
- **User ID field**: `open_id`

## Database Changes

| Change | Details |
|--------|---------|
| `provider` column | Allow `"facebook"`, `"tiktok"` values (in addition to `"email"`, `"apple"`) |
| `profileImageUrl` column | New `text` column — stores avatar URL from social providers |

Existing `providerUserId` column stores the provider's unique user ID (Facebook `id` or TikTok `open_id`).

## Account Linking

Same logic as Apple Sign-In:
1. Check if `providerUserId` exists for this provider → return existing user
2. Check if provider email matches existing user → link provider to that account
3. Otherwise → create new user

Note: TikTok does not provide email in basic scope. If no email match is possible, always create a new user.

## iOS Changes

### LoginView Layout

```
┌─────────────────────────────┐
│                             │
│      [Stitchuation logo]    │
│                             │
│  ┌───────────────────────┐  │
│  │  Sign in with Apple   │  │  ← Native SignInWithAppleButton
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │  Continue with Facebook│  │  ← Custom button, Facebook blue
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │  Continue with TikTok │  │  ← Custom button, TikTok black
│  └───────────────────────┘  │
│                             │
│     Sign in with email      │  ← Small text link
│                             │
└─────────────────────────────┘
```

### AuthViewModel

Add methods:
- `loginWithFacebook()` — opens ASWebAuthenticationSession to `/auth/facebook/authorize`
- `loginWithTikTok()` — opens ASWebAuthenticationSession to `/auth/tiktok/authorize`
- `handleOAuthCallback(url:)` — extracts tokens from `stitchuation://auth/callback` URL

### URL Scheme

Register `stitchuation` as a custom URL scheme in the iOS app's Info.plist (or via Xcode target settings) so the API callback can redirect back to the app.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `FACEBOOK_APP_ID` | Facebook app identifier |
| `FACEBOOK_APP_SECRET` | Facebook app secret |
| `TIKTOK_CLIENT_KEY` | TikTok app client key |
| `TIKTOK_CLIENT_SECRET` | TikTok app client secret |
| `OAUTH_REDIRECT_BASE` | Base URL for callbacks (e.g., `https://api.dev.stitchuation.app`) |

## Scope

Full stack: DB migration, API OAuth routes + services, iOS auth flow + login view redesign.
