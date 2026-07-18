"use client";

import type { AuthUser } from "@/types/auth";

type SteamAuthControlsProps = {
  user: AuthUser | null;
  enabled: boolean;
};

function SteamMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.304 1.265.789.354 1.81.323 2.545-.24.741-.567.948-1.509.55-2.24-.395-.728-1.277-.997-2.083-.786-.263.07-.505.196-.715.366l1.52.628c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012h-.003zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z" />
    </svg>
  );
}

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
}

export function SteamAuthControls({ user, enabled }: SteamAuthControlsProps) {
  if (!enabled) return null;

  if (user) {
    return (
      <div className="hidden items-center gap-2 sm:flex">
        <a
          href={user.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex max-w-[10rem] items-center gap-2 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Steam CDN avatars; domains vary
            <img
              src={user.avatarUrl}
              alt=""
              width={24}
              height={24}
              className="size-6 rounded-full"
            />
          ) : (
            <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-[0.65rem]">
              {user.personaName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate">{user.personaName}</span>
        </a>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-md px-2 py-1.5 text-[0.8rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <a
      href="/api/auth/steam"
      className="hidden items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[0.8rem] font-medium text-foreground transition-colors hover:bg-muted sm:inline-flex"
    >
      <SteamMark className="size-3.5" />
      Sign in with Steam
    </a>
  );
}

export function SteamAuthControlsMobile({
  user,
  enabled,
}: SteamAuthControlsProps) {
  if (!enabled) return null;

  if (user) {
    return (
      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
        <a
          href={user.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground hover:bg-secondary"
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-full"
            />
          ) : null}
          <span className="truncate font-medium">{user.personaName}</span>
        </a>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-md px-3 py-3 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <a
      href="/api/auth/steam"
      className="mt-4 flex items-center justify-center gap-2 rounded-md border border-border px-3 py-3 text-sm font-medium text-foreground hover:bg-secondary"
    >
      <SteamMark className="size-4" />
      Sign in with Steam
    </a>
  );
}
