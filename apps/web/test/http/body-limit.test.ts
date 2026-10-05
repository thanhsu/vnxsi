import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { MAX_FORM_BYTES, MAX_UPLOAD_BYTES, maxBodyBytes } from "../../src/http/body-limit.ts";
import { makeDraft, signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const ID = "01HZZZZZZZZZZZZZZZZZZZZZZZ";
const post = (path: string, body: BodyInit, headers: Record<string, string> = {}, extra: RequestInit = {}) =>
  createApp().request(
    new Request(`https://vnx.si${path}`, {
      method: "POST",
      headers: { origin: "https://vnx.si", "content-type": "application/x-www-form-urlencoded", ...headers },
      body,
      ...extra,
    }),
    undefined,
    testEnv,
  );

describe("request body limit (VNX-0803 F4)", () => {
  it("picks the upload ceiling only for the image upload path, in every locale", () => {
    expect(maxBodyBytes("/contact")).toBe(MAX_FORM_BYTES);
    expect(maxBodyBytes(`/hub/products/${ID}/media`)).toBe(MAX_UPLOAD_BYTES);
    expect(maxBodyBytes(`/vi/hub/products/${ID}/media`)).toBe(MAX_UPLOAD_BYTES);
    expect(maxBodyBytes(`/hub/products/${ID}/media/${ID}/delete`)).toBe(MAX_FORM_BYTES);
    expect(MAX_UPLOAD_BYTES).toBe(8 * 1024 * 1024);
  });

  it("answers 413 to a form POST above 64 KB, by Content-Length and when streamed without one", async () => {
    const big = `message=${"a".repeat(MAX_FORM_BYTES + 1)}`;
    const declared = await post("/contact", big);
    expect(declared.status).toBe(413);
    expect(await declared.text()).toBe("Payload Too Large");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(big));
        controller.close();
      },
    });
    const streamed = await post("/contact", stream, {}, { duplex: "half" } as RequestInit);
    expect(streamed.status).toBe(413);
  });

  it("lets a normal form through and leaves GET alone", async () => {
    expect((await post("/contact", "message=hi")).status).not.toBe(413);
    const get = await createApp().request(new Request("https://vnx.si/contact", { headers: { "content-length": String(MAX_FORM_BYTES * 10) } }), undefined, testEnv);
    expect(get.status).toBe(200);
  });

  it("leaves a declared upload to the route, which answers its own localized page even far above 8 MB", async () => {
    const { product } = await makeDraft("bl-huge@vnx.si", "bl-huge", "Huge Kit");
    const { cookie } = await signIn("bl-huge@vnx.si");
    const res = await post(`/hub/products/${product.id}/media`, new Uint8Array(8), { cookie, "content-type": "multipart/form-data; boundary=x", "content-length": String(9 * 1024 * 1024) });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("larger than 2 MB");
  });

  it("caps an upload whose length is not declared at 8 MB", async () => {
    const path = `/hub/products/${ID}/media`;
    const multipart = { "content-type": "multipart/form-data; boundary=x" };
    const streamOf = (bytes: number) =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          const chunk = 1024 * 1024;
          for (let sent = 0; sent < bytes; sent += chunk) controller.enqueue(new Uint8Array(Math.min(chunk, bytes - sent)));
          controller.close();
        },
      });
    // Signed out: the route redirects to /login; what matters is that the 8 MB ceiling did not fire.
    expect((await post(path, streamOf(MAX_FORM_BYTES * 2), multipart, { duplex: "half" } as RequestInit)).status).not.toBe(413);
    expect((await post(path, streamOf(MAX_UPLOAD_BYTES + 1), multipart, { duplex: "half" } as RequestInit)).status).toBe(413);
  });
});
