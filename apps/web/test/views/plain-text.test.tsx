import { describe, expect, it } from "vitest";
import { PlainText } from "../../src/views/PlainText.tsx";

describe("PlainText", () => {
  it("escapes HTML and renders lists", async () => {
    const html = String(await (<PlainText text={"<script>alert(1)</script>\n\n- a & b\n- c"} />));
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("<li>a &amp; b</li>");
  });
});
