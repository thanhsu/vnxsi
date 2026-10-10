// Ports of the E2E server. 8799 / 9329 on purpose: 8787 (npm run dev) and 9229 (wrangler's inspector default) are what other sessions use.
export const DEFAULT_PORT = 8799;
export const DEFAULT_INSPECTOR_PORT = 9329;

function readPort(name, raw, fallback) {
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d{1,5}$/.test(raw)) throw new Error(`${name} must be a whole number between 1024 and 65535, got "${raw}"`);
  const n = Number(raw);
  if (n < 1024 || n > 65535) throw new Error(`${name} must be between 1024 and 65535, got ${n}`);
  return n;
}

/** @param {Record<string, string | undefined>} env */
export function readPorts(env) {
  const port = readPort("E2E_PORT", env.E2E_PORT, DEFAULT_PORT);
  const inspectorPort = readPort("E2E_INSPECTOR_PORT", env.E2E_INSPECTOR_PORT, DEFAULT_INSPECTOR_PORT);
  if (port === inspectorPort) throw new Error("E2E_PORT and E2E_INSPECTOR_PORT must differ");
  return { port, inspectorPort };
}
