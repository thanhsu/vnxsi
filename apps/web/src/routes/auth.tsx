import type { Context, Hono } from "hono";
import { z } from "zod";
import { adminEmails } from "../auth/admin.ts";
import { clearSessionCookie, readSessionCookie, writeSessionCookie } from "../auth/cookies.ts";
import { sha256Hex } from "../auth/crypto.ts";
import { createSession, deleteSession } from "../auth/sessions.ts";
import { consumeLoginToken, createLoginToken } from "../auth/tokens.ts";
import { writeAudit } from "../db/audit.ts";
import { createUser, findUserByEmail, markLogin } from "../db/users.ts";
import { getMailer } from "../email/index.ts";
import { loginEmail } from "../email/templates/login.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { onLocalized } from "../http/localized.ts";
import { safeNext } from "../http/next.ts";
import { hitRateLimit } from "../http/rate-limit.ts";
import { InvalidLinkPage, LoginPage, LoginSentPage } from "../views/auth.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

const LoginForm = z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) });

const HOUR = 3600;

function origin(c: Context<AppEnv>) {
  return new URL(c.req.url).origin;
}

export function registerAuthRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/login", (c) =>
    page(c, <LoginPage locale={c.get("locale")} origin={origin(c)} next={safeNext(c.req.query("next"))} />),
  );

  onLocalized(app, "post", "/login", async (c) => {
    const locale = c.get("locale");
    const tr = translator(locale);
    const form = await c.req.parseBody();
    const next = safeNext(form.next);
    const parsed = LoginForm.safeParse({ email: form.email });
    if (!parsed.success) {
      const typed = typeof form.email === "string" ? form.email : "";
      return page(c, <LoginPage locale={locale} origin={origin(c)} email={typed} next={next} error={tr("login.error.email")} />, 400);
    }
    const email = parsed.data.email;
    const now = new Date();
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const byEmail = await hitRateLimit(c.env.DB, `login:email:${await sha256Hex(email)}`, 5, HOUR, now.getTime());
    const byIp = await hitRateLimit(c.env.DB, `login:ip:${ip}`, 20, HOUR, now.getTime());
    if (!byEmail.allowed || !byIp.allowed) {
      return page(c, <LoginPage locale={locale} origin={origin(c)} email={email} next={next} error={tr("login.error.rateLimited")} />, 429);
    }

    const token = await createLoginToken(c.env.DB, { email, purpose: "login", locale }, now);
    const link = new URL("/auth/verify", c.env.APP_ORIGIN);
    link.searchParams.set("t", token);
    if (next) link.searchParams.set("next", next);
    try {
      await getMailer(c.env).send({ to: email, ...loginEmail(locale, link.toString()) });
    } catch (err) {
      console.error(JSON.stringify({ requestId: c.get("requestId"), event: "login.mail_failed", error: String(err) }));
      return page(c, <LoginPage locale={locale} origin={origin(c)} email={email} next={next} error={tr("login.error.sendFailed")} />, 502);
    }
    return page(c, <LoginSentPage locale={locale} origin={origin(c)} email={email} />);
  });

  app.get("/auth/verify", async (c) => {
    const now = new Date();
    const result = await consumeLoginToken(c.env.DB, c.req.query("t") ?? "", now, "login");
    if (!result.ok) return page(c, <InvalidLinkPage locale="en" origin={origin(c)} />, 400);

    const { email, locale } = result.token;
    const iso = now.toISOString();
    const user = (await findUserByEmail(c.env.DB, email)) ?? (await createUser(c.env.DB, { email, locale, now: iso }));
    if (user.status !== "active") return errorResponse(c, "forbidden", 403);

    await markLogin(c.env.DB, user.id, { now: iso, isAdmin: adminEmails(c.env).has(email) });
    await writeAudit(c.env.DB, { actorUserId: user.id, action: "auth.login", entity: "user", entityId: user.id, data: { purpose: result.token.purpose }, now: iso });
    writeSessionCookie(c, await createSession(c.env.DB, user.id, now));
    return c.redirect(safeNext(c.req.query("next")) ?? localizedPath(locale, "/"), 303);
  });

  app.post("/logout", async (c) => {
    const raw = readSessionCookie(c);
    if (raw) await deleteSession(c.env.DB, raw);
    clearSessionCookie(c);
    return c.redirect("/", 303);
  });
}
