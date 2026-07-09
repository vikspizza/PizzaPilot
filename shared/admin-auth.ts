const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function verifyAdminPassword(password: string, expected: string | undefined): boolean {
  if (!expected) {
    return false;
  }
  return timingSafeEqualString(password, expected);
}

export async function createAdminToken(secret: string): Promise<string> {
  const expires = String(Date.now() + TOKEN_TTL_MS);
  const signature = await hmacSha256Hex(secret, expires);
  return `${expires}.${signature}`;
}

export async function verifyAdminToken(
  token: string | null | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (!secret || !token) {
    return false;
  }

  const separator = token.indexOf(".");
  if (separator === -1) {
    return false;
  }

  const expires = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expiresAt = Number(expires);

  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  const expectedSignature = await hmacSha256Hex(secret, expires);
  return timingSafeEqualString(signature, expectedSignature);
}

export function getBearerToken(authorizationHeader: string | null | undefined): string | null {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authorizationHeader.slice("Bearer ".length).trim() || null;
}
