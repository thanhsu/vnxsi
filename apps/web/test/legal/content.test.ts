import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { Bindings } from "../../src/env.ts";
import { BOARD_LEGAL, LEGAL, LEGAL_UPDATED_AT, PRIVACY_M7, type LegalDoc } from "../../src/legal/content.ts";
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
function expectedLines(part: string, date: string = LEGAL_UPDATED_AT): string[] {
  return part
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => line.replace(/^### /, "").replace(/^- /, "").replace("{date}", date))
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

const get = (path: string, env: Bindings = testEnv) => createApp().request(new Request(`https://vnx.si${path}`), undefined, env);

// privacy-m7.md is what /privacy shows once the notice window has opened (go-live minus 14 days = 2026-10-06; the real clock is past it).
const M7_GO_LIVE = "2026-10-20"; // pinned, same as privacy-version.test.ts; the real clock is already past 2026-10-06, so the M7 text shows
const M7_ENV = { ...testEnv, PRIVACY_NOTICE_GO_LIVE: M7_GO_LIVE } as Bindings;

// The board versions (EPIC 27) show from REQUEST_BOARD_GO_LIVE - 14 days; 2026-10-21 - 14 days is 2026-10-07, already past on the real clock.
const BOARD_GO_LIVE = "2026-10-21";
const BOARD_ENV = { ...testEnv, PRIVACY_NOTICE_GO_LIVE: M7_GO_LIVE, REQUEST_BOARD_GO_LIVE: BOARD_GO_LIVE } as Bindings;

const CASES = [
  { name: "terms", path: "/terms", min: 11, env: testEnv, date: LEGAL_UPDATED_AT },
  { name: "privacy", path: "/privacy", min: 11, env: testEnv, date: LEGAL_UPDATED_AT },
  { name: "privacy-m7", path: "/privacy", min: 11, env: M7_ENV, date: M7_GO_LIVE },
  { name: "privacy-board", path: "/privacy", min: 11, env: BOARD_ENV, date: BOARD_GO_LIVE },
  { name: "terms-board", path: "/terms", min: 11, env: BOARD_ENV, date: BOARD_GO_LIVE },
  { name: "media-kit", path: "/media-kit", min: 11, env: testEnv, date: LEGAL_UPDATED_AT },
  { name: "disclosure", path: "/disclosure", min: 10, env: testEnv, date: LEGAL_UPDATED_AT },
] as const;

describe("legal pages match docs/legal/*.md word for word (VNX-0705a AC2)", () => {
  it("reads the four approved source files", () => {
    for (const { name } of CASES) expect(sourceOf(name)).toContain("## EN");
  });

  for (const { name, path, min, env, date } of CASES) {
    for (const [lang, prefix] of [
      ["EN", ""],
      ["VI", "/vi"],
    ] as const) {
      it(`${name} ${lang}: every heading, paragraph and list item appears in order`, async () => {
        const lines = expectedLines(partOf(sourceOf(name), lang), date);
        expect(lines.length, name).toBeGreaterThanOrEqual(min);
        const res = await get(prefix + path, env);
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
        for (const env of [testEnv, M7_ENV, BOARD_ENV]) {
          const text = textOf(mainOf(await (await get(prefix + path, env)).text()));
          expect(text, prefix + path).not.toContain("Ghi chú cho Owner");
          expect(text, prefix + path).not.toContain("bản nháp");
          expect(text, prefix + path).not.toContain("{date}");
          expect(text, prefix + path).not.toContain("**");
          expect(text, prefix + path).not.toContain("`");
        }
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

// ---- EPIC 27 (VNX-2707b): the board constants against the board files, the old texts free of board wording, and the supersets. ----
const BOARD_WORDING = /public request board|bảng nhu cầu công khai|Public requests|Nhu cầu công khai|Interest in public requests|Quan tâm tới nhu cầu công khai/;

type DocBlock = LegalDoc["sections"][number]["blocks"][number];
/** Every title, heading, paragraph and list item of a constant, as plain text, in order. */
const linesOfDoc = (doc: LegalDoc): string[] =>
  [doc.title, ...doc.sections.flatMap((s) => [s.heading, ...s.blocks.flatMap((b: DocBlock) => ("p" in b ? [b.p] : b.ul))])].map(plain);
const fileLines = (name: string, lang: "EN" | "VI") => expectedLines(partOf(sourceOf(name), lang), "{date}").filter((l) => !/^(Last updated|Cập nhật lần cuối): \{date\}$/.test(l));

describe("the board constants mirror docs/legal/*-board.md line by line (VNX-2707b)", () => {
  const CONSTANTS: [string, "EN" | "VI", LegalDoc | undefined][] = [
    ["privacy-board", "EN", BOARD_LEGAL.privacy?.en],
    ["privacy-board", "VI", BOARD_LEGAL.privacy?.vi],
    ["terms-board", "EN", BOARD_LEGAL.terms?.en],
    ["terms-board", "VI", BOARD_LEGAL.terms?.vi],
  ];
  for (const [name, lang, doc] of CONSTANTS) {
    it(`${name} ${lang}`, () => {
      expect(doc, "registered in BOARD_LEGAL").toBeDefined();
      expect(linesOfDoc(doc!)).toEqual(fileLines(name, lang));
    });
  }

  it("the board files carry only the EN and VI texts, not the Owner notes or the ADR-012 appendix", () => {
    for (const name of ["privacy-board", "terms-board"]) {
      const md = sourceOf(name);
      expect(md).not.toContain("## Ghi chú cho Owner");
      expect(md).not.toContain("## Bổ sung ADR-012");
      expect(md).not.toContain("Đối chiếu code ADR-012");
      expect(md.match(/^## /gm)).toHaveLength(2);
    }
  });
});

describe("no earlier text carries board wording (the board versions are the only ones that may)", () => {
  it("privacy.md, privacy-m7.md and terms.md", () => {
    for (const name of ["privacy", "privacy-m7", "terms"]) expect(sourceOf(name), name).not.toMatch(BOARD_WORDING);
  });

  it("the four earlier constants and PRIVACY_M7", () => {
    for (const doc of [LEGAL.privacy.en, LEGAL.privacy.vi, LEGAL.terms.en, LEGAL.terms.vi, PRIVACY_M7.en, PRIVACY_M7.vi]) {
      expect(JSON.stringify(doc)).not.toMatch(BOARD_WORDING);
    }
  });
});

describe("the board constants are supersets of the versions they follow, OAuth wording included", () => {
  const lineSet = (docs: LegalDoc) => new Set(linesOfDoc(docs));
  it("Privacy board contains every line of the M7 constants, except the two bullets the addendum replaces", () => {
    for (const lang of ["en", "vi"] as const) {
      const board = lineSet(BOARD_LEGAL.privacy![lang]);
      const missing = linesOfDoc(PRIVACY_M7[lang]).filter((l) => !board.has(l));
      expect(missing.length, `${lang}: ${missing.map((l) => l.slice(0, 60)).join(" | ")}`).toBe(2);
      expect(missing[0]).toMatch(lang === "en" ? /^Requests: when you post a request/ : /^Nhu cầu \(request\): khi bạn đăng nhu cầu/);
      expect(missing[1]).toMatch(lang === "en" ? /^Builders do not see clients' email addresses/ : /^Builder không thấy email của client/);
    }
  });

  it("Terms board contains every line of the current Terms constants (nothing is replaced)", () => {
    for (const lang of ["en", "vi"] as const) {
      const board = lineSet(BOARD_LEGAL.terms![lang]);
      expect(linesOfDoc(LEGAL.terms[lang]).filter((l) => !board.has(l))).toEqual([]);
    }
  });

  const IDENT = {
    privacy: {
      en: ["link a Google, GitHub or LinkedIn account", "__Host-vnx_oauth", "Linked accounts:"],
      vi: ["liên kết tài khoản Google, GitHub hoặc LinkedIn", "__Host-vnx_oauth", "Tài khoản liên kết:"],
    },
    terms: { en: ["link a Google, GitHub or LinkedIn account"], vi: ["liên kết tài khoản Google, GitHub hoặc LinkedIn"] },
  } as const;
  it("every board constant carries the OAuth identifying strings", () => {
    for (const lang of ["en", "vi"] as const) {
      for (const needle of IDENT.privacy[lang]) expect(JSON.stringify(BOARD_LEGAL.privacy![lang]), `privacy ${lang}`).toContain(needle);
      for (const needle of IDENT.terms[lang]) expect(JSON.stringify(BOARD_LEGAL.terms![lang]), `terms ${lang}`).toContain(needle);
    }
  });

  it("the __Host-vnx_oauth cookie bullet stays between __Host-vnx_invite and __Host-vnx_vid, in the M7 text and in the board text", () => {
    for (const doc of [PRIVACY_M7.en, PRIVACY_M7.vi, BOARD_LEGAL.privacy!.en, BOARD_LEGAL.privacy!.vi]) {
      const cookies = linesOfDoc(doc).filter((l) => l.startsWith("__Host-vnx_"));
      expect(cookies.map((l) => l.split(":")[0])).toEqual(["__Host-vnx_session", "__Host-vnx_invite", "__Host-vnx_oauth", "__Host-vnx_vid"]);
    }
  });
});

describe("each approved board sentence appears exactly once in its board version (addendum 12.2, 12.3, 12.6)", () => {
  const ONCE = {
    privacy: {
      en: [
        "Public requests: if you choose to show a request on our public request board, we record when you chose it and which version of this policy you saw.",
        "Interest in public requests: if you are a builder and tell us you are interested in a public request, we record that, when, and the note or product you add.",
        "To show the requests their authors chose to make public, so that builders can find them and tell us they are interested. Our team still decides which builders to invite.",
        "For public requests we rely on your consent. You can withdraw it at any time from your account page; the request then leaves the public board straight away, and it does not change what happened before.",
        "If you chose to make a request public, anyone, including search engines, can see the version we published",
        "When a builder tells us they are interested in a public request, only our team sees it. The client does not see it unless we invite that builder.",
        "Search engines and other sites may keep copies of a public page for some time after we close or remove it.",
        "Public requests: shown while the request is open and for 30 days after it closes, unless you or we remove it earlier.",
      ],
      vi: [
        "Nhu cầu công khai: nếu bạn chọn hiện một nhu cầu trên bảng nhu cầu công khai, chúng tôi ghi lại thời điểm bạn chọn",
        "Quan tâm tới nhu cầu công khai: nếu bạn là builder và báo với chúng tôi rằng bạn quan tâm tới một nhu cầu công khai",
        "Hiển thị các nhu cầu mà người đăng đã chọn công khai, để builder tìm thấy",
        "Với nhu cầu công khai, căn cứ của chúng tôi là sự đồng ý của bạn.",
        "Nếu bạn chọn công khai một nhu cầu, bất kỳ ai, kể cả công cụ tìm kiếm, đều thấy được bản chúng tôi đã công khai",
        "Khi một builder báo với chúng tôi rằng họ quan tâm tới một nhu cầu công khai, chỉ đội ngũ của chúng tôi thấy điều đó. Client không thấy, trừ khi chúng tôi mời builder đó.",
        "Công cụ tìm kiếm và các trang khác có thể giữ bản sao của một trang công khai",
        "Nhu cầu công khai: hiển thị khi nhu cầu còn mở và trong 30 ngày sau khi đóng",
      ],
    },
    terms: {
      en: [
        "Public requests. You can choose to show a request on our public request board.",
        "If you tell us you are interested in a public request, what you write must be true. Use the request board only to find work through VNX.SI.",
        "Try to identify the author of a public request, contact them outside VNX.SI, or copy public requests to other sites.",
      ],
      vi: [
        "Nhu cầu công khai. Bạn có thể chọn hiện một nhu cầu trên bảng nhu cầu công khai.",
        "Nếu bạn báo với chúng tôi rằng bạn quan tâm tới một nhu cầu công khai, những gì bạn viết phải đúng sự thật.",
        "Tìm cách nhận ra người đăng một nhu cầu công khai, liên hệ họ bên ngoài VNX.SI, hoặc chép nhu cầu công khai sang trang khác.",
      ],
    },
  } as const;
  for (const kind of ["privacy", "terms"] as const) {
    for (const lang of ["en", "vi"] as const) {
      it(`${kind} ${lang}`, () => {
        const lines = linesOfDoc(BOARD_LEGAL[kind]![lang]);
        for (const sentence of ONCE[kind][lang]) expect(lines.filter((l) => l.includes(plain(sentence))), sentence).toHaveLength(1);
      });
    }
  }

  it("no unfilled placeholder is left in the board texts ({N} is 30 in the addendum, {date} is filled at render)", () => {
    expect(JSON.stringify([BOARD_LEGAL.privacy, BOARD_LEGAL.terms])).not.toMatch(/\{N\}|\{date\}/);
  });
});
