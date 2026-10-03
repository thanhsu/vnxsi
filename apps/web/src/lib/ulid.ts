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
