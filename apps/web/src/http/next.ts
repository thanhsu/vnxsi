const FORBIDDEN = /[\x00-\x20\x7f\\]/;

/** Returns a same-site path or null. Blocks protocol-relative, absolute, backslash and control-char tricks. */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string" || !/^\/(?![/\\])/.test(value)) return null;
  if (FORBIDDEN.test(value)) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (FORBIDDEN.test(decoded) || decoded.startsWith("//")) return null;
  const u = new URL(value, "https://vnx.invalid");
  if (u.origin !== "https://vnx.invalid") return null;
  if (u.pathname.startsWith("//") || u.pathname.startsWith("/\\")) return null;
  return value;
}
