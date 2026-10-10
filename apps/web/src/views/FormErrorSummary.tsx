import type { FC } from "hono/jsx";
import type { Translate } from "../i18n/t.ts";

/** One line of the summary. `href` is "#<id of the input>", or "" for an error that belongs to no field (captcha, rate limit, mail failure). */
export type FormErrorItem = { href: string; message: string };

/**
 * Error summary at the top of a server-rendered form that came back with errors (VNX-0807, WCAG 3.3.1, 3.3.3).
 * `autofocus` + tabindex="-1" moves focus to it on load without JavaScript, so a screen reader hears the heading and the whole list
 * (including form-level errors no field owns) before the person goes to fix a field. No role="alert": focus already announces it, and a second live region would read twice.
 * One summary per page (one autofocus). `lead` is an optional sentence under the heading.
 */
export const FormErrorSummary: FC<{ tr: Translate; items: readonly FormErrorItem[]; lead?: string }> = ({ tr, items, lead }) =>
  items.length === 0 ? null : (
    <section id="form-errors" class="error-summary" tabindex={-1} autofocus aria-labelledby="form-errors-title">
      <h2 id="form-errors-title">{tr("form.error.summaryTitle")}</h2>
      {lead ? <p>{lead}</p> : null}
      <ul>
        {items.map((item) => (
          <li>{item.href ? <a href={item.href}>{item.message}</a> : item.message}</li>
        ))}
      </ul>
    </section>
  );
