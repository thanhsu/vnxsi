import type { FeedbackKind, FeedbackRole } from "../../domain/feedback.ts";
import { escapeHtml } from "../escape.ts";

type Email = { subject: string; text: string; html: string };

/**
 * Internal notice to contact@vnx.si for one contact-form message (plan VNX-0710). English only: only the team reads
 * it. Everything the sender typed is escaped in the HTML part; the message keeps its line breaks.
 */
export function feedbackNoticeEmail(input: {
  role: FeedbackRole;
  kind: FeedbackKind;
  name: string | null;
  email: string;
  locale: string;
  message: string;
  adminUrl: string;
}): Email {
  const facts: [string, string][] = [
    ["Role", input.role],
    ["About", input.kind],
    ["Name", input.name ?? "(not given)"],
    ["Email", input.email],
    ["Page language", input.locale],
  ];
  const intro = "New message from the contact form. Reply to this e-mail to answer the sender.";
  const text = [intro, "", ...facts.map(([k, v]) => `${k}: ${v}`), "", input.message, "", `Open in admin: ${input.adminUrl}`].join("\n");
  const html =
    `<!doctype html><html lang="en"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0D1526">` +
    `<p>${escapeHtml(intro)}</p>` +
    `<table>${facts.map(([k, v]) => `<tr><th style="text-align:left;padding-right:12px">${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join("")}</table>` +
    `<blockquote style="white-space:pre-line;border-left:3px solid #DCE0E6;margin:16px 0;padding-left:12px">${escapeHtml(input.message)}</blockquote>` +
    `<p><a href="${escapeHtml(input.adminUrl)}">${escapeHtml(input.adminUrl)}</a></p>` +
    `</body></html>`;
  return { subject: `[VNX.SI contact] ${input.kind} from ${input.role}`, text, html };
}
