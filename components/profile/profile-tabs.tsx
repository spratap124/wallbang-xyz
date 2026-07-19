"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export const PROFILE_TABS = [
  { id: "overview", label: "Overview", comingSoon: false },
  { id: "stats", label: "Stats", comingSoon: true },
  { id: "matches", label: "Match History", comingSoon: true },
  { id: "achievements", label: "Achievements", comingSoon: true },
  { id: "servers", label: "Servers", comingSoon: true },
  { id: "friends", label: "Friends", comingSoon: true },
  { id: "activity", label: "Activity", comingSoon: true },
] as const;

export type ProfileTabId = (typeof PROFILE_TABS)[number]["id"];

type ProfileTabsProps = {
  steamId: string;
  isOwner: boolean;
  activeTab?: ProfileTabId;
  basePath?: string;
};

export function ProfileTabs({
  steamId,
  isOwner,
  activeTab = "overview",
  basePath,
}: ProfileTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current =
    (searchParams.get("tab") as ProfileTabId | null) ?? activeTab;
  const hrefBase = basePath ?? `/profile/${steamId}`;

  return (
    <nav
      className="-mx-1 flex gap-1 overflow-x-auto border-b border-border pb-px"
      aria-label="Profile sections"
    >
      {PROFILE_TABS.map((tab) => {
        const isActive = current === tab.id;
        const href =
          tab.id === "overview" ? hrefBase : `${hrefBase}?tab=${tab.id}`;

        return (
          <Link
            key={tab.id}
            href={tab.comingSoon ? hrefBase : href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-t-md px-3 py-2.5 text-sm whitespace-nowrap transition-colors",
              isActive
                ? "border-b-2 border-primary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
              tab.comingSoon && !isActive && "opacity-60",
            )}
            title={tab.comingSoon ? "Coming soon" : undefined}
            onClick={(e) => {
              if (tab.comingSoon) {
                e.preventDefault();
              }
            }}
            scroll={false}
          >
            {tab.label}
            {tab.comingSoon ? (
              <span className="ml-1.5 text-[0.65rem] text-muted-foreground">
                Soon
              </span>
            ) : null}
          </Link>
        );
      })}
      {isOwner ? (
        <Link
          href="/settings"
          className={cn(
            "ml-auto shrink-0 rounded-t-md px-3 py-2.5 text-sm whitespace-nowrap transition-colors",
            pathname.startsWith("/settings")
              ? "border-b-2 border-primary font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Settings
        </Link>
      ) : null}
    </nav>
  );
}
