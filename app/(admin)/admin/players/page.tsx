import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPlayersPanel } from "@/components/admin/admin-players-panel";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/service";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Players",
  description: "Search WallBang players and jump into role management.",
  path: "/admin/players",
  noIndex: true,
});

export default async function AdminPlayersPage() {
  const user = await getSession();
  if (!user) redirect("/");
  const allowed = await hasPermission({
    userId: user.id,
    permission: "manage_users",
  });
  if (!allowed) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Players
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Find players by SteamID or persona name, then manage roles.
        </p>
      </div>
      <AdminPlayersPanel />
    </div>
  );
}
