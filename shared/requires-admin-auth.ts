export function requiresAdminAuth(
  method: string,
  pathname: string,
  searchParams: URLSearchParams | Record<string, string | undefined>,
): boolean {
  const getParam = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) ?? undefined;
    }
    return searchParams[key];
  };

  if (pathname === "/api/admin/login") {
    return false;
  }

  if (method === "GET" && pathname === "/api/orders" && !getParam("phone")) {
    return true;
  }

  if (method === "PATCH" && /^\/api\/orders\/[^/]+\/status$/.test(pathname)) {
    return true;
  }

  if (method === "POST" && pathname === "/api/pizzas") {
    return true;
  }

  if (method === "PATCH" && /^\/api\/pizzas\/[^/]+$/.test(pathname)) {
    return true;
  }

  if (method === "PATCH" && pathname === "/api/settings") {
    return true;
  }

  if (pathname === "/api/batches" && (method === "POST")) {
    return true;
  }

  if (/^\/api\/batches\/[^/]+$/.test(pathname) && (method === "PATCH" || method === "DELETE")) {
    return true;
  }

  if (/^\/api\/batches\/[^/]+\/pizzas$/.test(pathname) && (method === "POST")) {
    return true;
  }

  if (/^\/api\/batches\/[^/]+\/pizzas\/[^/]+$/.test(pathname) && (method === "PATCH" || method === "DELETE")) {
    return true;
  }

  if (pathname === "/api/slot-lists" && method === "GET") {
    return true;
  }

  if (pathname === "/api/slot-lists" && method === "POST") {
    return true;
  }

  if (/^\/api\/slot-lists\/[^/]+$/.test(pathname) && (method === "PATCH" || method === "DELETE")) {
    return true;
  }

  if (/^\/api\/slot-lists\/[^/]+\/slots$/.test(pathname) && method === "POST") {
    return true;
  }

  if (/^\/api\/slot-lists\/[^/]+\/slots\/[^/]+$/.test(pathname) && method === "DELETE") {
    return true;
  }

  return false;
}
