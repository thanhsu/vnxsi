import type { Page } from "@playwright/test";

export type CspWatch = {
  /** `securitypolicyviolation` events: "<directive> <blocked uri> <source file>:<line> <sample>". */
  violations: string[];
  /** console.error messages and uncaught page errors, minus the two kinds of noise explained below. */
  readonly errors: string[];
};

/** Every test blocks the network outside localhost, so the Turnstile script (challenges.cloudflare.com) always fails to load. That is intended. */
function isTurnstileNoise(url: string): boolean {
  try {
    return new URL(url).hostname === "challenges.cloudflare.com";
  } catch {
    return false;
  }
}

/**
 * Collects CSP violations and console/page errors of a page. Call before the first goto.
 * Chromium logs "Failed to load resource" for every 4xx/5xx, also for the page the test is deliberately asking for (a 400 form re-render, a 404 page):
 * the test asserts that status itself, so the log line of a failing DOCUMENT is not an error. A failing sub-resource (script, CSS, image) still is.
 */
export async function watchCsp(page: Page): Promise<CspWatch> {
  const violations: string[] = [];
  const raw: { text: string; url: string; resourceLog: boolean }[] = [];
  const pageErrors: string[] = [];
  const failedDocuments = new Set<string>();

  await page.exposeFunction("__reportCsp", (text: string) => {
    violations.push(text);
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __reportCsp: (t: string) => void }).__reportCsp(`${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber} ${e.sample.slice(0, 80)}`);
    });
  });
  page.on("response", (res) => {
    if (res.request().isNavigationRequest() && res.status() >= 400) failedDocuments.add(res.url());
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const url = msg.location().url;
    if (isTurnstileNoise(url)) return;
    raw.push({ text: msg.text(), url, resourceLog: msg.text().startsWith("Failed to load resource: the server responded with a status of") });
  });
  page.on("pageerror", (err) => {
    pageErrors.push(`pageerror: ${err.message}`);
  });

  return {
    violations,
    get errors() {
      return [
        ...raw.filter((m) => !(m.resourceLog && failedDocuments.has(m.url))).map((m) => `console.error: ${m.text} (${m.url})`),
        ...pageErrors,
      ];
    },
  };
}
