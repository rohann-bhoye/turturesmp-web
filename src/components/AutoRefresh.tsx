"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetches the server component every few seconds while a payment is still being confirmed (max ~2 minutes).
export default function AutoRefresh({ every = 4000, max = 30 }: { every?: number; max?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      if (++n > max) return clearInterval(t);
      router.refresh();
    }, every);
    return () => clearInterval(t);
  }, [router, every, max]);
  return null;
}
