import Link from "next/link";
import PageShell from "@/components/PageShell";
import CheckoutForm from "@/components/CheckoutForm";
import { connectDB } from "@/server/db";
import { Product } from "@/server/models/Store";
import { getCurrentUser } from "@/server/session";
import { gatewayConfig } from "@/server/checkout/gateways";
import { formatMoney } from "@/server/checkout/validate";
import "../../checkout.css";

export const metadata = { title: "Checkout — Turture SMP", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Checkout({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const { slug } = await params;
  const { cancelled } = await searchParams;
  const next = `/store/checkout/${encodeURIComponent(slug)}`;

  let product: Awaited<ReturnType<typeof loadProduct>> = null;
  try {
    product = await loadProduct(slug);
  } catch {
    product = null;
  }

  if (!product) {
    return (
      <PageShell title="Checkout" art="diamond">
        <div className="co-wrap">
          <div className="card co-card">
            <h2>Product not available</h2>
            <p className="muted">This item does not exist, is no longer on sale, or the store is not open yet.</p>
            <Link className="btn primary" href="/store">Back to the store</Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const user = await getCurrentUser().catch(() => null);
  const cfg = gatewayConfig();

  return (
    <PageShell title="Checkout" intro={`You are buying ${product.name}.`} art="diamond">
      <div className="co-wrap">
        <aside className="card co-summary" style={{ "--rc": product.color } as React.CSSProperties}>
          <div className="rank-name">
            <i className="rank-gem" />
            <h3>{product.name}</h3>
          </div>
          <p className="muted co-type">{product.type}{product.durationDays ? ` · ${product.durationDays} days` : " · one-time"}</p>
          <div className="co-prices">
            <b>{formatMoney(product.price.inr, "INR")}</b>
            <span className="muted">or</span>
            <b>{formatMoney(product.price.usd, "USD")}</b>
          </div>
          {product.description && <p className="muted">{product.description}</p>}
          {product.perks.length > 0 && (
            <ul className="co-perks">
              {product.perks.map((p: string) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <Link className="back muted" href="/store">← Back to the store</Link>
        </aside>

        <section className="card co-card">
          {user ? (
            <>
              <h2>Your details</h2>
              <p className="muted">Signed in as <b>{user.username}</b>.</p>
              <CheckoutForm
                slug={product.slug}
                productName={product.name}
                price={{ inr: formatMoney(product.price.inr, "INR"), usd: formatMoney(product.price.usd, "USD") }}
                inrEnabled={cfg.razorpay}
                usdEnabled={cfg.stripe}
                defaultName={user.minecraftName || ""}
                cancelled={cancelled === "1"}
              />
            </>
          ) : (
            <>
              <h2>Log in to continue</h2>
              <p className="muted">Sign in with Discord so we can link this purchase to your account.</p>
              <Link className="btn discord" href={`/login?next=${encodeURIComponent(next)}`}>Log in to buy</Link>
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}

async function loadProduct(slug: string) {
  if (!process.env.MONGODB_URI) return null;
  await connectDB();
  const p = await Product.findOne({ slug: slug.toLowerCase(), active: true }).lean();
  if (!p || (p.stock != null && p.stock <= 0)) return null;
  return {
    slug: p.slug,
    name: p.name,
    type: p.type,
    description: p.description || "",
    perks: (p.perks || []).map(String),
    color: p.color || "#55e03a",
    price: { inr: p.price.inr, usd: p.price.usd },
    durationDays: p.durationDays || 0,
  };
}
