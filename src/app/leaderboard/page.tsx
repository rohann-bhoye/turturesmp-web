import PageShell from "@/components/PageShell";
import LeaderboardTabs from "@/components/LeaderboardTabs";
import { getLeaderboards } from "@/server/leaderboard";

export const metadata = { title: "Leaderboard — Turture SMP" };
// Rebuilt at most once a minute, so the page stays fast and the database is hardly touched.
export const revalidate = 60;

export default async function Leaderboard() {
  const boards = await getLeaderboards();
  return (
    <PageShell title="Hall of Fame" intro="The best players on Turture SMP. Live stats, refreshed every minute." art="steve">
      <LeaderboardTabs boards={boards} />
    </PageShell>
  );
}
