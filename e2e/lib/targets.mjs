import { readPorts } from "./ports.mjs";

// E2E never targets production: the suite POSTs forms and seeds its own database. Production is checked by `npm run smoke` (VNX-0805).
// Only these hosts are accepted, whatever BASE_URL says.
export const ALLOWED_HOSTS = ["localhost", "127.0.0.1"];

/**
 * The origin the suite runs against: always the local server this suite starts itself.
 * BASE_URL is only accepted when it points at a local host and at the E2E port (it exists so a wrapper can pass the origin through).
 * @param {Record<string, string | undefined>} env
 * @returns {{ port: number, inspectorPort: number, origin: string }}
 */
export function resolveTarget(env) {
  const { port, inspectorPort } = readPorts(env);
  const raw = env.BASE_URL;
  if (raw !== undefined && raw !== "") {
    let url;
    try {
      url = new URL(raw);
    } catch {
      throw new Error(`BASE_URL is not a URL: "${raw}"`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`BASE_URL must be http(s), got ${url.protocol}`);
    if (!ALLOWED_HOSTS.includes(url.hostname)) {
      throw new Error(`E2E refuses to target "${url.hostname}": only localhost / 127.0.0.1 are allowed (production is checked by npm run smoke)`);
    }
    if (url.port !== String(port)) throw new Error(`BASE_URL port ${url.port || "(default)"} is not the E2E port ${port}`);
    return { port, inspectorPort, origin: url.origin };
  }
  return { port, inspectorPort, origin: `http://localhost:${port}` };
}
