import type { FC } from "hono/jsx";
import type { Locale } from "../i18n/locales.ts";
import type { MessageKey } from "../i18n/messages/en.ts";
import { translator } from "../i18n/t.ts";
import { LEGAL, LEGAL_UPDATED_AT, type Block, type LegalPageId } from "../legal/content.ts";
import { Layout } from "./Layout.tsx";

export type InlineToken = { kind: "text" | "code" | "strong" | "email"; text: string };

const CONTACT = "contact@vnx.si";
// Only three marks exist (plan VNX-0705a): `code`, **bold** and the contact address. Everything else stays text.
const MARKS = /`([^`]+)`|\*\*([^*]+)\*\*|(?<![\w.@+-])contact@vnx\.si(?![\w@-]|\.\w)/g;
const HEX = /^#[0-9A-Fa-f]{6}$/;

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const m of text.matchAll(MARKS)) {
    const at = m.index ?? 0;
    if (at > last) tokens.push({ kind: "text", text: text.slice(last, at) });
    if (m[1] !== undefined) tokens.push({ kind: "code", text: m[1] });
    else if (m[2] !== undefined) tokens.push({ kind: "strong", text: m[2] });
    else tokens.push({ kind: "email", text: CONTACT });
    last = at + m[0].length;
  }
  if (last < text.length) tokens.push({ kind: "text", text: text.slice(last) });
  return tokens;
}

/** Renders one line of legal text. JSX escapes every token, so the content can never inject markup. */
export const InlineText: FC<{ text: string }> = ({ text }) => (
  <>
    {parseInline(text).map((tok) => {
      if (tok.kind === "strong") return <strong>{tok.text}</strong>;
      if (tok.kind === "email") return <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;
      if (tok.kind === "code") {
        // Media kit brand colours: a swatch beside the code. HEX guarantees the style value is a plain colour.
        if (HEX.test(tok.text)) {
          return (
            <>
              <span class="swatch" style={`background-color:${tok.text}`} aria-hidden="true"></span>
              <code>{tok.text}</code>
            </>
          );
        }
        return <code>{tok.text}</code>;
      }
      return tok.text;
    })}
  </>
);

const BlockView: FC<{ block: Block }> = ({ block }) =>
  "p" in block ? (
    <p>
      <InlineText text={block.p} />
    </p>
  ) : (
    <ul>
      {block.ul.map((item) => (
        <li>
          <InlineText text={item} />
        </li>
      ))}
    </ul>
  );

const META: Record<LegalPageId, { title: MessageKey; description: MessageKey }> = {
  terms: { title: "legal.terms.title", description: "legal.terms.description" },
  privacy: { title: "legal.privacy.title", description: "legal.privacy.description" },
  mediaKit: { title: "legal.mediaKit.title", description: "legal.mediaKit.description" },
};

type Props = { locale: Locale; origin: string; signedIn: boolean; id: LegalPageId };

export const LegalPage: FC<Props> = ({ locale, origin, signedIn, id }) => {
  const tr = translator(locale);
  const page = LEGAL[id];
  // EN and VI have their own text; zh-Hans and zh-Hant show the EN text until VNX-0801 translates it.
  const englishOnly = locale === "zh-Hans" || locale === "zh-Hant";
  const doc = locale === "vi" ? page.vi : page.en;
  return (
    <Layout
      locale={locale}
      title={`${tr(META[id].title)} · VNX.SI`}
      description={tr(META[id].description)}
      origin={origin}
      rest={page.rest}
      signedIn={signedIn}
    >
      <article class="legal">
        {englishOnly ? <p class="notice">{tr("legal.englishOnly")}</p> : null}
        <div lang={englishOnly ? "en" : undefined}>
          <h1>{doc.title}</h1>
          {page.dated ? (
            <p class="legal-updated" lang={englishOnly ? locale : undefined}>
              {tr("legal.updated", { date: LEGAL_UPDATED_AT })}
            </p>
          ) : null}
          {doc.sections.map((section) => (
            <>
              <h2>{section.heading}</h2>
              {section.blocks.map((block) => (
                <BlockView block={block} />
              ))}
            </>
          ))}
        </div>
      </article>
    </Layout>
  );
};
