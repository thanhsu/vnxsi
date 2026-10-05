import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { MAX_MEDIA_BYTES } from "../domain/product.ts";
import type { AppEnv } from "../env.ts";
import { localeFromPath } from "../i18n/locales.ts";

/** Forms are small (the longest field is 4000 characters); 64 KB leaves room for multipart framing. */
export const MAX_FORM_BYTES = 64 * 1024;
/**
 * The image upload: routes/hub-media.tsx answers anything over 2 MB + 64 KB with its own friendly 400 page, so this
 * ceiling only stops bodies that are far too large (8 MB) from being buffered at all.
 */
export const MAX_UPLOAD_BYTES = 4 * MAX_MEDIA_BYTES;
const UPLOAD_PATH = /^\/hub\/products\/[^/]+\/media$/;

export function maxBodyBytes(path: string): number {
  return UPLOAD_PATH.test(localeFromPath(path).rest) ? MAX_UPLOAD_BYTES : MAX_FORM_BYTES;
}

/**
 * Review VNX-0803 F4: refuses an oversized body (by Content-Length, or while reading when it is missing) before any
 * route buffers it with parseBody(). GET and HEAD have no body and pass through.
 */
export const requestBodyLimit: MiddlewareHandler<AppEnv> = (c, next) =>
  bodyLimit({ maxSize: maxBodyBytes(c.req.path), onError: (cc) => cc.text("Payload Too Large", 413) })(c, next);
