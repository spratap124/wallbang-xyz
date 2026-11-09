import type { Metadata } from "next";

import { Container } from "@/components/shared/primitives";
import { getPublicBanLedger } from "@/lib/moderation/service";
import { isMongoConfigured } from "@/lib/mongo";
import { createPageMetadata } from "@/seo/metadata";
import { redirect } from "next/navigation";
import { isBansPageEnabled } from "@/lib/platform/feature-flags";

export const metadata: Metadata = createPageMetadata({
  title: "Ban Ledger",
  description: "Public record of bans applied across WallBang community servers.",
  path: "/bans",
});

function duration(startsAt: string, expiresAt: string | null, permanent: boolean) {
  if (permanent) return "Permanent";
  if (!expiresAt) return "Timed";
  const minutes = Math.max(1, Math.round((Date.parse(expiresAt) - Date.parse(startsAt)) / 60000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr`;
  return `${Math.round(minutes / 1440)} days`;
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5">
      <p className="text-[0.65rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${accent ?? ""}`}>{value.toLocaleString()}</p>
    </div>
  );
}

export default async function BansPage() {
  if (!(await isBansPageEnabled())) redirect("/");
  const ledger = isMongoConfigured()
    ? await getPublicBanLedger().catch(() => null)
    : null;

  return (
    <div className="min-h-[70vh] py-12 sm:py-16">
      <Container>
        <header className="border-b border-border pb-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Network moderation</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Bans ledger</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            A public record of moderation bans applied across WallBang servers.
          </p>
        </header>

        {ledger ? (
          <>
            <section aria-label="Ban statistics" className="grid gap-3 py-5 sm:grid-cols-3">
              <Stat label="Active" value={ledger.active} accent="text-amber-400" />
              <Stat label="Total records" value={ledger.total} accent="text-primary" />
              <Stat label="Lifted or expired" value={ledger.liftedOrExpired} />
            </section>

            <section className="pt-7">
              <div className="mb-5">
                <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Public record</p>
                <h2 className="mt-2 text-xl font-semibold">All ban records</h2>
                <p className="mt-1 text-sm text-muted-foreground">Newest moderation records appear first.</p>
              </div>
              {ledger.records.length ? (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[850px] border-separate border-spacing-y-1.5 text-left text-sm">
                      <thead>
                        <tr className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                          {["Player", "Reason", "Admin", "Duration", "Status", "Server"].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.records.map((record, index) => (
                          <tr key={`${record.startsAt}-${index}`} className="bg-card/60 text-muted-foreground [&>td]:border-y [&>td]:border-border [&>td]:px-4 [&>td]:py-3.5 first:[&>td:first-child]:rounded-l-xl last:[&>td:last-child]:rounded-r-xl">
                            <td className="font-semibold text-foreground">
                              <a href={record.playerProfileUrl || undefined} target={record.playerProfileUrl ? "_blank" : undefined} rel="noreferrer" className="flex items-center gap-2.5 hover:text-primary">
                                {record.playerAvatarUrl ? <img src={record.playerAvatarUrl} alt="" className="size-8 rounded-full border border-border" /> : <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs">?</span>}
                                {record.player}
                              </a>
                            </td>
                            <td className="max-w-xs truncate">{record.reason}</td>
                            <td>{record.admin}</td>
                            <td className="whitespace-nowrap text-foreground">{duration(record.startsAt, record.expiresAt, record.permanent)}</td>
                            <td><span className="rounded-full border border-border px-2.5 py-1 text-[0.65rem] font-semibold tracking-wide uppercase">{record.status}</span></td>
                            <td className="text-right">{record.server}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {ledger.records.map((record, index) => (
                      <article key={`${record.startsAt}-${index}`} className="rounded-xl border border-border bg-card/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0"><a href={record.playerProfileUrl || undefined} target={record.playerProfileUrl ? "_blank" : undefined} rel="noreferrer" className="flex items-center gap-2 font-semibold hover:text-primary">{record.playerAvatarUrl ? <img src={record.playerAvatarUrl} alt="" className="size-8 rounded-full border border-border" /> : null}<span className="truncate">{record.player}</span></a><p className="mt-1 text-sm text-muted-foreground">{record.reason}</p></div>
                          <span className="shrink-0 rounded-full border border-border px-2 py-1 text-[0.65rem] font-semibold uppercase">{record.status}</span>
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                          <div><dt className="text-muted-foreground">Admin</dt><dd className="mt-1">{record.admin}</dd></div>
                          <div><dt className="text-muted-foreground">Duration</dt><dd className="mt-1">{duration(record.startsAt, record.expiresAt, record.permanent)}</dd></div>
                          <div className="col-span-2"><dt className="text-muted-foreground">Server</dt><dd className="mt-1">{record.server}</dd></div>
                        </dl>
                      </article>
                    ))}
                  </div>
                  {ledger.total > ledger.records.length ? <p className="mt-4 text-center text-xs text-muted-foreground">Showing the latest {ledger.records.length} of {ledger.total.toLocaleString()} records.</p> : null}
                </>
              ) : <div className="rounded-xl border border-border bg-card/50 px-5 py-12 text-center text-sm text-muted-foreground">There are no ban records yet.</div>}
            </section>
          </>
        ) : (
          <div className="mt-8 rounded-xl border border-border bg-card/50 px-5 py-12 text-center text-sm text-muted-foreground">
            The ban ledger is temporarily unavailable. Please check back soon.
          </div>
        )}
      </Container>
    </div>
  );
}
