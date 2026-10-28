import { getDb } from "../db";

export interface Article { id: string; title: string; category: string; body: string }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function searchArticles(query: string, limit = 3): Article[] {
  const words = norm(query).split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const rows = getDb().prepare("SELECT * FROM articles").all() as unknown as (Article & { keywords: string })[];
  return rows
    .map((a) => {
      const hay = norm(`${a.title} ${a.keywords} ${a.body}`);
      return { a, score: words.reduce((s, w) => s + (hay.includes(w) ? (norm(a.title + a.keywords).includes(w) ? 2 : 1) : 0), 0) };
    })
    .filter((x) => x.score >= 2)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map(({ a }) => ({ id: a.id, title: a.title, category: a.category, body: a.body }));
}
