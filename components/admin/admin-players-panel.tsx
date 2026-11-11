"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/admin/format";
import type { ApiResult } from "@/lib/api/waitlist";
import type { RoleCode } from "@/types/permissions";

type SearchUser = {
  id: string;
  steamId: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
  role: RoleCode;
  lastLoginAt: string;
  createdAt: string;
  vipSource?: string | null;
};
type PlayersPage = {
  items: SearchUser[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  total?: number;
  vipGiveawayTotal?: number;
  vipPurchaseTotal?: number;
};

async function readJson<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

export function AdminPlayersPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [vipSourceFilter, setVipSourceFilter] = useState("");
  const [totals, setTotals] = useState<Pick<PlayersPage, "total" | "vipGiveawayTotal" | "vipPurchaseTotal">>({});

  const load = useCallback((q: string, nextPage: number, role: string, vipSource: string) => {
    setError(null);
    startTransition(async () => {
      const params = new URLSearchParams();
      const trimmed = q.trim();
      if (trimmed) params.set("q", trimmed);
      if (role && !vipSource) params.set("role", role);
      if (vipSource) params.set("vipSource", vipSource);
      params.set("page", String(nextPage));
      params.set("pageSize", "25");
      const res = await fetch(`/api/v1/users?${params}`);
      const payload = await readJson<PlayersPage>(res);
      setLoaded(true);
      if (!payload.ok) {
        setError(payload.error);
        setResults([]);
        return;
      }
      setResults(payload.data.items);
      setHasMore(payload.data.hasMore);
      if (!trimmed) {
        setTotals({
          total: payload.data.total,
          vipGiveawayTotal: payload.data.vipGiveawayTotal,
          vipPurchaseTotal: payload.data.vipPurchaseTotal,
        });
      }
    });
  }, []);

  useEffect(() => {
    load(submittedQuery, page, roleFilter, vipSourceFilter);
  }, [load, page, submittedQuery, roleFilter, vipSourceFilter]);

  function search() {
    setSubmittedQuery(query.trim());
    setPage(1);
  }

  function clearSearch() {
    setQuery("");
    setSubmittedQuery("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex max-w-xl flex-wrap gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by SteamID or username"
          onKeyDown={(e) => {
            if (e.key === "Enter") search();
          }}
        />
        <Button type="button" onClick={search} disabled={pending}>
          Search
        </Button>
        {query.trim() ? (
          <Button
            type="button"
            variant="outline"
            onClick={clearSearch}
            disabled={pending}
          >
            Show all
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="border-input bg-background h-10 rounded-md border px-3 text-sm" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} aria-label="Filter by role">
          <option value="">All roles</option>
          <option value="USER">User</option>
          <option value="VIP">VIP</option>
          <option value="FOUNDING_MEMBER">Founding member</option>
          <option value="MODERATOR">Moderator</option>
          <option value="ADMIN">Admin</option>
          <option value="OWNER">Owner</option>
        </select>
        <select className="border-input bg-background h-10 rounded-md border px-3 text-sm" value={vipSourceFilter} onChange={(event) => { setVipSourceFilter(event.target.value); if (event.target.value) setRoleFilter("VIP"); setPage(1); }} aria-label="Filter VIP source">
          <option value="">All VIP sources</option>
          <option value="PURCHASE">Paid</option>
          <option value="GIVEAWAY">Giveaway</option>
          <option value="OTHER">Other / manual</option>
        </select>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span>{pending && !loaded ? "Loading players…" : `Page ${page} · ${results.length} player${results.length === 1 ? "" : "s"}`}</span>
        {!submittedQuery && (
          <>
            <span>Total players: <strong className="text-foreground">{totals.total ?? "—"}</strong></span>
            <span>VIP Giveaway: <strong className="text-foreground">{totals.vipGiveawayTotal ?? "—"}</strong></span>
            <span>VIP Purchase: <strong className="text-foreground">{totals.vipPurchaseTotal ?? "—"}</strong></span>
          </>
        )}
      </div>

      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-border bg-secondary/40 text-muted-foreground border-b text-xs">
            <tr>
              <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Player</th>
              <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Role</th>
              <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">VIP source</th>
              <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Last login</th>
              <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3" />
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {results.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground px-4 py-10 text-center">
                  {pending
                    ? "Loading…"
                    : query.trim()
                      ? "No players match that search."
                      : "No players in the system yet."}
                </td>
              </tr>
            ) : (
              results.map((user) => (
                <tr key={user.id} className="hover:bg-secondary/20">
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                    <div className="flex items-center gap-3">
                      {user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.avatarUrl}
                          alt=""
                          width={32}
                          height={32}
                          className="size-8 rounded-full"
                        />
                      ) : (
                        <span className="bg-secondary flex size-8 items-center justify-center rounded-full text-xs">
                          {user.personaName.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`/profile/${user.steamId}`}
                          title="View WallBang profile"
                          className="hover:text-primary block truncate font-medium transition-colors"
                        >
                          {user.personaName}
                        </Link>
                        <Link
                          href={`/profile/${user.steamId}`}
                          title="View WallBang profile"
                          className="text-muted-foreground hover:text-foreground block truncate font-mono text-xs transition-colors hover:underline"
                        >
                          {user.steamId}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5 sm:px-4 sm:py-3">
                    {user.role}
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5 sm:px-4 sm:py-3">
                    {user.role !== "VIP" ? "—" : user.vipSource === "PURCHASE" ? "Paid" : user.vipSource === "GIVEAWAY" ? "Giveaway" : user.vipSource ? "Other / manual" : "Unknown"}
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5 text-xs sm:px-4 sm:py-3">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right sm:px-4 sm:py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        render={
                          <Link
                            href={`/profile/${encodeURIComponent(user.steamId)}`}
                          />
                        }
                      >
                        Public profile
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        render={
                          <Link
                            href={`/admin/permissions?steamId=${encodeURIComponent(user.steamId)}`}
                          />
                        }
                      >
                        Manage roles
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="outline" disabled={pending || page === 1} onClick={() => setPage((value) => value - 1)}>
          Previous
        </Button>
        <span className="text-muted-foreground text-xs">Page {page}</span>
        <Button type="button" size="sm" variant="outline" disabled={pending || !hasMore} onClick={() => setPage((value) => value + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
