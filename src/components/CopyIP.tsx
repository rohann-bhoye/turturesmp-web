"use client";
import { useState } from "react";
import { SERVER_IP } from "@/lib";

export default function CopyIP() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SERVER_IP);
    } catch {
      const el = document.createElement("textarea");
      el.value = SERVER_IP;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button className="ipbox" onClick={copy} aria-label="Copy server IP">
      <span className="ip">{SERVER_IP}</span>
      <span className="copy">{copied ? "✓ Copied!" : "Copy IP"}</span>
    </button>
  );
}
