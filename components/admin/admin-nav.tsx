"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Permissions", match: (path: string) => path === "/admin" },
  {
    href: "/admin/servers",
    label: "Servers",
    match: (path: string) => path.startsWith("/admin/servers"),
  },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="mb-8 flex flex-wrap gap-1 border-b border-border pb-px"
    >
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
