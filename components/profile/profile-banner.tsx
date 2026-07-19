import { cn } from "@/lib/utils";

type ProfileBannerProps = {
  bannerUrl?: string | null;
  className?: string;
};

export function ProfileBanner({ bannerUrl, className }: ProfileBannerProps) {
  return (
    <div
      className={cn(
        "relative h-36 w-full overflow-hidden sm:h-44 md:h-52",
        className,
      )}
    >
      {bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- user/CDN banners
        <img
          src={bannerUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(232,36,42,0.35),transparent_55%),radial-gradient(ellipse_at_80%_100%,rgba(42,49,60,0.9),transparent_50%),linear-gradient(135deg,#0b0d10_0%,#1a1f26_45%,#12151a_100%)]"
          aria-hidden
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-3 px-4 sm:px-6">
        <p className="font-mono text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase">
          WallBang Banner
        </p>
      </div>
    </div>
  );
}
