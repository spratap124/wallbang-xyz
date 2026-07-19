"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const SETTINGS_LINKS = [
  { href: "/settings", label: "Preferences", exact: true },
  { href: "/settings/privacy", label: "Privacy", exact: false },
  { href: "/settings/linked-accounts", label: "Linked Accounts", exact: false },
] as const;

type SettingsSidebarProps = {
  className?: string;
};

export function SettingsSidebar({ className }: SettingsSidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn("flex flex-row gap-1 overflow-x-auto md:flex-col", className)}
      aria-label="Settings"
    >
      {SETTINGS_LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
