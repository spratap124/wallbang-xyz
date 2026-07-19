"use client";

import { ChevronDown, LogOut, Settings, Shield, User } from "lucide-react";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { featureFlags } from "@/config/features.flags";
import type { AuthUser } from "@/types/auth";

type SteamAuthControlsProps = {
  user: AuthUser | null;
  enabled: boolean;
  showAdmin?: boolean;
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

function UserAvatar({
  user,
  size = 24,
}: {
  user: AuthUser;
  size?: number;
}) {
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Steam CDN avatars; domains vary
      <img
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        className="rounded-full"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="flex items-center justify-center rounded-full bg-secondary text-[0.65rem]"
      style={{ width: size, height: size }}
    >
      {user.personaName.slice(0, 1).toUpperCase()}
    </span>
  );
}

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
}

export function SteamAuthControls({
  user,
  enabled,
  showAdmin = false,
}: SteamAuthControlsProps) {
  if (!enabled) return null;

  if (user) {
    return (
      <div className="hidden sm:block">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex max-w-[12rem] items-center gap-2 rounded-md px-1.5 py-1 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-muted data-popup-open:text-foreground"
            aria-label="Account menu"
          >
            <UserAvatar user={user} />
            <span className="truncate">{user.personaName}</span>
            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 min-w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate font-normal">
                {user.personaName}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {featureFlags.playerProfiles ? (
              <DropdownMenuItem render={<Link href="/profile" />}>
                <User />
                Profile
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                render={
                  <a
                    href={user.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <User />
                Profile
              </DropdownMenuItem>
            )}
            {featureFlags.playerProfiles ? (
              <DropdownMenuItem render={<Link href="/settings" />}>
                <Settings />
                Settings
              </DropdownMenuItem>
            ) : null}
            {showAdmin ? (
              <DropdownMenuItem render={<Link href="/admin" />}>
                <Shield />
                Admin
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => void signOut()}
            >
              <LogOut />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
  showAdmin = false,
}: SteamAuthControlsProps) {
  if (!enabled) return null;

  if (user) {
    return (
      <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4">
        <div className="flex items-center gap-3 px-3 py-2">
          <UserAvatar user={user} size={32} />
          <span className="truncate text-sm font-medium">{user.personaName}</span>
        </div>
        {featureFlags.playerProfiles ? (
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-md px-3 py-3 text-sm text-foreground hover:bg-secondary"
          >
            <User className="size-4" />
            Profile
          </Link>
        ) : (
          <a
            href={user.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md px-3 py-3 text-sm text-foreground hover:bg-secondary"
          >
            <User className="size-4" />
            Profile
          </a>
        )}
        {featureFlags.playerProfiles ? (
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-md px-3 py-3 text-sm text-foreground hover:bg-secondary"
          >
            <Settings className="size-4" />
            Settings
          </Link>
        ) : null}
        {showAdmin ? (
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-md px-3 py-3 text-sm text-foreground hover:bg-secondary"
          >
            <Shield className="size-4" />
            Admin
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex items-center gap-2 rounded-md px-3 py-3 text-left text-sm text-destructive hover:bg-secondary"
        >
          <LogOut className="size-4" />
          Logout
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
