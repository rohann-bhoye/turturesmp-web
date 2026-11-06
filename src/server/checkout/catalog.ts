import { ranks } from "@/data";
import { connectDB } from "../db";
import { Product } from "../models/Store";
import { formatMoney } from "./validate";

// What the public store needs to render a product card (plain, serializable data).
export type StoreProduct = {
  slug: string;
  name: string;
  type: string;
  description?: string;
  perks: string[];
  color: string;
  price: { inr: string; usd: string };
  durationDays?: number;
  featured: boolean;
  soldOut: boolean;
  /** false for the static fallback list: no database, so no checkout. */
  purchasable: boolean;
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function staticProducts(): StoreProduct[] {
  return ranks.map((r) => ({
    slug: slugify(r.name),
    name: r.name,
    type: "rank",
    perks: r.perks,
    color: r.color,
    price: r.price,
    featured: !!("featured" in r && r.featured),
    soldOut: false,
    purchasable: false,
  }));
}

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/** Active products from MongoDB, or the static list when there is no database / no products / any error. */
export async function getStoreProducts(): Promise<StoreProduct[]> {
  if (!process.env.MONGODB_URI) return staticProducts();
  try {
    const docs = await withTimeout(
      (async () => {
        await connectDB();
        return Product.find({ active: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
      })(),
      8000
    );
    if (!docs.length) return staticProducts();
    return docs.map((p) => ({
      slug: p.slug,
      name: p.name,
      type: p.type,
      description: p.description || undefined,
      perks: (p.perks || []).map(String),
      color: p.color || "#55e03a",
      price: { inr: formatMoney(p.price.inr, "INR"), usd: formatMoney(p.price.usd, "USD") },
      durationDays: p.durationDays || undefined,
      featured: !!p.featured,
      soldOut: p.stock != null && p.stock <= 0,
      purchasable: true,
    }));
  } catch {
    return staticProducts();
  }
}
