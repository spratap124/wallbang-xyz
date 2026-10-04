import { redirect } from "next/navigation";

import { VipPageBody } from "@/components/vip/vip-page-body";
import { Container } from "@/components/shared/primitives";
import { JsonLd } from "@/components/shared/json-ld";
import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/mongo";
import { getUserVipMembership } from "@/lib/payments/entitlements";
import {
  isPricingPageEnabled,
  isVipPageEnabled,
} from "@/lib/platform/feature-flags";
import { getGameServers } from "@/lib/servers/registry";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "VIP",
  description:
    "Get reserved access to WallBang Retake servers with a reserved slot, custom chat color, and priority queue.",
  path: "/vip",
});

type VipPageProps = {
  searchParams: Promise<{
    paid?: string;
    error?: string;
    txnid?: string;
  }>;
};

export default async function VipPage({ searchParams }: VipPageProps) {
  const params = await searchParams;
  if (params.paid) {
    const qs = new URLSearchParams();
    qs.set("paid", params.paid);
    if (params.error) qs.set("error", params.error);
    if (params.txnid) qs.set("txnid", params.txnid);
    redirect(`/vip/payment?${qs.toString()}`);
  }

  const [vipEnabled, pricingEnabled] = await Promise.all([
    isVipPageEnabled(),
    isPricingPageEnabled(),
  ]);
  if (!vipEnabled) {
    redirect("/");
  }

  const session = await getSession();
  const servers = await getGameServers();

  let membership = null;
  let lifetime = false;

  if (session && isMongoConfigured()) {
    membership = await getUserVipMembership({
      userId: session.id,
      eligibleServers: servers.map((server) => ({
        id: server.id,
        shortName: server.shortName || server.name,
        name: server.name,
      })),
    });
    lifetime = membership.lifetime;
  }

  return (
    <div>
      <JsonLd
        id="ld-vip-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "VIP", path: "/vip" },
        ])}
      />
      <Container className="max-w-5xl py-8 sm:py-10">
        <VipPageBody
          user={
            session
              ? {
                  personaName: session.personaName,
                  avatarUrl: session.avatarUrl,
                }
              : null
          }
          hideBuy={lifetime}
          showPricing={pricingEnabled}
          membership={membership}
        />
      </Container>
    </div>
  );
}
