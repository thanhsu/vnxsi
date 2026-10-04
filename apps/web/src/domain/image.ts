export type ImageExt = "jpg" | "png" | "webp";

export const IMAGE_CONTENT_TYPE: Record<ImageExt, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

const ULID = "[0-9A-HJKMNP-TV-Z]{26}";
/** `products/{productId}/{ulid}.{ext}` — the only keys /media serves (spec §8.5). */
export const MEDIA_KEY_RE = new RegExp(`^products/${ULID}/${ULID}\\.(jpg|png|webp)$`);

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

/** Image type from the file's first bytes; never trusts the declared Content-Type. */
export function sniffImage(bytes: Uint8Array): ImageExt | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}
