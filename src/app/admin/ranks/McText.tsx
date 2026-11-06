import { mcToSpans } from "@/server/ranks-util";

// Renders text with Minecraft "&" codes as coloured spans. Pure and safe to use on server or client.
export default function McText({ text, fallback }: { text: string; fallback?: string }) {
  const spans = mcToSpans(text);
  const base = fallback ? { color: fallback } : undefined;
  return (
    <span className="mc-text" style={base}>
      {spans.map((s, i) => (
        <span
          key={i}
          style={{
            color: s.color,
            fontWeight: s.bold ? 800 : undefined,
            fontStyle: s.italic ? "italic" : undefined,
            textDecoration: [s.underline && "underline", s.strike && "line-through"].filter(Boolean).join(" ") || undefined,
          }}
        >
          {s.text}
        </span>
      ))}
    </span>
  );
}
