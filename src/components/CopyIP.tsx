"use client";
import { useRef, useState } from "react";
import { SERVER_IP } from "@/lib";
import Icon from "./Icons";

export default function CopyIP() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
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
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button className="ipbox" onClick={copy} aria-label={`Copy server IP ${SERVER_IP}`}>
      <span className="ip">{SERVER_IP}</span>
      <span className="copy" aria-live="polite">
        <Icon name={copied ? "check" : "copy"} />
        {copied ? "Copied!" : "Copy IP"}
      </span>
    </button>
  );
}
