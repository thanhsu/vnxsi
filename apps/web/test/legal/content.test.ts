import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { LEGAL_UPDATED_AT } from "../../src/legal/content.ts";
import { testEnv } from "../helpers.ts";

// The approved source text (VNX-0705a). Read from the files themselves, never from a copy.
const SOURCES = import.meta.glob("../../../../docs/legal/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const sourceOf = (name: string): string => {
  const entry = Object.entries(SOURCES).find(([file]) => file.endsWith(`/docs/legal/${name}.md`));
  if (!entry) throw new Error(`docs/legal/${name}.md not found`);
  return entry[1].replace(/\r\n/g, "\n");
};

/** The `## EN` or `## VI` part of a source file, up to the next `---`. */
function partOf(md: string, lang: "EN" | "VI"): string {
  const start = md.indexOf(`\n## ${lang}\n`);
  if (start < 0) throw new Error(`missing ## ${lang}`);
  const body = md.slice(start + `\n## ${lang}\n`.length);
  const end = body.indexOf("\n---");
  return end < 0 ? body : body.slice(0, end);
}

const plain = (s: string) => s.replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim();

/** Every title, heading, paragraph and list item of a part, in source order, as plain text. */
function expectedLines(part: string): string[] {
  return part
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => line.replace(/^### /, "").replace(/^- /, "").replace("{date}", LEGAL_UPDATED_AT))
    .map(plain);
}

const decode = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
/** Inline tags vanish without a gap; block tags become a space. */
const textOf = (html: string) =>
  decode(html.replace(/<\/?(?:strong|code|a|span)\b[^>]*>/g, "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const get = (path: string) => createApp().request(new Request(`https://vnx.si${path}`), undefined, testEnv);

const CASES = [
  { name: "terms", path: "/terms" },
  { name: "privacy", path: "/privacy" },
  { name: "media-kit", path: "/media-kit" },
] as const;

describe("legal pages match docs/legal/*.md word for word (VNX-0705a AC2)", () => {
  it("reads the three approved source files", () => {
    for (const { name } of CASES) expect(sourceOf(name)).toContain("## EN");
  });

  for (const { name, path } of CASES) {
    for (const [lang, prefix] of [
      ["EN", ""],
      ["VI", "/vi"],
    ] as const) {
      it(`${name} ${lang}: every heading, paragraph and list item appears in order`, async () => {
        const lines = expectedLines(partOf(sourceOf(name), lang));
        expect(lines.length, name).toBeGreaterThan(10);
        const res = await get(prefix + path);
        expect(res.status).toBe(200);
        const text = textOf(mainOf(await res.text()));
        let from = 0;
        for (const line of lines) {
          const at = text.indexOf(line, from);
          expect(at, `${name} ${lang}: "${line}"`).toBeGreaterThanOrEqual(0);
          from = at + line.length;
        }
      });
    }
  }

  it("leaves out the notes for the Owner and the draft header", async () => {
    for (const { path } of CASES) {
      for (const prefix of ["", "/vi"]) {
        const text = textOf(mainOf(await (await get(prefix + path)).text()));
        expect(text, prefix + path).not.toContain("Ghi chú cho Owner");
        expect(text, prefix + path).not.toContain("bản nháp");
        expect(text, prefix + path).not.toContain("{date}");
        expect(text, prefix + path).not.toContain("**");
        expect(text, prefix + path).not.toContain("`");
      }
    }
  });
});

/** Plan VNX-0710 "Privacy": the exact sentences added for the contact form. */
const CONTACT_PRIVACY = {
  EN: [
    "- **Questions and feedback:** when you use our contact form, your email, the name you give (optional), whether you are a builder or a client, what your message is about, the message itself, the language of the page, and your account if you are signed in.",
    "- **Bot check:** when you send an inquiry, a request or a contact message without signing in, Cloudflare Turnstile checks that you are a person.",
    "- To read and answer the questions and feedback you send us.",
    "We rely on your consent (waitlist, contact form),",
    "- Messages sent through the contact form are read only by the VNX.SI team; a copy is delivered to our mailbox through Resend.",
    "- Questions and feedback: until we have answered and dealt with them, plus 12 months, or until you ask us to delete them.",
  ],
  VI: [
    "- **Câu hỏi và góp ý:** khi bạn dùng form liên hệ, email của bạn, tên bạn cung cấp (không bắt buộc), bạn là builder hay client, tin nhắn nói về điều gì, nội dung tin nhắn, ngôn ngữ của trang, và tài khoản của bạn nếu đã đăng nhập.",
    "khi bạn gửi yêu cầu, nhu cầu hoặc tin nhắn liên hệ mà chưa đăng nhập",
    "- Đọc và trả lời các câu hỏi, góp ý bạn gửi cho chúng tôi.",
    "(danh sách chờ, form liên hệ)",
    "- Tin nhắn gửi qua form liên hệ chỉ đội ngũ VNX.SI đọc; một bản được chuyển tới hộp thư của chúng tôi qua Resend.",
    "- Câu hỏi và góp ý: tới khi chúng tôi đã trả lời và xử lý xong, cộng 12 tháng, hoặc tới khi bạn yêu cầu xóa.",
  ],
} as const;

describe("privacy covers the contact form (VNX-0710 AC12)", () => {
  for (const [lang, prefix] of [
    ["EN", ""],
    ["VI", "/vi"],
  ] as const) {
    it(`${lang}: docs/legal/privacy.md has the approved sentences and /privacy shows them`, async () => {
      const part = partOf(sourceOf("privacy"), lang);
      const text = textOf(mainOf(await (await get(`${prefix}/privacy`)).text()));
      for (const sentence of CONTACT_PRIVACY[lang]) {
        expect(part, sentence).toContain(sentence);
        expect(text, sentence).toContain(plain(sentence.replace(/^- /, "")));
      }
      expect(part).not.toContain("when you send an inquiry without signing in");
      expect(part).not.toContain("khi bạn gửi yêu cầu mà chưa đăng nhập");
      // The new collection line follows the waitlist line.
      const waitlist = part.indexOf(lang === "EN" ? "- **Waitlist:**" : "- **Danh sách chờ:**");
      const contact = part.indexOf(CONTACT_PRIVACY[lang][0]);
      expect(waitlist).toBeGreaterThan(0);
      // VNX-2103: Outbound clicks now sits between Waitlist and Questions and feedback: the order is Waitlist, Outbound clicks, Questions and feedback.
      const outbound = part.indexOf(lang === "EN" ? "- **Outbound clicks:**" : "- **Lượt bấm link ra ngoài:**");
      expect(part.slice(waitlist, outbound).split("\n")).toHaveLength(2);
      expect(part.slice(outbound, contact).split("\n")).toHaveLength(2);
    });
  }
});

/** Plan VNX-2103 block C (Owner approved 2026-10-05): where each line starts; the whole line is compared with the source file. */
const OUTBOUND_PRIVACY = {
  EN: ["- **Outbound clicks:**", "- To count how often links to other companies are followed", "- When you follow a link to a partner you leave VNX.SI.", "- Outbound click records: deleted after 13 months."],
  VI: ["- **Lượt bấm link ra ngoài:**", "- Đếm số lần các link tới công ty khác được bấm", "- Khi bạn bấm link tới một partner, bạn rời VNX.SI.", "- Bản ghi lượt bấm link ra ngoài: xóa sau 13 tháng."],
} as const;
const lineStarting = (part: string, start: string) => part.split("\n").find((l) => l.startsWith(start)) ?? "";

describe("privacy covers outbound clicks (VNX-2103)", () => {
  for (const [lang, prefix] of [
    ["EN", ""],
    ["VI", "/vi"],
  ] as const) {
    it(`${lang}: docs/legal/privacy.md has the four approved lines and /privacy shows each one whole`, async () => {
      const part = partOf(sourceOf("privacy"), lang);
      const text = textOf(mainOf(await (await get(`${prefix}/privacy`)).text()));
      for (const start of OUTBOUND_PRIVACY[lang]) {
        const line = lineStarting(part, start);
        expect(line, start).not.toBe("");
        expect(text, start).toContain(plain(line.replace(/^- /, "")));
      }
      // The collection line follows the waitlist line, as block C says.
      const waitlist = part.indexOf(lang === "EN" ? "- **Waitlist:**" : "- **Danh sách chờ:**");
      expect(part.slice(waitlist).split("\n")[1]?.startsWith(OUTBOUND_PRIVACY[lang][0])).toBe(true);
    });
  }

  it("LEGAL_UPDATED_AT moved forward, and Terms and Privacy both show it (the constant is shared)", async () => {
    expect(LEGAL_UPDATED_AT >= "2026-10-05").toBe(true);
    for (const path of ["/terms", "/privacy"]) expect(textOf(mainOf(await (await get(path)).text()))).toContain(LEGAL_UPDATED_AT);
  });
});
