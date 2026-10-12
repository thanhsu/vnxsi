import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { optInStatement, returnedPublication } from "../../src/db/request-board.ts";
import { notifyPublicationPublished, notifyPublicationRejected, notifyPublicationUnpublished } from "../../src/notify/request-board.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { makeRequest } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

/** VNX-2704b: the client's e-mails after Ops publishes, rejects or unpublishes a listing (addendum §9.2). */

const failingEnv = { ...testEnv, MAIL_DRIVER: undefined, RESEND_API_KEY: undefined } as Bindings;

async function listing(tag: string, state: "pending_review" | "published" | "rejected" | "unpublished" | "withdrawn", opts: { locale?: string; note?: string | null; adminNote?: string } = {}) {
  const made = await makeRequest({ tag, clientLocale: opts.locale ?? "en", title: `Booking app ${tag}` });
  const [res] = await testEnv.DB.batch([optInStatement(testEnv.DB, { writeId: ulid(), requestId: made.request.id, consentVersion: "2026-01-01", now: new Date().toISOString(), clientUserId: made.client.id })]);
  const publication = returnedPublication(res)!;
  await testEnv.DB.prepare("UPDATE request_publications SET status = ?2, review_note = ?3, published_at = '2026-01-01T00:00:00.000Z', public_title = 'Public wording', public_description = 'Public description that is long enough to pass the forty character check.' WHERE request_id = ?1").bind(made.request.id, state, opts.note ?? null).run();
  if (opts.adminNote) await testEnv.DB.prepare("UPDATE requests SET admin_note = ?2 WHERE id = ?1").bind(made.request.id, opts.adminNote).run();
  return { ...made, publicId: publication.publicId };
}

describe("request board notifications", () => {
  beforeEach(() => clearOutbox());

  it("tells the client in their locale that the listing is published, with the public page and their own page, and nothing private", async () => {
    const { client, request, publicId } = await listing("nb-pub", "published", { locale: "vi", adminNote: "ADMIN-ONLY-NOTE" });
    expect(await notifyPublicationPublished(testEnv, request.id, { edited: false })).toBe("sent");
    expect(outbox).toHaveLength(1);
    const mail = outbox[0]!;
    expect(mail.to).toBe(client.email);
    expect(mail.text).toContain("bảng nhu cầu công khai");
    expect(mail.text).toContain(`https://vnx.si/vi/requests/${publicId}`);
    expect(mail.text).toContain(`https://vnx.si/vi/me/requests/${request.id}`);
    expect(mail.text + mail.html + mail.subject).not.toContain("ADMIN-ONLY-NOTE");
    expect(mail.text).not.toContain("Public description that");
    // The public link never carries the request's id.
    expect(`https://vnx.si/vi/requests/${publicId}`).not.toContain(request.id);
  });

  it("mentions the edit only when asked to", async () => {
    const a = await listing("nb-ed1", "published");
    await notifyPublicationPublished(testEnv, a.request.id, { edited: true });
    const b = await listing("nb-ed2", "published");
    await notifyPublicationPublished(testEnv, b.request.id, { edited: false });
    expect(outbox[0]!.text).toContain("edited the wording");
    expect(outbox[1]!.text).not.toContain("edited");
  });

  it("sends the Ops reason on reject and on unpublish, in the client's locale", async () => {
    const r = await listing("nb-rej", "rejected", { note: "Contains a company name.", locale: "zh-Hans" });
    expect(await notifyPublicationRejected(testEnv, r.request.id)).toBe("sent");
    expect(outbox[0]).toMatchObject({ to: r.client.email });
    expect(outbox[0]!.text).toContain("Contains a company name.");
    expect(outbox[0]!.text).toContain("公开需求板");
    expect(outbox[0]!.text).toContain(`https://vnx.si/zh-hans/me/requests/${r.request.id}`);
    const u = await listing("nb-unp", "unpublished", { note: "No longer fits the board." });
    expect(await notifyPublicationUnpublished(testEnv, u.request.id)).toBe("sent");
    expect(outbox[1]!.text).toContain("No longer fits the board.");
  });

  it("skips when the listing is not in the state the e-mail is about, when it has no reason, or when the request is gone", async () => {
    const withdrawn = await listing("nb-wd", "withdrawn");
    expect(await notifyPublicationPublished(testEnv, withdrawn.request.id, { edited: false })).toBe("skipped");
    const pending = await listing("nb-pend", "pending_review");
    expect(await notifyPublicationRejected(testEnv, pending.request.id)).toBe("skipped");
    expect(await notifyPublicationUnpublished(testEnv, pending.request.id)).toBe("skipped");
    const noNote = await listing("nb-nonote", "rejected", { note: null });
    expect(await notifyPublicationRejected(testEnv, noNote.request.id)).toBe("skipped");
    const removed = await listing("nb-rm", "published");
    await testEnv.DB.prepare("UPDATE requests SET status = 'removed' WHERE id = ?1").bind(removed.request.id).run();
    expect(await notifyPublicationPublished(testEnv, removed.request.id, { edited: false })).toBe("skipped");
    expect(await notifyPublicationPublished(testEnv, "01NOTAREALREQUEST0000000", { edited: false })).toBe("skipped");
    expect(outbox).toHaveLength(0);
  });

  it("never throws when the mailer fails: it logs one JSON line without the address and returns failed", async () => {
    const { client, request } = await listing("nb-fail", "published");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await notifyPublicationPublished(failingEnv, request.id, { edited: false })).toBe("failed");
      expect(log).toHaveBeenCalledOnce();
      const line = String(log.mock.calls[0]![0]);
      expect(JSON.parse(line)).toMatchObject({ event: "request_board.notify_failed", kind: "published", id: request.id });
      expect(line).not.toContain(client.email);
    } finally {
      log.mockRestore();
    }
  });
});
