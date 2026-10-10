/**
 * Deferred axe findings (OQ-1 of the VNX-0802 plan): real violations on pages that already exist. The task does not change app code,
 * so each is listed here with the finding it belongs to, and the Reviewer triages the list. Rules:
 *  - an entry must match a violation that really occurs (an entry that matches nothing fails the test: the list cannot grow stale);
 *  - `selector` (optional) narrows the entry to violations whose target contains it; without it the entry covers the whole rule on that page;
 *  - `finding` names the entry in the report (.ai/tasks/VNX-0802-report.md).
 */
export type KnownA11y = {
  /** Path as scanned, e.g. "/" or "/b/e2e-builder/hire". */
  page: string;
  locale: "en" | "vi";
  /** Scan variant: omitted = the default scan; "mobile" = 360 px wide; "motion" = default scan with motion allowed; "nojs" = the page scripts are blocked. */
  variant?: "mobile" | "motion" | "nojs";
  ruleId: string;
  selector?: string;
  reason: string;
  finding: string;
};

export const KNOWN_A11Y: readonly KnownA11y[] = [
  // R1 of the VNX-0802 review: without JS the back cards of the hero deck stack over the front one and cover its buttons. Fixed by VNX-0807 T2, which removes these entries.
  { page: "/", locale: "en", variant: "nojs", ruleId: "target-size", reason: "back cards of the deck are not inert without JS", finding: "VNX-0802 R1" },
  { page: "/", locale: "vi", variant: "nojs", ruleId: "target-size", reason: "back cards of the deck are not inert without JS", finding: "VNX-0802 R1" },
];
