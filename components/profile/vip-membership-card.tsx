import { ArrowRight, Crown } from "lucide-react";
import Link from "next/link";

import { VipBadge } from "@/components/profile/vip-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProfileVipCard } from "@/types/profile-dashboard";

type VipMembershipCardProps = {
  vip: ProfileVipCard;
  isOwner: boolean;
};

export function VipMembershipCard({ vip, isOwner }: VipMembershipCardProps) {
  return (
    <section
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-xl border p-4 sm:p-5",
        vip.active
          ? "border-primary/35 bg-[radial-gradient(ellipse_at_top_left,rgba(232,36,42,0.22),transparent_58%),linear-gradient(180deg,#181116,#12151a)]"
          : "border-border bg-card",
      )}
    >
      <Crown
        className="text-primary/10 pointer-events-none absolute -right-3 -bottom-6 size-28 sm:size-32"
        aria-hidden
      />

      <div className="relative flex items-center gap-2">
        <Crown className="text-primary size-4" aria-hidden />
        <h2 className="font-heading text-sm font-semibold">VIP Membership</h2>
      </div>

      <div className="relative mt-4 space-y-2">
        {vip.active ? <VipBadge /> : null}
        <p
          className={cn(
            "flex items-center gap-2 text-sm font-medium",
            vip.active ? "text-emerald-400" : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              vip.active ? "bg-emerald-400" : "bg-muted-foreground",
            )}
            aria-hidden
          />
          {vip.active ? "Active" : "Inactive"}
        </p>

        {vip.lifetime ? (
          <p className="text-muted-foreground text-sm">Lifetime access</p>
        ) : vip.expiresOn ? (
          <p className="text-muted-foreground text-sm">
            Expires on{" "}
            <span className="text-foreground font-medium">{vip.expiresOn}</span>
            {vip.daysRemaining ? (
              <span className="text-muted-foreground"> · {vip.daysRemaining}</span>
            ) : null}
          </p>
        ) : vip.expiredOn ? (
          <p className="text-muted-foreground text-sm">
            Expired on{" "}
            <span className="text-foreground font-medium">{vip.expiredOn}</span>
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            {vip.active ? "VIP is active." : "No active VIP membership."}
          </p>
        )}

        {!vip.lifetime && vip.subline ? (
          <p className="text-muted-foreground text-xs">{vip.subline}</p>
        ) : null}
      </div>

      {isOwner ? (
        <div className="relative mt-auto pt-4">
          <Button
            variant="outline"
            size="sm"
            className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
            render={<Link href="/vip" />}
          >
            Manage VIP
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      ) : null}
    </section>
  );
}
