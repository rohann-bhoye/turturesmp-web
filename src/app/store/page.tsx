import PageShell from "@/components/PageShell";
import RankCards from "@/components/RankCards";
import { getStoreProducts } from "@/server/checkout/catalog";
import "./checkout.css";

export const metadata = { title: "Store — Turture SMP" };
// Statically generated; re-reads products from MongoDB at most once a minute (falls back to data.ts without a database).
export const revalidate = 60;

export default async function Store() {
  const products = await getStoreProducts();
  return (
    <PageShell title="Ranks & Store" intro="Support the server and unlock perks. Never pay-to-win." art="diamond">
      <RankCards products={products} />
    </PageShell>
  );
}
