export const PERSONAS = ["developer", "tech-lead", "devops", "ai-builder", "other"] as const;
export const SPEND_BANDS = ["none", "lt20", "20-100", "100-500", "gt500"] as const; // USD / month
export const LANGS = ["en", "vi"] as const;

export type Persona = (typeof PERSONAS)[number];
export type SpendBand = (typeof SPEND_BANDS)[number];
export type Lang = (typeof LANGS)[number];

export interface WaitlistEntry {
  email: string;
  personas: Persona[];
  message: string | null;
  spendBand: SpendBand | null;
  lang: Lang;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

export type ParseResult =
  | { ok: true; entry: WaitlistEntry }
  | { ok: false; error: string; field?: string };

export const MESSAGES = {
  en: {
    invalid: "The submitted data is invalid.",
    email: "That email address doesn't look right.",
    consent: "Please agree so we can store your email.",
    human: "We couldn't verify you're human. Please try again.",
  },
  vi: {
    invalid: "Dữ liệu gửi lên không hợp lệ.",
    email: "Email chưa đúng định dạng.",
    consent: "Bạn cần đồng ý để chúng tôi lưu email.",
    human: "Không xác minh được bạn là người thật. Thử lại nhé.",
  },
} satisfies Record<Lang, Record<string, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_MESSAGE = 1000;
const MAX_META = 200;

function optionalString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function pickLang(value: unknown): Lang {
  return (LANGS as readonly unknown[]).includes(value) ? (value as Lang) : "en";
}

export function parseWaitlist(body: unknown): ParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: MESSAGES.en.invalid };
  }
  const input = body as Record<string, unknown>;
  const lang = pickLang(input.lang);
  const t = MESSAGES[lang];

  // Honeypot: real users never fill this hidden field.
  if (typeof input.website === "string" && input.website.trim() !== "") {
    return { ok: false, error: "spam", field: "website" };
  }

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: t.email, field: "email" };
  }

  if (input.consent !== true) {
    return { ok: false, error: t.consent, field: "consent" };
  }

  const rawPersonas = Array.isArray(input.personas) ? input.personas : [];
  // Optional: the landing form only sends "developer" when that box is ticked.
  const personas = [...new Set(rawPersonas)].filter((p): p is Persona =>
    (PERSONAS as readonly unknown[]).includes(p),
  );

  const spendBand = (SPEND_BANDS as readonly unknown[]).includes(input.spendBand)
    ? (input.spendBand as SpendBand)
    : null;

  return {
    ok: true,
    entry: {
      email,
      personas,
      message: optionalString(input.message, MAX_MESSAGE),
      spendBand,
      lang,
      referrer: optionalString(input.referrer, MAX_META),
      utmSource: optionalString(input.utmSource, MAX_META),
      utmMedium: optionalString(input.utmMedium, MAX_META),
      utmCampaign: optionalString(input.utmCampaign, MAX_META),
    },
  };
}
