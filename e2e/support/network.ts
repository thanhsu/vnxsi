import type { Page } from "@playwright/test";

type Watch = { origin: string; failures: string[]; allowed: RegExp[] };
const watches = new WeakMap<Page, Watch>();

/**
 * Records every failed request to the app's own origin (R2(a) of VNX-0807). A scan on a page whose own CSS, font or script failed to load
 * measures a broken page and reports false findings, so settle() turns such a failure into "E2E infrastructure: <url> failed (<errorText>)".
 * Call before the first goto. net::ERR_ABORTED is the browser cancelling its own request (navigation away, superseded image): not a network fault.
 * A request the test aborts on purpose is named with allowSameOriginFailure().
 */
export function watchSameOriginFailures(page: Page, baseURL: string): void {
  const watch: Watch = { origin: new URL(baseURL).origin, failures: [], allowed: [] };
  watches.set(page, watch);
  page.on("requestfailed", (req) => {
    const url = new URL(req.url());
    const errorText = req.failure()?.errorText ?? "unknown";
    if (url.origin !== watch.origin || errorText === "net::ERR_ABORTED") return;
    if (watch.allowed.some((re) => re.test(url.pathname))) return;
    watch.failures.push(`${req.url()} failed (${errorText})`);
  });
}

/** Names a request the test aborts on purpose (e.g. the scripts of the no-JS scan); `path` is matched against the URL path. */
export function allowSameOriginFailure(page: Page, path: RegExp): void {
  watches.get(page)?.allowed.push(path);
}

/** Throws when a same-origin request failed and was not named. No-op for a page without watchSameOriginFailures. */
export function assertNoSameOriginFailures(page: Page): void {
  const failures = watches.get(page)?.failures ?? [];
  if (failures.length > 0) throw new Error(`E2E infrastructure: ${failures.join("; ")}`);
}

/** True for a URL the test named with allowSameOriginFailure (its console "Failed to load resource" line is then expected, too). */
export function isAllowedFailure(page: Page, url: string): boolean {
  try {
    return watches.get(page)?.allowed.some((re) => re.test(new URL(url).pathname)) ?? false;
  } catch {
    return false;
  }
}
