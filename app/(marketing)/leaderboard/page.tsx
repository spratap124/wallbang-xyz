import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/shared/primitives";
import { getGlobalLeaderboard } from "@/lib/rating/leaderboard";
import { isMongoConfigured } from "@/lib/mongo";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Global Rating Leaderboard",
  description: "Top WallBang CS2 players ranked by global rating.",
  path: "/leaderboard",
});

export default async function LeaderboardPage() {
  const players = isMongoConfigured() ? await getGlobalLeaderboard().catch(() => null) : null;
  return <div className="min-h-[70vh] py-12 sm:py-16"><Container>
    <header className="border-b border-border pb-6">
      <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">WallBang Rating</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Global leaderboard</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">Players ranked by rating. Ties are ordered by SteamID.</p>
    </header>
    {players ? players.length ? <>
      <div className="mt-7 hidden overflow-x-auto md:block"><table className="w-full min-w-[620px] border-separate border-spacing-y-1.5 text-left text-sm">
        <thead><tr className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase"><th className="px-4 py-3">#</th><th className="px-4 py-3">Player</th><th className="px-4 py-3 text-right">Rating</th></tr></thead>
        <tbody>{players.map((player, i) => <tr key={player.steamId} className="bg-card/60 [&>td]:border-y [&>td]:border-border [&>td]:px-4 [&>td]:py-3.5 first:[&>td:first-child]:rounded-l-xl last:[&>td:last-child]:rounded-r-xl">
          <td className="w-16 font-semibold tabular-nums text-muted-foreground">{i + 1}</td><td><Link href={`/profile/${player.steamId}`} className="flex items-center gap-3 font-semibold hover:text-primary">{player.avatar ? <img src={player.avatar} alt="" className="size-9 rounded-full border border-border" /> : <span className="size-9 rounded-full bg-muted" />}{player.name}</Link></td><td className="text-right font-semibold tabular-nums">{player.rating.toLocaleString()}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="mt-6 space-y-3 md:hidden">{players.map((player, i) => <Link key={player.steamId} href={`/profile/${player.steamId}`} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-4">
        <span className="w-8 text-sm font-semibold tabular-nums text-muted-foreground">{i + 1}</span>{player.avatar ? <img src={player.avatar} alt="" className="size-9 rounded-full border border-border" /> : <span className="size-9 rounded-full bg-muted" />}<span className="min-w-0 flex-1 truncate font-semibold">{player.name}</span><span className="text-sm font-semibold tabular-nums">{player.rating.toLocaleString()}</span>
      </Link>)}</div>
    </> : <p className="py-12 text-sm text-muted-foreground">No rated players yet.</p> : <p className="py-12 text-sm text-muted-foreground">Leaderboard is temporarily unavailable.</p>}
  </Container></div>;
}
