import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { link, p, quote, wrap } from "../parts.ts";

type Email = { subject: string; text: string; html: string };

/**
 * The client's three e-mails about the public request board (EPIC 27 VNX-2704b; addendum §9.2, Q19), in the client's locale. Same shape
 * as templates/request.ts. They carry the client's own request title, the Ops reason where there is one, and links to the client's own
 * pages only: nothing of another client, no admin note.
 */

/** Ops published the listing. `edited`: the public wording differs from the client's own (said plainly, with a way to remove it). */
export function requestBoardPublishedEmail(locale: Locale, input: { title: string; edited: boolean; publicUrl: string; manageUrl: string }): Email {
  const tr = translator(locale);
  const intro = tr("email.boardPublished.intro", { title: input.title });
  const edited = input.edited ? tr("email.boardPublished.edited") : null;
  const view = tr("email.boardPublished.view");
  const manage = tr("email.boardPublished.manage");
  const lines = [intro, ...(edited ? [edited] : [])];
  return {
    subject: tr("email.boardPublished.subject", { title: input.title }),
    text: `${lines.join("\n\n")}\n\n${view}\n${input.publicUrl}\n\n${manage}\n${input.manageUrl}`,
    html: wrap(locale, [...lines.map(p), p(view), link(input.publicUrl), p(manage), link(input.manageUrl)]),
  };
}

function ended(locale: Locale, kind: "boardRejected" | "boardUnpublished", input: { title: string; reason: string; url: string }): Email {
  const tr = translator(locale);
  const intro = tr(`email.${kind}.intro`, { title: input.title });
  const label = tr("email.board.reason");
  const note = tr("email.board.finalNote");
  const cta = tr("email.board.cta");
  return {
    subject: tr(`email.${kind}.subject`, { title: input.title }),
    text: `${intro}\n\n${label}\n${input.reason}\n\n${note}\n\n${cta}\n${input.url}`,
    html: wrap(locale, [p(intro), p(label), quote(input.reason), p(note), p(cta), link(input.url)]),
  };
}

/** Ops decided not to show the listing (final). */
export const requestBoardRejectedEmail = (locale: Locale, input: { title: string; reason: string; url: string }): Email => ended(locale, "boardRejected", input);

/** Ops took a published listing off the board (final). */
export const requestBoardUnpublishedEmail = (locale: Locale, input: { title: string; reason: string; url: string }): Email => ended(locale, "boardUnpublished", input);
