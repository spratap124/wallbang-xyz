"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Plus,
  Server,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SteamAuthControls } from "@/components/auth/steam-auth-controls";
import { mainNav } from "@/config/navigation";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/types/auth";
import type { PermissionCode, RoleCode } from "@/types/permissions";

const ROLE_LABELS: Record<RoleCode, string> = {
  USER: "User",
  FOUNDING_MEMBER: "Founding Member",
  VIP: "VIP",
  MODERATOR: "Moderator",
  ADMIN: "Admin",
  OWNER: "Owner",
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (path: string) => boolean;
  /** If set, nav item is shown only when the user has this permission. */
  permission?: PermissionCode;
};

const NAV: NavItem[] = [
  {
    href: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    match: (path) => path === "/admin",
  },
  {
    href: "/admin/servers",
    label: "Servers",
    icon: Server,
    match: (path) => path.startsWith("/admin/servers"),
  },
  {
    href: "/admin/players",
    label: "Players",
    icon: Users,
    match: (path) => path.startsWith("/admin/players"),
    permission: "manage_users",
  },
  {
    href: "/admin/sessions",
    label: "Sessions",
    icon: Activity,
    match: (path) => path.startsWith("/admin/sessions"),
  },
  {
    href: "/admin/permissions",
    label: "Permissions",
    icon: Shield,
    match: (path) => path.startsWith("/admin/permissions"),
    permission: "manage_users",
  },
  {
    href: "/admin/audit",
    label: "Audit Log",
    icon: ClipboardList,
    match: (path) => path.startsWith("/admin/audit"),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    match: (path) => path.startsWith("/admin/settings"),
  },
];

function pageMeta(pathname: string): { title: string; subtitle: string } {
  if (pathname.startsWith("/admin/servers")) {
    return { title: "Servers", subtitle: "Fleet registry" };
  }
  if (pathname.startsWith("/admin/players")) {
    return { title: "Players", subtitle: "Directory" };
  }
  if (pathname.startsWith("/admin/sessions")) {
    return { title: "Sessions", subtitle: "Connections" };
  }
  if (pathname.startsWith("/admin/permissions")) {
    return { title: "Permissions", subtitle: "Roles & access" };
  }
  if (pathname.startsWith("/admin/audit")) {
    return { title: "Audit Log", subtitle: "Change history" };
  }
  if (pathname.startsWith("/admin/settings")) {
    return { title: "Settings", subtitle: "Panel config" };
  }
  return { title: "Overview", subtitle: "Dashboard" };
}

type AdminShellProps = {
  user: AuthUser;
  displayRole: RoleCode;
  permissions: PermissionCode[];
  children: React.ReactNode;
  healthLabel?: string;
  healthOk?: boolean;
  steamAuthEnabled?: boolean;
};

export function AdminShell({
  user,
  displayRole,
  permissions,
  children,
  healthLabel = "Checking systems…",
  healthOk = true,
  steamAuthEnabled = true,
}: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const meta = pageMeta(pathname);
  const canManageServers = permissions.includes("manage_servers");

  const visibleNav = NAV.filter(
    (item) => !item.permission || permissions.includes(item.permission),
  );

  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <nav aria-label="Admin" className="flex flex-1 flex-col gap-1 px-3">
        <p className="mb-2 px-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Admin
        </p>
        {visibleNav.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <span
                className={cn(
                  "h-5 w-0.5 rounded-full",
                  active ? "bg-primary" : "bg-transparent",
                )}
                aria-hidden
              />
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  function UserChip() {
    return (
      <div className="flex items-center gap-3 border-t border-sidebar-border px-4 py-4">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            width={36}
            height={36}
            className="size-9 rounded-full"
          />
        ) : (
          <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs">
            {user.personaName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.personaName}</p>
          <span className="mt-0.5 inline-flex rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase">
            {ROLE_LABELS[displayRole] ?? displayRole}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            W
          </span>
          <Link href="/admin" className="text-base font-semibold tracking-tight">
            WallBang
          </Link>
        </div>
        <NavLinks />
        <UserChip />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col bg-sidebar shadow-xl">
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                  W
                </span>
                <span className="text-base font-semibold">WallBang</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-sidebar-border px-3 py-3">
              <p className="mb-2 px-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                Site
              </p>
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                Home
              </Link>
              {mainNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  {item.title}
                </Link>
              ))}
            </div>
            <UserChip />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4" />
            <span className="sr-only">Open menu</span>
          </Button>

          <div className="min-w-0 shrink-0">
            <p className="truncate text-sm font-semibold">{meta.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {meta.subtitle}
            </p>
          </div>

          <nav
            aria-label="Site"
            className="ml-2 hidden min-w-0 flex-1 items-center gap-0.5 lg:flex"
          >
            <Link
              href="/"
              className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Home
            </Link>
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.title}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span
              className={cn(
                "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs xl:inline-flex",
                healthOk
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  healthOk ? "bg-emerald-400" : "bg-amber-400",
                )}
              />
              {healthLabel}
            </span>

            {canManageServers ? (
              <Button
                render={<Link href="/admin/servers?new=1" />}
                size="sm"
                className="hidden sm:inline-flex"
              >
                <Plus className="size-3.5" data-icon="inline-start" />
                Add Server
              </Button>
            ) : null}

            <SteamAuthControls
              user={user}
              enabled={steamAuthEnabled}
              showAdmin
            />
          </div>
        </header>

        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
