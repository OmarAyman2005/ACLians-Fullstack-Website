// client/src/lib/api.js

/**
 * Tiny fetch wrapper used across the app.
 * - Prefixes paths with /api (or NEXT_PUBLIC_API_URL if provided)
 * - Sends/receives JSON by default
 * - Includes credentials so httpOnly cookies flow
 * - Throws rich Error objects on non-2xx responses
 */

const API_BASE =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.NEXT_PUBLIC_API_URL &&
    process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "")) ||
  "/api";

// Optional local-dev fallback (only used on network/CORS failure)
const LOCAL_FALLBACK_BASE =
  (typeof window !== "undefined" &&
    !/^https?:\/\//i.test(API_BASE) &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")) ?
    `http://localhost:${(typeof process !== "undefined" &&
      process.env &&
      process.env.NEXT_PUBLIC_API_PORT) || 5000}` : null;

/** Build absolute URL from a relative API path */
function toUrl(path, base = API_BASE) {
  const p = String(path || "");
  return `${base}${p.startsWith("/") ? "" : "/"}${p}`;
}

/** Try to parse JSON safely */
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Main API helper.
 * Usage: api('/auth/login', { method:'POST', body:{ email, password } })
 */
export async function api(path, { method = "GET", body, headers } = {}) {
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  const requestInit = {
    method,
    credentials: "include", // send httpOnly JWT cookie
    mode: "cors",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      Accept: "application/json",
      ...(headers || {}),
    },
    body: body
      ? isFormData
        ? body
        : JSON.stringify(body)
      : undefined,
  };

  let res;
  let data;

  // First attempt (normal base)
  try {
    res = await fetch(toUrl(path), requestInit);
  } catch (e) {
    // If fetch failed at the network level (CORS/proxy), try local fallback once
    if (LOCAL_FALLBACK_BASE) {
      try {
        res = await fetch(toUrl(path, LOCAL_FALLBACK_BASE), requestInit);
      } catch {
        // Re-throw original error to keep behavior consistent
        throw e;
      }
    } else {
      throw e;
    }
  }

  data = await safeJson(res);

  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) ||
      `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data ?? {};
}

/** Convenience helpers (optional) */
export const get = (path, opts) => api(path, { ...(opts || {}), method: "GET" });
export const del = (path, opts) =>
  api(path, { ...(opts || {}), method: "DELETE" });
export const post = (path, body, opts) =>
  api(path, { ...(opts || {}), method: "POST", body });
export const patch = (path, body, opts) =>
  api(path, { ...(opts || {}), method: "PATCH", body });

/**
 * Log out:
 * - POST /auth/logout
 * - broadcast to other tabs
 * - redirect to /login?loggedout=1 (or custom)
 */
export async function appLogout(
  router,
  { redirectTo = "/welcome?loggedout=1" } = {}
) {
  try {
    await post("/auth/logout");
  } catch {
    // even if server failed, continue to clear client state/redirect
  }

  // Tell other tabs to clear any local state
  try {
    localStorage.setItem("__logout_broadcast__", String(Date.now()));
  } catch {
    // ignore
  }

  // Redirect
  if (router?.push) router.push(redirectTo);
  else if (typeof window !== "undefined") window.location.assign(redirectTo);
}

/**
 * Listen for logout events fired by other tabs.
 * Call from a layout or top-level component:
 *   useEffect(() => listenForLogout(() => router.refresh()), [router])
 */
export function listenForLogout(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = (e) => {
    if (e.key === "__logout_broadcast__") callback?.();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export const sportsBase = `${API_BASE}/sports`;
export const gymSessionsUrl = `${sportsBase}/gym/sessions`;
