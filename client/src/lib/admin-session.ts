const ADMIN_TOKEN_KEY = "admin_token";

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function hasAdminToken(): boolean {
  return Boolean(getAdminToken());
}

export function adminAuthHeaders(): HeadersInit {
  const token = getAdminToken();
  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}
