/** Returns a same-site path or null. Blocks protocol-relative, absolute and backslash tricks. */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (decoded.startsWith("//") || decoded.includes("\\") || value.startsWith("//")) return null;
  return value;
}
