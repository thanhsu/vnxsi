import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { addPortfolioItem } from "../../src/db/portfolio.ts";
import { makeBuilder } from "../fixtures.ts";
import { getReq, testEnv } from "../helpers.ts";

const get = (path: string) => createApp().request(getReq(path), undefined, testEnv);

describe("/b/:handle (spec §5.2)", () => {
  it("renders an approved builder with escaped text, safe links and hreflang", async () => {
    const b = await makeBuilder("pub-one@vnx.si", "pub-one", "approved", { bio: "Hi <script>alert(1)</script>\n\n- Booking", websiteUrl: "https://pub.example" });
    await addPortfolioItem(testEnv.DB, { builderId: b.userId, item: { title: "Spa booking", url: "https://spa.example", description: "" }, now: new Date().toISOString() });
    const res = await get("/b/pub-one");
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const text of ["Lan Nguyen", "I build booking apps with AI", "Vietnam", "$45/hour", "Open to new work", "Spa booking", "Next.js", "Claude Code"]) expect(html).toContain(text);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toMatch(/<a href="https:\/\/pub\.example" rel="nofollow ugc noopener"/);
    expect(html).toMatch(/<a href="https:\/\/spa\.example" rel="nofollow ugc noopener"/);
    expect(html).toContain('hreflang="vi" href="https://vnx.si/vi/b/pub-one"');
    expect(html).toContain('<link rel="canonical" href="https://vnx.si/b/pub-one"');
    expect(html).not.toContain('name="robots"');
  });

  it("localizes labels, country and money", async () => {
    await makeBuilder("pub-vi@vnx.si", "pub-vi", "approved");
    const html = await (await get("/vi/b/pub-vi")).text();
    expect(html).toContain("Việt Nam");
    expect(html).toContain("Đang nhận việc");
    expect(html).toMatch(/45\sUS\$\/giờ/);
  });

  it.each(["pending", "rejected", "suspended"] as const)("404s for a %s builder", async (status) => {
    await makeBuilder(`pub-${status}@vnx.si`, `pub-${status}`, status);
    expect((await get(`/b/pub-${status}`)).status).toBe(404);
  });

  it("404s when the builder's account is suspended", async () => {
    const b = await makeBuilder("pub-locked@vnx.si", "pub-locked", "approved");
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(b.userId).run();
    expect((await get("/b/pub-locked")).status).toBe(404);
  });

  it("redirects upper-case handles and 404s on unknown or malformed ones", async () => {
    await makeBuilder("pub-case@vnx.si", "pub-case", "approved");
    const res = await get("/vi/b/Pub-Case");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/vi/b/pub-case");
    expect((await get("/b/nobody-here")).status).toBe(404);
    expect((await get("/b/a")).status).toBe(404);
  });
});
