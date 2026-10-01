import { ArrowRight, Crosshair } from "lucide-react";
import Link from "next/link";

import { SkinImage } from "@/components/loadout/skin-image";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ProfileCosmeticSlot,
  ProfileLoadoutPreview,
} from "@/types/profile-dashboard";

type LoadoutPreviewProps = {
  loadout: ProfileLoadoutPreview;
  isOwner: boolean;
  displayName: string;
};

function LoadoutSlot({ slot }: { slot: ProfileCosmeticSlot }) {
  return (
    <article className="border-border bg-background/40 overflow-hidden rounded-xl border">
      {slot.image && slot.name ? (
        <SkinImage
          name={slot.skinName ?? slot.name}
          rarity={slot.rarity ?? "Unknown"}
          image={slot.image}
          size="sm"
          className="h-32 rounded-none sm:h-36"
          alt={slot.skinName ? `${slot.name} | ${slot.skinName}` : slot.name}
        />
      ) : (
        <div className="bg-secondary/40 h-24 sm:h-28" />
      )}
      <div className="space-y-0.5 p-3">
        <p className="text-muted-foreground text-[0.65rem] font-medium tracking-[0.14em] uppercase">
          {slot.label}
        </p>
        <p className="truncate font-semibold">{slot.name ?? "Not equipped"}</p>
        {slot.skinName ? (
          <p className="text-muted-foreground truncate text-sm">{slot.skinName}</p>
        ) : null}
      </div>
    </article>
  );
}

export function LoadoutPreview({ loadout, isOwner, displayName }: LoadoutPreviewProps) {
  const slots = [loadout.knife, loadout.ctGloves, loadout.tGloves];

  return (
    <section className="border-border bg-card rounded-xl border">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="border-border bg-secondary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border">
            <Crosshair className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-base font-semibold">
              {isOwner ? "Your Loadout" : `${displayName}'s Loadout`}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              These cosmetics will be applied on WallBang retake servers.
            </p>
          </div>
        </div>
        {isOwner ? (
          <Link
            href="/loadout"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Manage Loadout
            <ArrowRight data-icon="inline-end" />
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 sm:px-5 sm:pb-5 lg:grid-cols-3">
        {slots.map((slot) => (
          <LoadoutSlot key={slot.label} slot={slot} />
        ))}
      </div>
    </section>
  );
}
