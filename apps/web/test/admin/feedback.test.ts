import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { createFeedback, findFeedbackById, markFeedbackNotified, type NewFeedback } from "../../src/db/feedback.ts";
import { t } from "../../src/i18n/t.ts";
import { signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const get = (path: string, cookie?: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, cookie?: string) => app().request(formPost(path, {}, cookie ? { cookie } : {}), undefined, testEnv);
const admin = () => signIn("owner@vnx.si", { admin: true });
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";

let clock = Date.parse("2031-01-01T00:00:00.000Z");
async function make(overrides: Partial<NewFeedback> = {}, notified = true) {
  clock += 60_000;
  const now = new Date(clock).toISOString();
  const item = await createFeedback(testEnv.DB, {
    role: "client",
    kind: "suggestion",
    name: "Thu Ha",
    email: `fb-admin-${clock}@example.vn`,
    message: "Please add a filter for products that run on-premises.",
    locale: "vi",
    userId: null,
    now,
    ...overrides,
  });
  if (notified) await markFeedbackNotified(testEnv.DB, item.id, now);
  return (await findFeedbackById(testEnv.DB, item.id))!;
}

const auditCount = async (action: string, id: string) =>
  (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = ?1 AND entity = 'feedback' AND entity_id = ?2").bind(action, id).first<{ n: number }>())?.n;

describe("/admin/feedback access (plan VNX-0710 AC10)", () => {
  it("is admin-only: 403 for a signed-in non-admin, login for a visitor", async () => {
    const item = await make();
    const { cookie } = await signIn("fb-not-admin@vnx.si");
    expect((await get("/admin/feedback", cookie)).status).toBe(403);
    expect((await get(`/vi/admin/feedback/${item.id}`, cookie)).status).toBe(403);
    for (const action of ["handle", "spam", "reopen"]) expect((await post(`/admin/feedback/${item.id}/${action}`, cookie)).status, action).toBe(403);
    const visitor = await get("/admin/feedback");
    expect(visitor.status).toBe(303);
    expect(visitor.headers.get("location")).toContain("/login?next=");
    expect((await findFeedbackById(testEnv.DB, item.id))?.status).toBe("new");
  });
});

describe("/admin/feedback list (plan VNX-0710 AC10, AC9)", () => {
  it("shows new messages by default, newest first, with time, role, kind, e-mail and the first 120 characters", async () => {
    const long = `${"Lorem ipsum dolor sit amet ".repeat(6)}TAIL-NOT-SHOWN`;
    const older = await make({ message: long });
    const newer = await make({ role: "builder", kind: "partnership" });
    const { cookie } = await admin();
    const res = await get("/admin/feedback", cookie);
    expect(res.status).toBe(200);
    const main = mainOf(await res.text());
    expect(main.indexOf(newer.id)).toBeGreaterThanOrEqual(0);
    expect(main.indexOf(newer.id)).toBeLessThan(main.indexOf(older.id));
    expect(main).toContain(older.email);
    expect(main).toContain(long.slice(0, 120));
    expect(main).not.toContain("TAIL-NOT-SHOWN");
    expect(main).toContain(t("en", "contact.role.builder"));
    expect(main).toContain(t("en", "contact.kind.partnership"));
    expect(main).toContain(newer.createdAt.slice(0, 16).replace("T", " "));
    expect(main).toContain(`href="/admin/feedback/${newer.id}"`);
  });

  it("filters by status; an unknown status falls back to new", async () => {
    const handled = await make();
    await testEnv.DB.prepare("UPDATE feedback SET status = 'handled' WHERE id = ?1").bind(handled.id).run();
    const spam = await make();
    await testEnv.DB.prepare("UPDATE feedback SET status = 'spam' WHERE id = ?1").bind(spam.id).run();
    const fresh = await make();
    const { cookie } = await admin();
    const onlyHandled = mainOf(await (await get("/admin/feedback?status=handled", cookie)).text());
    expect(onlyHandled).toContain(handled.id);
    expect(onlyHandled).not.toContain(fresh.id);
    expect(onlyHandled).not.toContain(spam.id);
    const onlySpam = mainOf(await (await get("/admin/feedback?status=spam", cookie)).text());
    expect(onlySpam).toContain(spam.id);
    expect(onlySpam).not.toContain(handled.id);
    const bogus = await get("/admin/feedback?status=bogus", cookie);
    expect(bogus.status).toBe(200);
    const bogusMain = mainOf(await bogus.text());
    expect(bogusMain).toContain(fresh.id);
    expect(bogusMain).not.toContain(handled.id);
  });

  it("flags rows whose e-mail to contact@vnx.si was not sent (AC9)", async () => {
    const unsent = await make({}, false);
    const { cookie } = await admin();
    const main = mainOf(await (await get("/vi/admin/feedback", cookie)).text());
    const row = main.slice(main.indexOf(unsent.id));
    expect(row.slice(0, row.indexOf("</tr>"))).toContain(t("vi", "admin.feedback.notSent"));
    const detail = mainOf(await (await get(`/admin/feedback/${unsent.id}`, cookie)).text());
    expect(detail).toContain(t("en", "admin.feedback.notSent"));
  });

  it("pages 50 rows at a time", async () => {
    const { cookie } = await admin();
    const status = "spam";
    for (let i = 0; i < 51; i++) {
      const item = await make();
      await testEnv.DB.prepare("UPDATE feedback SET status = ?2 WHERE id = ?1").bind(item.id, status).run();
    }
    const first = mainOf(await (await get(`/admin/feedback?status=${status}`, cookie)).text());
    expect(first.match(/<tr data-id=/g)).toHaveLength(50);
    expect(first).toContain(`href="/admin/feedback?status=${status}&amp;page=2"`);
    const second = mainOf(await (await get(`/admin/feedback?status=${status}&page=2`, cookie)).text());
    expect(second.match(/<tr data-id=/g)!.length).toBeGreaterThanOrEqual(1);
  });

  it("shows Feedback in the admin nav with the number of new messages", async () => {
    await make();
    const { cookie } = await admin();
    const count = (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM feedback WHERE status = 'new'").first<{ n: number }>())!.n;
    const html = await (await get("/admin/feedback", cookie)).text();
    const nav = /<nav class="subnav" aria-label="[^"]*">([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? "";
    expect(nav).toMatch(new RegExp(`<a href="/admin/feedback"[^>]*>${t("en", "admin.nav.feedback")}\\s*<span class="count"[^>]*>${count}</span></a>`));
  });
});

describe("/admin/feedback/:id (plan VNX-0710 AC10)", () => {
  it("shows the full message as escaped plain text and a mailto reply link", async () => {
    const item = await make({ name: "<b>Eve</b>", message: "Hello <script>alert('x')</script>\n\n- first point\n- second point" });
    const { cookie } = await admin();
    const res = await get(`/admin/feedback/${item.id}`, cookie);
    expect(res.status).toBe(200);
    const main = mainOf(await res.text());
    expect(main).not.toContain("<script>alert");
    expect(main).toContain("Hello &lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(main).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(main).toContain("<li>first point</li>");
    expect(main).toMatch(new RegExp(`<a[^>]*href="mailto:${item.email}\\?subject=Re%3A%20`));
    expect(main).toContain(t("en", "admin.feedback.reply"));
    for (const action of ["handle", "spam"]) expect(main, action).toContain(`action="/admin/feedback/${item.id}/${action}"`);
    expect(main).not.toContain(`/${item.id}/reopen"`);
  });

  it("404s for an unknown id", async () => {
    const { cookie } = await admin();
    expect((await get("/admin/feedback/01NOSUCHFEEDBACK000000000", cookie)).status).toBe(404);
    expect((await post("/admin/feedback/01NOSUCHFEEDBACK000000000/handle", cookie)).status).toBe(404);
  });

  it("handle → reopen → spam → reopen, each with an audit row; invalid moves get 409", async () => {
    const item = await make();
    const { user, cookie } = await admin();
    const handled = await post(`/vi/admin/feedback/${item.id}/handle`, cookie);
    expect(handled.status).toBe(303);
    expect(handled.headers.get("location")).toBe(`/vi/admin/feedback/${item.id}`);
    expect(await findFeedbackById(testEnv.DB, item.id)).toMatchObject({ status: "handled", handledBy: user.id });
    expect(await auditCount("feedback.handle", item.id)).toBe(1);

    expect((await post(`/admin/feedback/${item.id}/handle`, cookie)).status).toBe(409);
    expect((await post(`/admin/feedback/${item.id}/spam`, cookie)).status).toBe(409);
    expect(await auditCount("feedback.handle", item.id)).toBe(1);

    const detail = mainOf(await (await get(`/admin/feedback/${item.id}`, cookie)).text());
    expect(detail).toContain(`action="/admin/feedback/${item.id}/reopen"`);

    expect((await post(`/admin/feedback/${item.id}/reopen`, cookie)).status).toBe(303);
    expect(await findFeedbackById(testEnv.DB, item.id)).toMatchObject({ status: "new", handledBy: null, handledAt: null });
    expect((await post(`/admin/feedback/${item.id}/reopen`, cookie)).status).toBe(409);

    expect((await post(`/admin/feedback/${item.id}/spam`, cookie)).status).toBe(303);
    expect((await findFeedbackById(testEnv.DB, item.id))?.status).toBe("spam");
    expect((await post(`/admin/feedback/${item.id}/handle`, cookie)).status).toBe(409);
    expect((await post(`/admin/feedback/${item.id}/reopen`, cookie)).status).toBe(303);

    expect(await auditCount("feedback.reopen", item.id)).toBe(2);
    expect(await auditCount("feedback.spam", item.id)).toBe(1);
    const row = await testEnv.DB.prepare("SELECT actor_user_id, data FROM audit_log WHERE action = 'feedback.spam' AND entity_id = ?1").bind(item.id).first<{ actor_user_id: string; data: string }>();
    expect(row?.actor_user_id).toBe(user.id);
    expect(JSON.parse(row!.data)).toEqual({ from: "new", to: "spam" });
  });
});
