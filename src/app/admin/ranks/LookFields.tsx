"use client";
import { useState } from "react";
import McText from "./McText";

// Display name, colour, prefix and suffix inputs with a live chat preview underneath.
export default function LookFields(props: {
  displayName: string;
  color: string;
  prefix: string;
  suffix: string;
  disabled?: boolean;
}) {
  const [displayName, setDisplayName] = useState(props.displayName);
  const [color, setColor] = useState(props.color);
  const [prefix, setPrefix] = useState(props.prefix);
  const [suffix, setSuffix] = useState(props.suffix);
  const d = props.disabled;
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : "#ffffff";
  return (
    <>
      <div className="row">
        <label className="field">
          <span>Display name</span>
          <input name="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={32} disabled={d} />
        </label>
        <label className="field narrow">
          <span>Colour</span>
          <span className="rk-color">
            <input type="color" aria-label="Pick colour" value={safeColor} onChange={(e) => setColor(e.target.value)} disabled={d} />
            <input name="color" value={color} onChange={(e) => setColor(e.target.value)} pattern="#[0-9a-fA-F]{6}" maxLength={7} required disabled={d} aria-label="Colour hex" />
          </span>
        </label>
      </div>
      <div className="row">
        <label className="field">
          <span>Prefix (use &amp;a style colour codes)</span>
          <input name="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={64} placeholder="&6[Gold] " disabled={d} />
        </label>
        <label className="field">
          <span>Suffix</span>
          <input name="suffix" value={suffix} onChange={(e) => setSuffix(e.target.value)} maxLength={64} disabled={d} />
        </label>
      </div>
      <div className="rk-preview" aria-live="polite">
        <small className="muted">Chat preview</small>
        <div>
          <McText text={prefix} />
          <span style={{ color: safeColor }}>Steve</span>
          <McText text={suffix} />
          <span className="rk-msg">: hello there! ({displayName || "…"})</span>
        </div>
      </div>
    </>
  );
}
