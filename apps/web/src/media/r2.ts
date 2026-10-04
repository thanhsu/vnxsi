import { IMAGE_CONTENT_TYPE, type ImageExt } from "../domain/image.ts";
import { ulid } from "../lib/ulid.ts";

export function productMediaKey(productId: string, ext: ImageExt, now: string): string {
  return `products/${productId}/${ulid(Date.parse(now))}.${ext}`;
}

export async function putImage(bucket: R2Bucket, key: string, bytes: Uint8Array, ext: ImageExt): Promise<void> {
  await bucket.put(key, bytes, { httpMetadata: { contentType: IMAGE_CONTENT_TYPE[ext] } });
}

export async function deleteImage(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}
