import jwt from "jsonwebtoken";

function requireEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} must be set in production`);
  }
  return fallback;
}

const JWT_SECRET = requireEnv("JWT_SECRET", "dev-secret");
const JWT_REFRESH_SECRET = requireEnv("JWT_REFRESH_SECRET", "dev-refresh-secret");

export interface TokenPayload {
  userId: string;
  email: string;
}

function validatePayload(decoded: jwt.JwtPayload | string): TokenPayload {
  if (
    typeof decoded === "string" ||
    typeof decoded.userId !== "string" ||
    typeof decoded.email !== "string"
  ) {
    throw new Error("Invalid token payload");
  }
  return { userId: decoded.userId, email: decoded.email };
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "30d" });
}

export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
  return validatePayload(decoded);
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
  return validatePayload(decoded);
}
