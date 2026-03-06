import { Hono } from "hono";
import crypto from "node:crypto";
import { AuthService, AuthError } from "./auth-service.js";
import { getAuthorizationUrl } from "./oauth-providers.js";

const oauthRoutes = new Hono();
const authService = new AuthService();

// In-memory state store (maps state → { provider, createdAt })
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
