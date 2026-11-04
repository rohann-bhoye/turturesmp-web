"use client";
import { useState } from "react";
import { ranks } from "@/data";
import { DISCORD_INVITE, STORE_URL } from "@/lib";

export default function RankCards() {
  const [cur, setCur] = useState<"inr" | "usd">("inr");
  return (
    <>
      <div className="cur-toggle" role="group" aria-label="Currency">
        <button className={cur === "inr" ? "on" : ""} onClick={() => setCur("inr")}>🇮🇳 India (₹)</button>
        <button className={cur === "usd" ? "on" : ""} onClick={() => setCur("usd")}>🌍 International ($)</button>
      </div>
      <div className="grid">
        {ranks.map((r) => (
          <div className={r.featured ? "card rank featured" : "card rank"} key={r.name}>
            {r.featured && <span className="ribbon pixel">Popular</span>}
            <h3 className="pixel" style={{ color: r.color, fontSize: 18 }}>{r.name}</h3>
            <b className="price">{r.price[cur]}</b>
            <ul>
              {r.perks.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {STORE_URL ? (
              <a className="btn primary sm-block" href={STORE_URL} target="_blank" rel="noopener noreferrer">Buy {r.name}</a>
            ) : (
              <a className="btn discord sm-block" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">Ask on Discord</a>
            )}
          </div>
        ))}
      </div>
      <p className="muted center-text">
        {cur === "inr" ? "Pay via UPI, cards or net banking (set up when the store opens)." : "Pay via card or PayPal (set up when the store opens)."} Prices are examples.
      </p>
    </>
  );
}
