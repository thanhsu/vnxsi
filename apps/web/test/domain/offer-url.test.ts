import { describe, expect, it } from "vitest";
import {
  appendUtm,
  authorityOf,
  fillAndValidate,
  fillTemplate,
  hasHttpsPrefix,
  hostAllowed,
  isAuthorityClean,
  isPrintableAscii,
  isPublicHostname,
  MAX_ALLOWED_HOSTS,
  MAX_URL_LENGTH,
  originError,
  parseTemplate,
  placeholderNames,
  PLACEHOLDERS,
  previewUrl,
  SAMPLE_VALUES,
  validateFinalUrl,
} from "../../src/domain/offer-url.ts";

const HOSTS = ["try.elevenlabs.io", "elevenlabs.io"];
const code = (raw: string, hosts: readonly string[] = HOSTS) => {
  const r = validateFinalUrl(raw, hosts);
  return r.ok ? "ok" : r.error;
};
const allCode = (expected: string, raws: string[]) => {
  for (const raw of raws) expect(code(raw), JSON.stringify(raw)).toBe(expected);
};

describe("constants", () => {
  it("has the three placeholders and the limits of the plan header", () => {
    expect([...PLACEHOLDERS]).toEqual(["click_id", "locale", "src"]);
    expect(MAX_URL_LENGTH).toBe(2048);
    expect(MAX_ALLOWED_HOSTS).toBe(20);
    expect(SAMPLE_VALUES).toEqual({ click_id: "01HZZZZZZZZZZZZZZZZZZZZZZZ", locale: "en", src: "tools" });
  });
});

describe("rule 1: printable ASCII [\\x21-\\x7E], no backslash, at most 2048 characters", () => {
  it("isPrintableAscii accepts URL characters and rejects everything else", () => {
    expect(isPrintableAscii("https://elevenlabs.io/a?b=c#d")).toBe(true);
    for (const bad of ["", "a b", "a\tb", "a\rb", "a\nb", "a\0b", "a\x7fb", "é", "ｅ", "a。b", "a\\b", "a​b"]) expect(isPrintableAscii(bad), JSON.stringify(bad)).toBe(false);
  });

  it("validateFinalUrl rejects space, control, non-ASCII, fullwidth, ideographic full stop and backslash as chars", () => {
    allCode("chars", [
      "",
      "https://elevenlabs.io/ x",
      "https://elevenlabs.io/\r\n",
      "https://elevenlabs.io/\tx",
      "https://elevenlabs.io/\x00",
      "https://ｅlevenlabs.io/",
      "https://elevenlabs。io/",
      "https://elevenlabs.io/é",
      "https://elevenlabs.io\\@evil.com",
      "https://elevenlabs.io/a\\b",
    ]);
  });

  it("accepts exactly 2048 characters and rejects 2049", () => {
    const base = "https://elevenlabs.io/";
    expect(code(base + "a".repeat(MAX_URL_LENGTH - base.length))).toBe("ok");
    expect(code(base + "a".repeat(MAX_URL_LENGTH - base.length + 1))).toBe("length");
  });
});

describe("rule 2: starts with lowercase https://", () => {
  it("hasHttpsPrefix is case sensitive", () => {
    expect(hasHttpsPrefix("https://a.io")).toBe(true);
    for (const bad of ["HTTPS://a.io", "Https://a.io", "http://a.io", "https:a.io", "//a.io", "a.io"]) expect(hasHttpsPrefix(bad), bad).toBe(false);
  });

  it("rejects an uppercase scheme, https:evil.com, scheme-relative, http:, javascript:, data: and ftp: as scheme", () => {
    allCode("scheme", [
      "HTTPS://elevenlabs.io/",
      "Https://elevenlabs.io/",
      "https:evil.com",
      "//evil.com",
      "http://elevenlabs.io/",
      "javascript:alert(1)",
      "data:text/html,x",
      "ftp://elevenlabs.io/",
      "elevenlabs.io",
    ]);
  });

  it("rejects https:///evil.com and an empty authority as authority", () => {
    allCode("authority", ["https:///evil.com", "https://", "https:///", "https://?x=1"]);
  });
});

describe("rule 3: the authority has no @, %, { or }", () => {
  it("authorityOf stops at the first / ? or #", () => {
    expect(authorityOf("https://a.io/p?q#f")).toBe("a.io");
    expect(authorityOf("https://a.io?q")).toBe("a.io");
    expect(authorityOf("https://a.io#f")).toBe("a.io");
    expect(authorityOf("https://a.io:443")).toBe("a.io:443");
  });

  it("isAuthorityClean", () => {
    expect(isAuthorityClean("elevenlabs.io")).toBe(true);
    expect(isAuthorityClean("elevenlabs.io:443")).toBe(true);
    for (const bad of ["", "u@a.io", "a.io@evil.com", "a%2eio", "{src}.a.io", "a.io}"]) expect(isAuthorityClean(bad), bad).toBe(false);
  });

  it("rejects userinfo, %2e in the host and a placeholder in the host as authority", () => {
    allCode("authority", [
      "https://elevenlabs.io@evil.com/",
      "https://user:pw@elevenlabs.io/",
      "https://elevenlabs.io:443@evil.com/",
      "https://elevenlabs%2eio/",
      "https://elevenlabs.io%2f@evil.com/",
      "https://%65levenlabs.io/",
      "https://{src}.elevenlabs.io/",
    ]);
  });

  it("an @ or %0d%0a after the authority is harmless: the host does not change and CR/LF stay percent-encoded", () => {
    const at = validateFinalUrl("https://elevenlabs.io/@evil.com", HOSTS);
    expect(at.ok && new URL(at.url).hostname).toBe("elevenlabs.io");
    const crlf = validateFinalUrl("https://elevenlabs.io/%0d%0aSet-Cookie:x", HOSTS);
    expect(crlf.ok).toBe(true);
    expect(crlf.ok && /[\r\n]/.test(crlf.url)).toBe(false);
  });
});

describe("rule 4: WHATWG URL parse", () => {
  it("a string the URL parser refuses is parse", () => {
    allCode("parse", ["https://exa<mple.io/", "https://elevenlabs.io:99999/", "https://exa^mple.io/"]);
  });
});

describe("rule 5: no userinfo, only the default port", () => {
  it("originError", () => {
    expect(originError(new URL("https://u@elevenlabs.io/"))).toBe("userinfo");
    expect(originError(new URL("https://u:p@elevenlabs.io/"))).toBe("userinfo");
    expect(originError(new URL("https://elevenlabs.io:8443/"))).toBe("port");
    expect(originError(new URL("https://elevenlabs.io:443/"))).toBeNull();
    expect(originError(new URL("https://elevenlabs.io/"))).toBeNull();
  });

  it("accepts :443 (href drops it) and rejects :8443", () => {
    expect(validateFinalUrl("https://elevenlabs.io:443/x", HOSTS)).toEqual({ ok: true, url: "https://elevenlabs.io/x" });
    allCode("port", ["https://elevenlabs.io:8443/", "https://elevenlabs.io:80/", "https://elevenlabs.io:444/x"]);
  });
});

describe("rule 6: the hostname is a public name", () => {
  it("isPublicHostname", () => {
    for (const good of ["elevenlabs.io", "try.elevenlabs.io", "a-b.example.co.uk", "xn--p1ai.xn--p1ai", "a1.io"]) expect(isPublicHostname(good), good).toBe(true);
    for (const bad of ["", "localhost", "a.localhost", "elevenlabs", "elevenlabs.io.", ".elevenlabs.io", "a..io", "-a.io", "a-.io", "[::1]", "127.0.0.1", "1.2.3.4", "127.1", "a.1", "example.123", "a_b.io", "a b.io", `${"a".repeat(64)}.io`]) {
      expect(isPublicHostname(bad), bad).toBe(false);
    }
  });

  it("rejects an IPv4 address in every form: decimal, merged, hex, octal", () => {
    allCode("host", ["https://127.0.0.1/", "https://2130706433/", "https://0x7f.1/", "https://0x7f000001/", "https://0177.0.0.1/", "https://127.1/", "https://169.254.169.254/", "https://10.0.0.1/"]);
  });

  it("rejects an IPv6 literal, including an IPv4-mapped one", () => {
    allCode("host", ["https://[::1]/", "https://[::ffff:127.0.0.1]/", "https://[2001:db8::1]/"]);
  });

  it("rejects localhost and *.localhost", () => {
    allCode("host", ["https://localhost/", "https://a.localhost/", "https://LOCALHOST/"]);
  });

  it("rejects a trailing dot and a host with no dot", () => {
    allCode("host", ["https://elevenlabs.io./", "https://elevenlabs/"]);
  });

  it("requires a letter in the last label (a numeric last label is refused already by the URL parser)", () => {
    allCode("parse", ["https://example.123/", "https://a.b.1/"]);
  });
});

describe("rule 7: the host is one of allowed_hosts, exactly or as a subdomain", () => {
  it("hostAllowed does not match a bare string suffix", () => {
    expect(hostAllowed("elevenlabs.io", HOSTS)).toBe(true);
    expect(hostAllowed("try.elevenlabs.io", HOSTS)).toBe(true);
    expect(hostAllowed("a.b.elevenlabs.io", HOSTS)).toBe(true);
    for (const bad of ["evilelevenlabs.io", "elevenlabs.io.evil.com", "io", "elevenlabs.com", "xelevenlabs.io"]) expect(hostAllowed(bad, HOSTS), bad).toBe(false);
    expect(hostAllowed("elevenlabs.io", [])).toBe(false);
  });

  it("validateFinalUrl: look-alike hosts and unlisted hosts are not_allowed", () => {
    allCode("not_allowed", ["https://evil.com/", "https://evilelevenlabs.io/", "https://elevenlabs.io.evil.com/", "https://elevenlabs.com/"]);
    expect(code("https://elevenlabs.io/", [])).toBe("not_allowed");
  });

  it("accepts the host, a listed host and a subdomain", () => {
    allCode("ok", ["https://elevenlabs.io", "https://try.elevenlabs.io/7fnly5cv33k3", "https://a.b.elevenlabs.io/", "https://ELEVENLABS.IO/x"]);
  });
});

describe("rule 8: Location is the re-validated new URL(final).href", () => {
  it("returns the normalised href and it validates to itself", () => {
    for (const [raw, href] of [
      ["https://elevenlabs.io", "https://elevenlabs.io/"],
      ["https://ELEVENLABS.IO/Path?X=1", "https://elevenlabs.io/Path?X=1"],
      ["https://elevenlabs.io:443/x", "https://elevenlabs.io/x"],
      ["https://elevenlabs.io?x=1", "https://elevenlabs.io/?x=1"],
    ] as const) {
      const first = validateFinalUrl(raw, HOSTS);
      expect(first, raw).toEqual({ ok: true, url: href });
      expect(validateFinalUrl(href, HOSTS)).toEqual(first);
    }
  });

  it("open-redirect shapes in the path or query never change the host", () => {
    for (const raw of ["https://elevenlabs.io//evil.com", "https://elevenlabs.io/?next=https://evil.com", "https://elevenlabs.io/%2F%2Fevil.com"]) {
      const r = validateFinalUrl(raw, HOSTS);
      expect(r.ok && new URL(r.url).hostname, raw).toBe("elevenlabs.io");
    }
  });
});

describe("template: placeholders", () => {
  it("placeholderNames", () => {
    expect(placeholderNames("https://a.io/{click_id}?l={locale}")).toEqual(["click_id", "locale"]);
    expect(placeholderNames("https://a.io/")).toEqual([]);
    for (const bad of ["https://a.io/{", "https://a.io/}", "https://a.io/{click_id", "https://a.io/{{click_id}}", "https://a.io/{a{b}"]) expect(placeholderNames(bad), bad).toBeNull();
  });

  it("accepts a link with no placeholder (the first partner link) and a bare host", () => {
    expect(parseTemplate("https://try.elevenlabs.io/7fnly5cv33k3", HOSTS)).toEqual({ ok: true, template: "https://try.elevenlabs.io/7fnly5cv33k3" });
    expect(parseTemplate("https://elevenlabs.io", HOSTS).ok).toBe(true);
  });

  it("accepts the three placeholders after the host: path, query, fragment", () => {
    for (const t of ["https://try.elevenlabs.io/r/{click_id}", "https://try.elevenlabs.io?c={click_id}&l={locale}&s={src}", "https://try.elevenlabs.io#{src}", "https://try.elevenlabs.io/{locale}/x?c={click_id}"]) {
      expect(parseTemplate(t, HOSTS), t).toEqual({ ok: true, template: t });
    }
  });

  it("rejects an unknown placeholder, an empty one and a wrong-case one", () => {
    for (const t of ["https://try.elevenlabs.io/{foo}", "https://try.elevenlabs.io/{}", "https://try.elevenlabs.io/{CLICK_ID}", "https://try.elevenlabs.io/{click_id }"]) {
      expect(parseTemplate(t, HOSTS), t).toEqual({ ok: false, error: "placeholder" });
    }
  });

  it("rejects an odd { or }", () => {
    for (const t of ["https://try.elevenlabs.io/{", "https://try.elevenlabs.io/}", "https://try.elevenlabs.io/{click_id", "https://try.elevenlabs.io/{{click_id}}"]) {
      expect(parseTemplate(t, HOSTS), t).toEqual({ ok: false, error: "braces" });
    }
  });

  it("rejects a placeholder in the scheme, host, port or userinfo", () => {
    for (const t of ["https://{src}.elevenlabs.io/", "https://a.{src}.io/", "https://elevenlabs.io{click_id}", "https://elevenlabs.io:{src}/", "https://{click_id}@elevenlabs.io/", "https://elevenlabs.io@{src}/", "{src}https://elevenlabs.io/", "http://elevenlabs.io/{src}"]) {
      expect(parseTemplate(t, HOSTS), t).toEqual({ ok: false, error: "placeholder_position" });
    }
  });

  it("also applies every URL rule to the template, with the sample values filled in", () => {
    expect(parseTemplate("https://evil.com/{click_id}", HOSTS)).toEqual({ ok: false, error: "not_allowed" });
    expect(parseTemplate("https://127.0.0.1/{src}", HOSTS)).toEqual({ ok: false, error: "host" });
    expect(parseTemplate("http://elevenlabs.io/x", HOSTS)).toEqual({ ok: false, error: "scheme" });
    expect(parseTemplate("https://try.elevenlabs.io:8443/{src}", HOSTS)).toEqual({ ok: false, error: "port" });
    expect(parseTemplate("https://try.elevenlabs.io/é{src}", HOSTS)).toEqual({ ok: false, error: "chars" });
  });
});

describe("template: fill with encodeURIComponent, validate at save (sample) and at redirect (real values)", () => {
  it("fillTemplate encodes every value", () => {
    const filled = fillTemplate("https://a.io/{src}?c={click_id}&l={locale}", { click_id: "a&b=c/d", locale: "zh-hans", src: "@evil.com/x y" });
    expect(filled).toBe("https://a.io/%40evil.com%2Fx%20y?c=a%26b%3Dc%2Fd&l=zh-hans");
  });

  it("previewUrl fills the sample values and validates", () => {
    expect(previewUrl("https://try.elevenlabs.io/r/{click_id}?l={locale}&s={src}", HOSTS)).toEqual({
      ok: true,
      url: "https://try.elevenlabs.io/r/01HZZZZZZZZZZZZZZZZZZZZZZZ?l=en&s=tools",
    });
    expect(previewUrl("https://evil.com/{src}", HOSTS)).toEqual({ ok: false, error: "not_allowed" });
  });

  it("real values cannot change the host, even hostile ones", () => {
    const r = fillAndValidate("https://try.elevenlabs.io/{src}?c={click_id}", { click_id: "../../x", locale: "en", src: "@evil.com" }, HOSTS);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(new URL(r.url).hostname).toBe("try.elevenlabs.io");
      expect(r.url).not.toContain("@");
    }
  });

  it("refuses a { or } left after filling", () => {
    expect(fillAndValidate("https://try.elevenlabs.io/{foo}", SAMPLE_VALUES, HOSTS)).toEqual({ ok: false, error: "chars" });
    expect(fillAndValidate("https://try.elevenlabs.io/{click_id", SAMPLE_VALUES, HOSTS)).toEqual({ ok: false, error: "chars" });
  });

  it("re-validates after filling: a value that makes the URL too long fails, a lone surrogate does not throw", () => {
    expect(fillAndValidate("https://try.elevenlabs.io/{click_id}", { ...SAMPLE_VALUES, click_id: "a".repeat(3000) }, HOSTS)).toEqual({ ok: false, error: "length" });
    expect(fillAndValidate("https://try.elevenlabs.io/{click_id}", { ...SAMPLE_VALUES, click_id: "\ud800" }, HOSTS)).toEqual({ ok: false, error: "chars" });
  });
});

describe("appendUtm", () => {
  const UTM = "utm_source=vnx.si&utm_medium=referral";

  it("adds the two parameters when the URL has no utm_* parameter", () => {
    expect(appendUtm("https://elevenlabs.io/")).toBe(`https://elevenlabs.io/?${UTM}`);
    expect(appendUtm("https://elevenlabs.io/?a=1%20b")).toBe(`https://elevenlabs.io/?a=1%20b&${UTM}`);
    expect(appendUtm("https://elevenlabs.io/x#y")).toBe(`https://elevenlabs.io/x?${UTM}#y`);
  });

  it("leaves a URL with any utm_* parameter (any case) alone", () => {
    for (const url of ["https://elevenlabs.io/?utm_campaign=x", "https://elevenlabs.io/?a=1&UTM_Source=x", "https://elevenlabs.io/?utm_medium="]) expect(appendUtm(url), url).toBe(url);
  });

  it("the result still passes validateFinalUrl unchanged", () => {
    const withUtm = appendUtm("https://elevenlabs.io/");
    expect(validateFinalUrl(withUtm, HOSTS)).toEqual({ ok: true, url: withUtm });
  });
});
