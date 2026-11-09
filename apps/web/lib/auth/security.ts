export const DEFAULT_AUTH_PATH = "/pilot/dashboard";

/** Only a canonical, same-origin application path may follow authentication. */
export function safeAuthPath(value: string | null | undefined): string {
  if (!value || value.length > 2048 || value !== value.trim()) return DEFAULT_AUTH_PATH;
  let decoded = value;
  try {
    for (let i = 0; i < 4; i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    const path = decoded.split(/[?#]/, 1)[0];
    if (!path.startsWith("/") || path.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(path) || /[\\\r\n]/.test(decoded)) return DEFAULT_AUTH_PATH;
    if (/%(?:2f|5c|25|0a|0d)/i.test(path)) return DEFAULT_AUTH_PATH;
    const base = "https://auth.invalid";
    const resolved = new URL(value, base);
    const decodedUrl = new URL(decoded, base);
    if (resolved.origin !== base || decodedUrl.origin !== base || (resolved.pathname.startsWith("//") || decodedUrl.pathname.startsWith("//"))) return DEFAULT_AUTH_PATH;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return DEFAULT_AUTH_PATH;
  }
}

export function signInFailure(error: {status?: number; code?: string}): "invalid" | "unavailable" | "limited" {
  if (error.status === 429 || error.code === "over_request_rate_limit") return "limited";
  if (!error.status || error.status >= 500 || ["email_provider_disabled", "provider_disabled"].includes(error.code ?? "")) return "unavailable";
  return "invalid";
}

export function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validNewPassword(password: string, confirmation: string): boolean {
  return password.trim().length >= 12 && password.length <= 1024 && password === confirmation;
}

export function activeOperationsStaff(profile: {role?: string; status?: string} | null | undefined): boolean {
  return profile?.status === "active" && ["admin", "staff", "dispatcher"].includes(profile.role ?? "");
}
