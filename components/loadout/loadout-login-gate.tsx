import Link from "next/link";

import { Button } from "@/components/ui/button";

function SteamMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      data-icon="inline-start"
    >
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.304 1.265.789.354 1.81.323 2.545-.24.741-.567.948-1.509.55-2.24-.395-.728-1.277-.997-2.083-.786-.263.07-.505.196-.715.366l1.52.628c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012h-.003zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z" />
    </svg>
  );
}

type LoadoutLoginGateProps = {
  steamAvailable: boolean;
};

export function LoadoutLoginGate({ steamAvailable }: LoadoutLoginGateProps) {
  return (
    <div className="mx-auto flex min-h-[70svh] w-full max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl bg-card p-8 ring-1 ring-foreground/10 sm:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at 20% 0%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 55%), radial-gradient(ellipse at 90% 100%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 45%)",
          }}
        />

        <div className="relative space-y-5">
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
            Loadout
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Steam login required
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Sign in with Steam to build your personal CS2 loadout and sync
            skins, knives, gloves, and agents with WallBang game servers when
            you join.
          </p>

          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Equip weapon skins, knives, gloves, and agents
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Save loadouts tied to your Steam account
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Apply instantly when you connect to a WallBang server
            </li>
          </ul>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
            {steamAvailable ? (
              <Button
                size="lg"
                render={
                  <a href="/api/auth/steam?returnTo=/loadout" />
                }
              >
                <SteamMark className="size-4" />
                Sign in with Steam
              </Button>
            ) : (
              <Button size="lg" disabled>
                Steam login unavailable
              </Button>
            )}
            <Button variant="ghost" size="lg" render={<Link href="/" />}>
              Back to home
            </Button>
          </div>

          {!steamAvailable ? (
            <p className="text-xs text-muted-foreground">
              Steam sign-in is temporarily unavailable. Try again later.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
