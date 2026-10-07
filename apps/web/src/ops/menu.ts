import { can, type OpsCapability, type OpsRole } from "../domain/ops.ts";
import type { OpsMessageKey } from "../i18n/messages/en.ts";

/**
 * The Ops sidebar registry (VNX-2503; spec §2). Pure: no Hono, no D1. An item shows only when its route is registered
 * in the app and the role holds its capability, so the sidebar never carries a dead link or a page the role cannot open
 * (spec §2.1). Each later task adds its own item here when it registers its route.
 */

/** Sidebar groups, in display order. `main` has no heading. */
export const OPS_GROUPS = [
  { group: "main", labelKey: null },
  { group: "marketplace", labelKey: "ops.group.marketplace" },
  { group: "people", labelKey: "ops.group.people" },
  { group: "inbox", labelKey: "ops.group.inbox" },
  { group: "content", labelKey: "ops.group.content" },
  { group: "monetization", labelKey: "ops.group.monetization" },
  { group: "settings", labelKey: "ops.group.settings" },
] as const satisfies readonly { group: string; labelKey: OpsMessageKey | null }[];

export type OpsGroup = (typeof OPS_GROUPS)[number]["group"];

/** The icon names OpsLayout knows how to draw. */
export type OpsIcon = "overview" | "builders" | "products" | "requests" | "merchants";

/** Menu items that show how many items wait in their queue (the Overview counts). */
export type OpsMenuCount = "builders" | "products" | "requests";

export interface OpsMenuItem {
  group: OpsGroup;
  labelKey: OpsMessageKey;
  path: string;
  capability: OpsCapability;
  icon: OpsIcon;
  count?: OpsMenuCount;
}

export const OPS_MENU: readonly OpsMenuItem[] = [
  { group: "main", labelKey: "ops.nav.overview", path: "/ops", capability: "overview.view", icon: "overview" },
  { group: "marketplace", labelKey: "ops.nav.builders", path: "/ops/marketplace/builders", capability: "marketplace.view", icon: "builders", count: "builders" },
  { group: "marketplace", labelKey: "ops.nav.products", path: "/ops/marketplace/products", capability: "marketplace.view", icon: "products", count: "products" },
  { group: "marketplace", labelKey: "ops.nav.requests", path: "/ops/marketplace/requests", capability: "marketplace.view", icon: "requests", count: "requests" },
  { group: "monetization", labelKey: "ops.nav.merchants", path: "/ops/monetization/merchants", capability: "monetization.view", icon: "merchants" },
];

/** Whether a GET route with exactly this path is registered in the app. */
export type IsRegistered = (path: string) => boolean;

/** The one test for any link to an Ops page (sidebar, queue card): the route exists and the role may open it. */
export function reachable(role: OpsRole, path: string, capability: OpsCapability, isRegistered: IsRegistered): boolean {
  return isRegistered(path) && can(role, capability);
}

export interface VisibleItem {
  labelKey: OpsMessageKey;
  path: string;
  icon: OpsIcon;
  current: boolean;
  /** Items waiting in the queue, when the item has a count and it could be read. */
  count: number | null;
}

export interface VisibleGroup {
  group: OpsGroup;
  labelKey: OpsMessageKey | null;
  items: VisibleItem[];
}

/** The sidebar for this role: reachable items only, grouped in order; a group left empty is dropped with its heading. */
export function visibleMenu(
  role: OpsRole,
  isRegistered: IsRegistered,
  currentPath: string,
  items: readonly OpsMenuItem[] = OPS_MENU,
  counts: Partial<Record<OpsMenuCount, number>> = {},
): VisibleGroup[] {
  const groups: VisibleGroup[] = [];
  for (const { group, labelKey } of OPS_GROUPS) {
    const shown = items
      .filter((item) => item.group === group && reachable(role, item.path, item.capability, isRegistered))
      .map((item) => ({ labelKey: item.labelKey, path: item.path, icon: item.icon, current: item.path === currentPath, count: item.count ? (counts[item.count] ?? null) : null }));
    if (shown.length > 0) groups.push({ group, labelKey, items: shown });
  }
  return groups;
}
