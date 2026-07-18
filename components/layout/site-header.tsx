"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import {
  SteamAuthControls,
  SteamAuthControlsMobile,
} from "@/components/auth/steam-auth-controls";
import { BrandMark, Logo } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { mainNav } from "@/config/navigation";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/types/auth";

type SiteHeaderProps = {
  user: AuthUser | null;
  steamAuthEnabled: boolean;
};

export function SiteHeader({ user, steamAuthEnabled }: SiteHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 overflow-visible border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="container-wb flex h-16 items-center justify-between gap-4 overflow-visible">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {mainNav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  active && "text-foreground",
                )}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <SteamAuthControls user={user} enabled={steamAuthEnabled} />

          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(100%,20rem)]">
              <SheetHeader>
                <SheetTitle className="text-left">
                  <BrandMark className="text-lg" />
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile">
                {mainNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-3 py-3 text-sm text-foreground hover:bg-secondary"
                  >
                    {item.title}
                  </Link>
                ))}
                <SteamAuthControlsMobile
                  user={user}
                  enabled={steamAuthEnabled}
                />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
