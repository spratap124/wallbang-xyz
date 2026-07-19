"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

import { cn } from "@/lib/utils";
import { RARITY_COLORS } from "@/lib/loadout/constants";
import type { SkinRarity } from "@/types/loadout";

type SkinImageProps = {
  name: string;
  rarity: SkinRarity;
  image?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  alt?: string;
};

const SIZE_CLASS = {
  sm: "h-16",
  md: "h-28",
  lg: "h-40",
  xl: "h-56 sm:h-72",
};

export function SkinImage({
  name,
  rarity,
  image,
  className,
  size = "md",
  alt,
}: SkinImageProps) {
  const color = RARITY_COLORS[rarity];
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [image]);

  const showImage = Boolean(image) && !failed;

  return (
    <div
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden rounded-lg",
        SIZE_CLASS[size],
        className,
      )}
      style={{
        background: `radial-gradient(ellipse at 50% 35%, ${color}28 0%, transparent 55%), linear-gradient(160deg, #1a1f26 0%, #0b0d10 100%)`,
      }}
    >
      <div
        className="absolute inset-x-0 bottom-0 h-1"
        style={{ backgroundColor: color }}
      />

      {showImage ? (
        // Steam CDN economy images; domains vary by edge
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image!}
          alt={alt ?? name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={cn(
            "relative z-[1] max-h-[85%] max-w-[90%] object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]",
            size === "xl" && "max-h-[90%]",
          )}
        />
      ) : (
        <span
          className="relative z-[1] max-w-[90%] truncate px-2 text-center text-xs font-semibold tracking-wide uppercase"
          style={{ color }}
        >
          {name}
        </span>
      )}
    </div>
  );
}

type FavoriteButtonProps = {
  active: boolean;
  onToggle: () => void;
  className?: string;
};

export function FavoriteButton({
  active,
  onToggle,
  className,
}: FavoriteButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={active ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={active}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md transition-colors",
        active
          ? "text-primary hover:bg-primary/10"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      <Heart className={cn("size-4", active && "fill-current")} />
    </button>
  );
}
