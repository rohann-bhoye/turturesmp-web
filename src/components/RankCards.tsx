"use client";
import { useState } from "react";
import Link from "next/link";
import { DISCORD_INVITE, STORE_URL } from "@/lib";
import Icon from "./Icons";

// Plain data prepared on the server (database products, or the static fallback from data.ts).
export type CardProduct = {
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
  purchasable: boolean;
};

const TYPE_LABELS: Record<string, string> = { rank: "Ranks", tag: "Tags", role: "Roles", key: "Keys", bundle: "Bundles", other: "Other" };

export default function RankCards({ products }: { products: CardProduct[] }) {
  const [cur, setCur] = useState<"inr" | "usd">("inr");
  const [type, setType] = useState("all");
  const types = Array.from(new Set(products.map((p) => p.type)));
  const anyLive = products.some((p) => p.purchasable);

  return (
    <>
      <div className="seg" data-v={cur} role="group" aria-label="Currency" data-reveal>
        <button className={cur === "inr" ? "on" : ""} aria-pressed={cur === "inr"} onClick={() => setCur("inr")}>India (₹)</button>
        <button className={cur === "usd" ? "on" : ""} aria-pressed={cur === "usd"} onClick={() => setCur("usd")}>International ($)</button>
      </div>

      {types.length > 1 && (
        <div className="type-filter" role="group" aria-label="Product type">
          {["all", ...types].map((t) => (
            <button key={t} className={type === t ? "on" : ""} aria-pressed={type === t} onClick={() => setType(t)}>
              {t === "all" ? "All" : TYPE_LABELS[t] || t}
            </button>
          ))}
        </div>
      )}

      <div className="rank-grid">
        {products.map((r) => (
          <div
            className={r.featured ? "card rank featured" : "card rank"}
            key={r.slug}
            hidden={type !== "all" && r.type !== type}
            style={{ "--rc": r.color } as React.CSSProperties}
            data-reveal
          >
            {r.featured && <span className="ribbon pixel">Popular</span>}
            <div className="rank-name">
              <i className="rank-gem" />
              <h3>{r.name}</h3>
            </div>
            <b className="price" key={cur}>
              {r.price[cur]}
              <small>{r.durationDays ? `${r.durationDays} days` : "one-time"}</small>
            </b>
            {r.description && <p className="rank-desc">{r.description}</p>}
            <ul>
              {r.perks.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {r.purchasable ? (
              r.soldOut ? (
                <span className="btn ghost sm-block is-disabled" aria-disabled="true">Sold out</span>
              ) : (
                <Link className={`btn ${r.featured ? "gold" : "primary"} sm-block`} href={`/store/checkout/${r.slug}`}>
                  Buy {r.name} <Icon name="arrow" />
                </Link>
              )
            ) : STORE_URL ? (
              <a className={`btn ${r.featured ? "gold" : "primary"} sm-block`} href={STORE_URL} target="_blank" rel="noopener noreferrer">
                Get {r.name} <Icon name="arrow" />
              </a>
            ) : (
              <a className="btn discord sm-block" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
                <Icon name="discord" /> Ask on Discord
              </a>
            )}
          </div>
        ))}
      </div>
      <p className="muted center-text pay-note">
        {anyLive
          ? cur === "inr"
            ? "Pay securely with UPI, cards or net banking via Razorpay."
            : "Pay securely by card via Stripe."
          : cur === "inr"
            ? "Pay via UPI, cards or net banking (set up when the store opens). Prices are examples."
            : "Pay via card or PayPal (set up when the store opens). Prices are examples."}
      </p>
    </>
  );
}
