const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function defaultRandom(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function ulid(now: number = Date.now(), random: (n: number) => Uint8Array = defaultRandom): string {
  let time = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = ENCODING.charAt(t % 32) + time;
    t = Math.floor(t / 32);
  }
  const bytes = random(16);
  let rand = "";
  for (let i = 0; i < 16; i++) rand += ENCODING.charAt((bytes[i] ?? 0) % 32);
  return time + rand;
}

/**
 * A public identifier with no time component: 26 Crockford base32 characters (the ULID alphabet and length, so URL validation is shared)
 * from random bytes only. A ULID's first ten characters are its creation time, which would tell a reader when a request was submitted
 * (S-3); a public id must not. 256 is a multiple of 32, so `% 32` is unbiased.
 */
export function publicId(random: (n: number) => Uint8Array = defaultRandom): string {
  const bytes = random(26);
  let out = "";
  for (let i = 0; i < 26; i++) out += ENCODING.charAt((bytes[i] ?? 0) % 32);
  return out;
}
