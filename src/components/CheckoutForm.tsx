"use client";
import { useEffect, useState } from "react";

type Props = {
  slug: string;
  productName: string;
  price: { inr: string; usd: string };
  inrEnabled: boolean;
  usdEnabled: boolean;
  defaultName?: string;
  cancelled?: boolean;
};

type RazorpayParams = Record<string, unknown>;
declare global {
  interface Window {
    Razorpay?: new (opts: RazorpayParams) => { open: () => void; on: (ev: string, cb: () => void) => void };
  }
}

const NAME_JAVA = /^[A-Za-z0-9_]{3,16}$/;
const NAME_BEDROCK = /^\.?[A-Za-z0-9_ ]{3,16}$/;

function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export default function CheckoutForm({ slug, productName, price, inrEnabled, usdEnabled, defaultName, cancelled }: Props) {
  const [edition, setEdition] = useState<"java" | "bedrock">("java");
  const [currency, setCurrency] = useState<"INR" | "USD">(inrEnabled || !usdEnabled ? "INR" : "USD");
  const [mcName, setMcName] = useState(defaultName || "");
  const [coupon, setCoupon] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(cancelled ? "Payment was cancelled. You have not been charged." : "");

  // Razorpay's script is only needed (and only loaded) on this page, and only for INR.
  useEffect(() => {
    if (currency === "INR" && inrEnabled) void loadRazorpay();
  }, [currency, inrEnabled]);

  const nameOk = (edition === "bedrock" ? NAME_BEDROCK : NAME_JAVA).test(mcName.trim());
  const enabled = currency === "INR" ? inrEnabled : usdEnabled;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!nameOk) {
      setError(edition === "bedrock" ? "Bedrock names are 3-16 letters, numbers, underscores or spaces (may start with a dot)." : "Java names are 3-16 letters, numbers or underscores.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, mcName: mcName.trim(), edition, currency, coupon: coupon.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/store/checkout/${slug}`)}`;
        return;
      }
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not start the payment.");
        setBusy(false);
        return;
      }
      if (data.provider === "stripe") {
        window.location.href = data.url;
        return;
      }
      if (!(await loadRazorpay()) || !window.Razorpay) {
        setError("Could not load the payment window. Check your connection and try again.");
        setBusy(false);
        return;
      }
      const orderNo: string = data.orderNo;
      const rz = new window.Razorpay({
        ...data.razorpay,
        handler: async (r: Record<string, string>) => {
          try {
            await fetch("/api/checkout/razorpay-verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(r),
            });
          } catch {
            /* the webhook will still confirm the payment */
          }
          window.location.href = `/store/success?order=${encodeURIComponent(orderNo)}`;
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rz.on("payment.failed", () => {
        setError("The payment failed. You can try again.");
        setBusy(false);
      });
      rz.open();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form className="co-form" onSubmit={submit} noValidate>
      {error && <p className="notice err" role="alert">{error}</p>}

      <div className="field">
        <span>Edition</span>
        <div className="co-choice" role="group" aria-label="Minecraft edition">
          {(["java", "bedrock"] as const).map((ed) => (
            <button type="button" key={ed} className={edition === ed ? "on" : ""} aria-pressed={edition === ed} onClick={() => setEdition(ed)}>
              {ed === "java" ? "Java" : "Bedrock"}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>Minecraft username</span>
        <input
          value={mcName}
          onChange={(e) => setMcName(e.target.value)}
          placeholder={edition === "bedrock" ? ".YourGamertag" : "Steve"}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={17}
          required
          aria-invalid={mcName.length > 0 && !nameOk}
        />
        {mcName.length > 0 && !nameOk && <small className="co-hint err">Check the spelling: this must match your in-game name exactly.</small>}
      </label>

      <div className="field">
        <span>Pay in</span>
        <div className="co-choice" role="group" aria-label="Currency">
          <button type="button" className={currency === "INR" ? "on" : ""} aria-pressed={currency === "INR"} disabled={!inrEnabled} onClick={() => setCurrency("INR")}>
            INR {price.inr}
          </button>
          <button type="button" className={currency === "USD" ? "on" : ""} aria-pressed={currency === "USD"} disabled={!usdEnabled} onClick={() => setCurrency("USD")}>
            USD {price.usd}
          </button>
        </div>
        <small className="co-hint">{currency === "INR" ? "UPI, cards and net banking via Razorpay." : "Card payment via Stripe."}</small>
      </div>

      <label className="field">
        <span>Coupon code (optional)</span>
        <input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="SUMMER10" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={40} />
        <small className="co-hint">The discount is applied and checked when you continue to payment.</small>
      </label>

      <button className="btn gold co-pay" type="submit" disabled={busy || !enabled}>
        {busy ? "Starting payment..." : enabled ? `Pay for ${productName}` : "Not available right now"}
      </button>
      <p className="co-fine muted">Delivered automatically to your account after payment. By paying you agree to the server rules.</p>
    </form>
  );
}
