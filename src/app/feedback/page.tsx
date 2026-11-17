import PageShell from "@/components/PageShell";
import Link from "next/link";
import { DISCORD_INVITE } from "@/lib";

export const metadata = { title: "Feedback — Turture SMP" };
export const revalidate = 60;

export default function Feedback() {
  return (
    <PageShell title="Feedback" intro="Help us make Turture SMP better. Report bugs, suggest features, or tell us about a problem." art="steve">
      <div className="feedback-wrap" style={{ maxWidth: 700, margin: "0 auto" }}>
        <h2 className="title sub" data-reveal>Send us feedback</h2>
        <p className="muted center-text" data-reveal>
          No login needed. Just tell us what you think and we’ll read it.
        </p>

        <form action="/api/feedback" method="POST" className="feedback-form" style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 24 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              name="minecraftName"
              placeholder="Your Minecraft username (optional)"
              className="feedback-input"
            />
            <select name="type" className="feedback-select">
              <option value="suggestion">Suggestion</option>
              <option value="complaint">Complaint</option>
              <option value="bug">Bug Report</option>
              <option value="other">Other</option>
            </select>
          </div>

          <textarea
            name="message"
            rows={5}
            placeholder="What’s on your mind? Be as detailed as you like..."
            required
            className="feedback-input feedback-textarea"
            style={{ minHeight: 140 }}
          ></textarea>

          <button type="submit" className="btn primary sm-block" style={{ width: "fit-content", alignSelf: "flex-start" }}>
            Send Feedback
          </button>
        </form>

        <p className="muted center-text" style={{ marginTop: 20, fontSize: 13 }} data-reveal>
          Need urgent help? Join our{" "}
          <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="btn discord sm-block" style={{ display: "inline", marginLeft: 6 }}>
            Discord
          </a>
        </p>
      </div>
    </PageShell>
  );
}
