import PageShell from "@/components/PageShell";
import RankCards from "@/components/RankCards";

export const metadata = { title: "Store — Turture SMP" };

export default function Store() {
  return (
    <PageShell title="Ranks & Store" intro="Support the server and unlock perks. Never pay-to-win." art="diamond">
      <RankCards />
    </PageShell>
  );
}
