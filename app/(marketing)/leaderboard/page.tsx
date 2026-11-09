import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/shared/primitives";
import { getGlobalLeaderboard } from "@/lib/rating/leaderboard";
import { rankService } from "@/lib/rating/RankService";
import { isMongoConfigured } from "@/lib/mongo";
import { createPageMetadata } from "@/seo/metadata";
import { redirect } from "next/navigation";
import { isLeaderboardsPageEnabled } from "@/lib/platform/feature-flags";

export const metadata: Metadata = createPageMetadata({
  title: "Global Rating Leaderboard",
  description: "Top WallBang CS2 players ranked by global rating.",
  path: "/leaderboard",
});

const topTenBadgeColors = [
  "#ffd54a", "#c0c8d2", "#d78a52", "#b784ff", "#b784ff",
  "#49d9e8", "#49d9e8", "#49d9e8", "#49d9e8", "#49d9e8",
];

function PositionBadge({ position, rankColor }: { position: number; rankColor: string }) {
  const color = topTenBadgeColors[position - 1] ?? rankColor;
  return (
    <span className="inline-flex min-w-12 justify-center rounded-lg border border-white/10 bg-[#181c23] px-2.5 py-1.5 font-bold tabular-nums" style={{ color }}>
      #{position}
    </span>
  );
}

export default async function LeaderboardPage() {
  if (!(await isLeaderboardsPageEnabled())) redirect("/");
  const leaderboard = isMongoConfigured() ? await getGlobalLeaderboard().catch(() => null) : null;
  const players = leaderboard?.players ?? null;

  return (
    <div className="min-h-[70vh] bg-[#090b0f] py-10 text-white sm:py-14">
      <Container>
        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_80%_15%,rgba(232,35,62,0.2),transparent_48%),linear-gradient(115deg,#10141b,#090b0f_65%)] px-6 py-8 sm:px-10 sm:py-10">
          <p className="text-xs font-bold tracking-[0.2em] text-rose-500 uppercase">▮ WallBang Rating</p>
          <h1 className="mt-3 text-4xl font-black italic tracking-tight sm:text-6xl">Global <span className="text-rose-500">Leaderboard</span></h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">Players ranked by WallBang Rating. Ties are ordered by SteamID.</p>
          {/* {players ? <div className="mt-7 grid max-w-3xl gap-3 sm:grid-cols-3">
            {[[activePlayers.toLocaleString(), "Active Players"], [totalMatches.toLocaleString(), "Total Matches"], [topRating.toLocaleString(), "Top Rating"]].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4"><p className="text-2xl font-extrabold tabular-nums">{value}</p><p className="mt-1 text-sm text-slate-300">{label}</p></div>
            ))}
          </div> : null} */}
        </header>

        {players ? players.length ? <section className="mt-6 rounded-3xl border border-white/15 bg-[#0c0f14] p-3 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:p-6">
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[850px] border-separate border-spacing-y-1.5 text-left text-sm">
            <thead><tr className="text-[0.68rem] font-bold tracking-[0.14em] text-slate-400 uppercase"><th className="px-4 py-3">#</th><th className="px-4 py-3">Player</th>{/* <th className="px-4 py-3">Rank</th> */}<th className="px-4 py-3 text-right">Rating</th>{/* <th className="px-4 py-3 text-right">Win rate</th><th className="px-4 py-3 text-right">Matches</th> */}</tr></thead>
            <tbody>{players.map((player, i) => {
              const rank = rankService.rankFromRating(player.rating);
              const rankColor = rankService.colorForRank(rank).hex;
              return <tr key={player.steamId} className="bg-[#151920] transition-colors hover:bg-[#1b2029] [&>td]:border-y [&>td]:border-white/[0.06] [&>td]:px-4 [&>td]:py-3 first:[&>td:first-child]:rounded-l-2xl last:[&>td:last-child]:rounded-r-2xl">
                <td className="w-20"><PositionBadge position={i + 1} rankColor={rankColor} /></td>
                <td><Link href={`/profile/${player.steamId}`} className="flex items-center gap-3 font-semibold hover:text-rose-400">{player.avatar ? <img src={player.avatar} alt="" className="size-10 rounded-full border border-white/15 object-cover" /> : <span className="size-10 rounded-full bg-slate-700" />}{player.name}</Link></td>
                {/* <td><span className="rounded-lg border border-white/10 px-3 py-1.5 font-bold" style={{ color: rankColor }}>{rank}</span></td> */}
                <td className="text-right text-base font-bold tabular-nums">{player.rating.toLocaleString()}</td>
                {/* <td className="text-right"><span className="font-bold text-emerald-400">{winRate.toFixed(1)}%</span><span className="ml-2 inline-block h-1.5 w-16 overflow-hidden rounded-full bg-slate-700 align-middle"><span className="block h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(winRate, 100)}%` }} /></span></td> */}
                {/* <td className="text-right tabular-nums text-slate-300">{player.matchesPlayed.toLocaleString()}</td> */}
              </tr>;
            })}</tbody>
          </table></div>
          <div className="space-y-2 md:hidden">{players.map((player, i) => {
            const rank = rankService.rankFromRating(player.rating);
            const rankColor = rankService.colorForRank(rank).hex;
            return <Link key={player.steamId} href={`/profile/${player.steamId}`} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#151920] p-3">
              <PositionBadge position={i + 1} rankColor={rankColor} />{player.avatar ? <img src={player.avatar} alt="" className="size-9 rounded-full border border-white/15 object-cover" /> : <span className="size-9 rounded-full bg-slate-700" />}
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{player.name}</span></span><span className="text-right text-sm font-bold tabular-nums">{player.rating.toLocaleString()}{/* <span className="block text-[0.65rem] font-normal text-slate-400">{player.matchesPlayed} matches</span> */}</span>
            </Link>;
          })}</div>
        </section> : <p className="py-12 text-center text-sm text-slate-400">No rated players yet.</p> : <p className="py-12 text-center text-sm text-slate-400">Leaderboard is temporarily unavailable.</p>}
      </Container>
    </div>
  );
}
