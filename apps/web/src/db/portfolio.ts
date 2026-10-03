import { MAX_PORTFOLIO_ITEMS, type PortfolioInput, type PortfolioItem } from "../domain/portfolio.ts";
import { ulid } from "../lib/ulid.ts";

type Row = { id: string; builder_id: string; title: string; url: string | null; description: string; image_key: string | null; sort: number };

function toItem(r: Row): PortfolioItem {
  return { id: r.id, builderId: r.builder_id, title: r.title, url: r.url, description: r.description, imageKey: r.image_key, sort: r.sort };
}

export async function listPortfolio(db: D1Database, builderId: string): Promise<PortfolioItem[]> {
  const { results } = await db.prepare("SELECT * FROM portfolio_items WHERE builder_id = ?1 ORDER BY sort, id").bind(builderId).all<Row>();
  return results.map(toItem);
}

export async function findPortfolioItem(db: D1Database, builderId: string, id: string): Promise<PortfolioItem | null> {
  const row = await db.prepare("SELECT * FROM portfolio_items WHERE id = ?1 AND builder_id = ?2").bind(id, builderId).first<Row>();
  return row ? toItem(row) : null;
}

/** Appends an item; returns null when the builder already has MAX_PORTFOLIO_ITEMS (checked in the same statement). */
export async function addPortfolioItem(db: D1Database, input: { builderId: string; item: PortfolioInput; now: string }): Promise<PortfolioItem | null> {
  const id = ulid(Date.parse(input.now));
  const res = await db
    .prepare(
      `INSERT INTO portfolio_items (id, builder_id, title, url, description, sort, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, (SELECT COALESCE(MAX(sort), 0) + 1 FROM portfolio_items WHERE builder_id = ?2), ?6, ?6
       WHERE (SELECT COUNT(*) FROM portfolio_items WHERE builder_id = ?2) < ?7`,
    )
    .bind(id, input.builderId, input.item.title, input.item.url, input.item.description, input.now, MAX_PORTFOLIO_ITEMS)
    .run();
  return res.meta.changes === 1 ? findPortfolioItem(db, input.builderId, id) : null;
}

export async function updatePortfolioItem(db: D1Database, input: { builderId: string; id: string; item: PortfolioInput; now: string }): Promise<boolean> {
  const res = await db
    .prepare("UPDATE portfolio_items SET title = ?3, url = ?4, description = ?5, updated_at = ?6 WHERE id = ?1 AND builder_id = ?2")
    .bind(input.id, input.builderId, input.item.title, input.item.url, input.item.description, input.now)
    .run();
  return res.meta.changes === 1;
}

export async function deletePortfolioItem(db: D1Database, builderId: string, id: string): Promise<boolean> {
  const res = await db.prepare("DELETE FROM portfolio_items WHERE id = ?1 AND builder_id = ?2").bind(id, builderId).run();
  return res.meta.changes === 1;
}

/** Swaps the item with its neighbour. False when it is already at that edge or not the builder's. */
export async function movePortfolioItem(db: D1Database, input: { builderId: string; id: string; direction: "up" | "down"; now: string }): Promise<boolean> {
  const items = await listPortfolio(db, input.builderId);
  const index = items.findIndex((x) => x.id === input.id);
  const current = items[index];
  const neighbour = items[input.direction === "up" ? index - 1 : index + 1];
  if (index < 0 || !current || !neighbour) return false;
  const stmt = db.prepare("UPDATE portfolio_items SET sort = ?3, updated_at = ?4 WHERE id = ?1 AND builder_id = ?2");
  await db.batch([stmt.bind(current.id, input.builderId, neighbour.sort, input.now), stmt.bind(neighbour.id, input.builderId, current.sort, input.now)]);
  return true;
}
