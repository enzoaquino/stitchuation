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
