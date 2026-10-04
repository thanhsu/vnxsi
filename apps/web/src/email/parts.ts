import { escapeHtml } from "./escape.ts";

export const p = (text: string) => `<p>${escapeHtml(text)}</p>`;
export const link = (href: string) => `<p><a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>`;
export const quote = (text: string) => `<blockquote style="white-space:pre-line;border-left:3px solid #DCE0E6;margin:0;padding-left:12px">${escapeHtml(text)}</blockquote>`;
export const wrap = (locale: string, parts: string[]) =>
  `<!doctype html><html lang="${locale}"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0D1526">${parts.join("")}</body></html>`;
