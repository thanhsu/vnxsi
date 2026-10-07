import { describe, expect, it } from "vitest";
import { readPublicStats } from "../../src/db/public-stats.ts";
import { homeView } from "../../src/domain/public-stats.ts";
import { Live } from "../../src/views/home/Live.tsx";
import { MarketPulse } from "../../src/views/home/MarketPulse.tsx";
import { Numbers } from "../../src/views/home/Numbers.tsx";
import { TopBuildersBlock } from "../../src/views/home/TopBuilders.tsx";
import { TopProductsBlock } from "../../src/views/home/TopProducts.tsx";
import { Founding, Trending } from "../../src/views/home/Trending.tsx";
import { DB, seedSnapshot } from "./blocks.ts";

const item = { id: "i", slug: "s", name: "Item", tagline: "Tag", category: "crm" as const, builderHandle: "b", builderName: "B", coverKey: null, minPriceCents: null, badgeScore: 0 };

describe("blocks do not know where they sit", () => {
  it("each body renders alone with no section, container or lp- class, and prints its own content", async () => {
    await seedSnapshot();
    const view = homeView(await readPublicStats(DB, new Date()), [item]);
    const bodies = {
      numbers: { node: <Numbers locale="en" tiles={view.numbers!} />, marker: "data-stat=" },
      live: { node: <Live locale="en" events={view.live!} now={new Date()} />, marker: 'class="home-live-item"' },
      trending: { node: <Trending locale="en" items={view.trending!} />, marker: "<ol" },
      founding: { node: <Founding locale="en" items={[item]} />, marker: "home-tile" },
      pulse: { node: <MarketPulse locale="en" {...view.pulse!} />, marker: 'data-chart="requests-by-category"' },
      builders: { node: <TopBuildersBlock locale="en" data={view.builders!} />, marker: "data-tab=" },
      products: { node: <TopProductsBlock locale="en" data={view.products!} />, marker: 'id="home-top-' },
    };
    for (const [name, { node, marker }] of Object.entries(bodies)) {
      const html = await node.toString();
      expect(html.length, name).toBeGreaterThan(0);
      expect(html, name).toContain(marker);
      expect(html, name).not.toMatch(/<section\b|class="[^"]*\bcontainer\b|class="[^"]*\blp-/);
    }
  });
});
