import Link from "next/link";
import { requireRole } from "@/server/guard";
import { hasRole } from "@/server/roles";
import { STORE_TABS, storeHref, type StoreSearch } from "./_lib";
import OverviewTab from "./_components/OverviewTab";
import ProductsTab from "./_components/ProductsTab";
import OrdersTab from "./_components/OrdersTab";
import CouponsTab from "./_components/CouponsTab";
import "../store.css";

export const metadata = { title: "Store & Orders — Turture SMP" };
export const dynamic = "force-dynamic";

export default async function StorePage({ searchParams }: { searchParams: Promise<StoreSearch> }) {
  // Viewers and mods may read orders; everything else (and every change) is admin only.
  const user = await requireRole("viewer");
  const admin = hasRole(user.role, "admin");
  const sp = await searchParams;
  const tabs = admin ? STORE_TABS : STORE_TABS.filter((t) => t.key === "orders");
  const tab = tabs.find((t) => t.key === sp.tab)?.key ?? tabs[0].key;

  return (
    <div className="st">
      <h1 className="admin-h" style={{ marginBottom: 0 }}>Store &amp; Orders</h1>
      <nav className="st-tabs" aria-label="Store sections">
        {tabs.map((t) => (
          <Link key={t.key} href={storeHref({ tab: t.key })} className={t.key === tab ? "on" : undefined} aria-current={t.key === tab ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      {sp.ok && <p className="notice ok" role="status">{sp.ok}</p>}
      {sp.error && <p className="notice err" role="alert">{sp.error}</p>}

      {tab === "overview" && <OverviewTab />}
      {tab === "products" && <ProductsTab edit={sp.edit} />}
      {tab === "orders" && <OrdersTab status={sp.status} q={sp.q} page={sp.page} showNew={sp.new === "1"} canEdit={admin} />}
      {tab === "coupons" && <CouponsTab edit={sp.edit} />}
    </div>
  );
}
