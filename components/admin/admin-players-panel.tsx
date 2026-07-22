"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const load = useCallback((q?: string) => {
    setError(null);
    startTransition(async () => {
      const params = new URLSearchParams();
      const trimmed = q?.trim() ?? "";
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.set("limit", "500");
      }
      const res = await fetch(`/api/v1/users?${params}`);
      const payload = await readJson<SearchUser[]>(res);
      setLoaded(true);
      if (!payload.ok) {
        setError(payload.error);
        setResults([]);
        return;
      }
      setResults(payload.data);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function search() {
    load(query);
  }

  function clearSearch() {
    setQuery("");
    load();
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

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {pending && !loaded
          ? "Loading players…"
          : `${results.length} player${results.length === 1 ? "" : "s"}`}
      </p>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Player</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {results.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
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
                  <td className="px-4 py-3">
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
                        <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs">
                          {user.personaName.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {user.personaName}
                        </p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {user.steamId}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.role}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
