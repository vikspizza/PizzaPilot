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

/** Resolve signing secret for review links (dedicated secret preferred). */
export function resolveReviewLinkSecret(
  reviewLinkSecret?: string,
  adminPassword?: string,
): string | undefined {
  const dedicated = reviewLinkSecret?.trim();
  if (dedicated) {
    return dedicated;
  }
  const fallback = adminPassword?.trim();
  return fallback || undefined;
}

/** Opaque token: orderId.hmacHex(orderId) */
export async function createReviewToken(orderId: string, secret: string): Promise<string> {
  const signature = await hmacSha256Hex(secret, orderId);
  return `${orderId}.${signature}`;
}

export async function verifyReviewToken(
  token: string | null | undefined,
  secret: string | undefined,
): Promise<{ ok: true; orderId: string } | { ok: false }> {
  if (!secret || !token) {
    return { ok: false };
  }

  const separator = token.indexOf(".");
  if (separator === -1) {
    return { ok: false };
  }

  const orderId = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!orderId || !signature) {
    return { ok: false };
  }

  const expectedSignature = await hmacSha256Hex(secret, orderId);
  if (!timingSafeEqualString(signature, expectedSignature)) {
    return { ok: false };
  }

  return { ok: true, orderId };
}

export async function buildReviewLinkUrl(
  siteUrl: string,
  orderId: string,
  secret: string,
): Promise<string> {
  const token = await createReviewToken(orderId, secret);
  const base = siteUrl.replace(/\/$/, "");
  return `${base}/review/?t=${encodeURIComponent(token)}`;
}
