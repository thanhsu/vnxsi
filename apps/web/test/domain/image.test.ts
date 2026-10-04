import { describe, expect, it } from "vitest";
import { MEDIA_KEY_RE, sniffImage } from "../../src/domain/image.ts";

const bytes = (...b: number[]) => new Uint8Array(b);

describe("image sniffing (spec §8.5)", () => {
  it("recognises JPEG, PNG and WebP by their first bytes", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0, 0))).toBe("jpg");
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("png");
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0))).toBe("webp");
  });

  it("rejects everything else, whatever it claims to be", () => {
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("GIF89a...."))).toBeNull();
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20))).toBeNull();
    expect(sniffImage(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffImage(bytes())).toBeNull();
  });

  it("accepts only well-formed media keys", () => {
    expect(MEDIA_KEY_RE.test("products/01J0000000000000000000000A/01J0000000000000000000000B.png")).toBe(true);
    for (const key of ["products/../x.png", "products/01J0000000000000000000000A/01J0000000000000000000000B.gif", "other/01J0000000000000000000000A/01J0000000000000000000000B.png", "products/abc/def.png"]) {
      expect(MEDIA_KEY_RE.test(key), key).toBe(false);
    }
  });
});
