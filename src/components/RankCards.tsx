"use client";
import { useState } from "react";
import { ranks } from "@/data";
import { DISCORD_INVITE, STORE_URL } from "@/lib";
import Icon from "./Icons";

export default function RankCards() {
  const [cur, setCur] = useState<"inr" | "usd">("inr");
  return (
    <>
      <div className="seg" data-v={cur} role="group" aria-label="Currency" data-reveal>
        <button className={cur === "inr" ? "on" : ""} aria-pressed={cur === "inr"} onClick={() => setCur("inr")}>India (₹)</button>
        <button className={cur === "usd" ? "on" : ""} aria-pressed={cur === "usd"} onClick={() => setCur("usd")}>International ($)</button>
      </div>
      <div className="rank-grid">
        {ranks.map((r) => (
          <div
            className={r.featured ? "card rank featured" : "card rank"}
            key={r.name}
            style={{ "--rc": r.color } as React.CSSProperties}
            data-reveal
          >
            {r.featured && <span className="ribbon pixel">Popular</span>}
            <div className="rank-name">
              <i className="rank-gem" />
              <h3>{r.name}</h3>
            </div>
            <b className="price" key={cur}>{r.price[cur]}<small>one-time</small></b>
            <ul>
              {r.perks.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {STORE_URL ? (
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
        {cur === "inr" ? "Pay via UPI, cards or net banking (set up when the store opens)." : "Pay via card or PayPal (set up when the store opens)."} Prices are examples.
      </p>
    </>
  );
}
