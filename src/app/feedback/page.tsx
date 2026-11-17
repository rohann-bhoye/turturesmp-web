import PageShell from "@/components/PageShell";
import { DISCORD_INVITE } from "@/lib";
import FeedbackForm from "./FeedbackForm";

export const metadata = { title: "Feedback — Turture SMP" };
export const revalidate = 60;

export default function Feedback() {
  return (
    <PageShell title="Feedback" intro="Help us make Turture SMP better. Report bugs, suggest features, or tell us about a problem." art="steve">
      <div className="feedback-wrap">
        <section className="card feedback-card">
          <h2 className="title sub">Send us feedback</h2>
          <p className="muted">No login needed. Tell us what you think and our team will read it.</p>
          <FeedbackForm />
        </section>
        <p className="feedback-help muted">
          Need urgent help? Join our{" "}
          <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">Discord community</a>.
        </p>
      </div>
    </PageShell>
  );
}
