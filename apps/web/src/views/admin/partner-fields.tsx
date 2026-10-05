import type { FC, PropsWithChildren } from "hono/jsx";
import type { MessageKey } from "../../i18n/messages/en.ts";

/** One label for every status of a merchant, program or offer. */
export const STATUS_KEY: Record<"draft" | "active" | "paused" | "ended" | "archived", MessageKey> = {
  draft: "partner.status.draft",
  active: "partner.status.active",
  paused: "partner.status.paused",
  ended: "partner.status.ended",
  archived: "partner.status.archived",
};

type FieldProps = { id: string; label: string; error?: string | null; hint?: string };

/** Label, control (children), hint and error; the error id is `<id>-error` (the tests and aria-describedby use it). */
export const Field: FC<PropsWithChildren<FieldProps>> = (p) => (
  <div class="field">
    <label for={p.id}>{p.label}</label>
    {p.children}
    {p.hint ? (
      <p class="muted" id={`${p.id}-hint`}>
        {p.hint}
      </p>
    ) : null}
    {p.error ? (
      <p id={`${p.id}-error`} class="error-msg">
        {p.error}
      </p>
    ) : null}
  </div>
);

export const aria = (id: string, error: unknown) => ({ "aria-invalid": error ? "true" : undefined, "aria-describedby": error ? `${id}-error` : undefined });
