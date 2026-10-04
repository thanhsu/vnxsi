import type { Context, Hono } from "hono";
import { z } from "zod";
import { randomToken, sha256Hex } from "../auth/crypto.ts";
import { requireAdmin } from "../auth/middleware.ts";
import { writeAudit } from "../db/audit.ts";
import { createInvite, listInvites } from "../db/invites.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { InvitesPage, type InviteErrors, type InviteField, type InviteFormValues } from "../views/admin/InvitesPage.tsx";
import { page } from "../views/render.ts";

const DAY_MS = 86_400_000;
const DEFAULTS: InviteFormValues = { maxUses: "1", days: "14", note: "" };
const InviteForm = z.object({
  maxUses: z.coerce.number().int().min(1).max(1000),
  days: z.coerce.number().int().min(1).max(90),
  note: z.string().trim().max(200),
});

const str = (value: unknown) => (typeof value === "string" ? value : "");

async function render(c: Context<AppEnv>, values: InviteFormValues, errors: InviteErrors, createdLink: string | null, status: 200 | 400 = 200) {
  const invites = await listInvites(c.env.DB);
  return page(c, <InvitesPage locale={c.get("locale")} origin={requestOrigin(c)} invites={invites} now={new Date()} values={values} errors={errors} createdLink={createdLink} />, status);
}

export function registerInviteAdminRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin/invites", requireAdmin, (c) => render(c, DEFAULTS, {}, null));

  onLocalized(app, "post", "/admin/invites", requireAdmin, async (c) => {
    const body = await c.req.parseBody();
    const values: InviteFormValues = { maxUses: str(body.maxUses), days: str(body.days), note: str(body.note) };
    const parsed = InviteForm.safeParse(values);
    if (!parsed.success) {
      const errors: InviteErrors = {};
      for (const issue of parsed.error.issues) errors[issue.path[0] as InviteField] = true;
      return render(c, values, errors, null, 400);
    }

    const now = new Date();
    const code = randomToken(16);
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(now.getTime() + parsed.data.days * DAY_MS).toISOString();
    const admin = c.get("user")!;
    await createInvite(c.env.DB, { codeHash, createdBy: admin.id, maxUses: parsed.data.maxUses, expiresAt, note: parsed.data.note || null, now: now.toISOString() });
    // The raw code is shown once on this response and never stored or logged.
    await writeAudit(c.env.DB, { actorUserId: admin.id, action: "invite.create", entity: "invite", entityId: codeHash, data: { maxUses: parsed.data.maxUses, expiresAt }, now: now.toISOString() });
    c.header("Cache-Control", "no-store");
    return render(c, DEFAULTS, {}, new URL(`/join/${code}`, c.env.APP_ORIGIN).toString());
  });
}
