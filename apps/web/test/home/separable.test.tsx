import { describe, expect, it } from "vitest";
import { readPublicStats } from "../../src/db/public-stats.ts";
import { homeView } from "../../src/domain/public-stats.ts";
import { Numbers } from "../../src/views/home/Numbers.tsx";
import { Founding, Trending } from "../../src/views/home/Trending.tsx";
import { DB, seedSnapshot } from "./blocks.ts";

const item = { id: "i", slug: "s", name: "Item", tagline: "Tag", category: "crm" as const, builderHandle: "b", builderName: "B", coverKey: null, minPriceCents: null, badgeScore: 0 };

describe("blocks do not know where they sit", () => {
  it("each body renders alone with no section, container or lp- class", async () => {
    await seedSnapshot();
    const view = homeView(await readPublicStats(DB, new Date()), [item]);
    const bodies = {
      numbers: <Numbers locale="en" tiles={view.numbers!} />,
      trending: <Trending locale="en" items={view.trending!} />,
      founding: <Founding locale="en" items={[item]} />,
    };
    for (const [name, node] of Object.entries(bodies)) {
      const html = String(await node);
      expect(html.length, name).toBeGreaterThan(0);
      expect(html, name).not.toMatch(/<section\b|class="[^"]*\bcontainer\b|class="[^"]*\blp-/);
    }
  });
});
