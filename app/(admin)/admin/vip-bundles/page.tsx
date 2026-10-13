import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VipBundlesPanel } from "@/components/admin/vip-bundles-panel";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/service";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "VIP Bundles",
  description: "Create and price custom server bundles for WallBang VIP.",
  path: "/admin/vip-bundles",
  noIndex: true,
});

export default async function AdminVipBundlesPage() {
  const user = await getSession();
  if (!user) redirect("/");
  const allowed = await hasPermission({
    userId: user.id,
    permission: "manage_servers",
  });
  if (!allowed) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          VIP Bundles
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Sell a named set of servers at one price per duration. Purchases grant
          VIP on exactly the servers in the bundle, for the term chosen at
          checkout. Individual server pricing and All Retakes are unaffected.
        </p>
      </div>
      <VipBundlesPanel />
    </div>
  );
}
