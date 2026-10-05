import type { Context, MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { MAX_MEDIA_BYTES } from "../domain/product.ts";
import type { AppEnv } from "../env.ts";
import { localeFromPath } from "../i18n/locales.ts";

/** Forms are small (the longest field, the product description, is 5000 characters); 64 KB leaves room for multipart framing. */
export const MAX_FORM_BYTES = 64 * 1024;
/** Ceiling for an image upload whose length is not declared (a chunked body); a declared length is checked by the route itself. */
export const MAX_UPLOAD_BYTES = 4 * MAX_MEDIA_BYTES;
const UPLOAD_PATH = /^\/hub\/products\/[^/]+\/media$/;

export function isUploadPath(path: string): boolean {
  return UPLOAD_PATH.test(localeFromPath(path).rest);
}

export function maxBodyBytes(path: string): number {
  return isUploadPath(path) ? MAX_UPLOAD_BYTES : MAX_FORM_BYTES;
}

/** A body whose size the request declares up front: Content-Length present and not chunked. */
const declaresLength = (c: Context<AppEnv>) => c.req.header("content-length") !== undefined && c.req.header("transfer-encoding") === undefined;

/**
 * Review VNX-0803 F4: refuses an oversized body (by Content-Length, or while reading when it is missing) before any
 * route buffers it with parseBody(). GET and HEAD have no body and pass through. The image upload with a declared
 * length is left to its route, which refuses anything over 2 MB + 64 KB with a localized page and without reading the
 * body (routes/hub-media.tsx); the 8 MB ceiling here only guards an upload whose length is unknown until it is read.
 */
export const requestBodyLimit: MiddlewareHandler<AppEnv> = (c, next) => {
  const upload = isUploadPath(c.req.path);
  if (upload && declaresLength(c)) return next();
  return bodyLimit({ maxSize: upload ? MAX_UPLOAD_BYTES : MAX_FORM_BYTES, onError: (cc) => cc.text("Payload Too Large", 413) })(c, next);
};
