import Link from "next/link";

import { Logo } from "@/components/shared/primitives";
import { footerNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="container-wb grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {siteConfig.tagline} India-first CS2 retakes. Built for serious players.
          </p>
        </div>

        {footerNav.map((group) => (
          <div key={group.title}>
            <p className="text-sm font-medium text-foreground">{group.title}</p>
            <ul className="mt-4 space-y-2">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="container-wb flex flex-col gap-2 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {siteConfig.name}. Not affiliated with Valve.</p>
          <a
            href={siteConfig.discordUrl}
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            Discord
          </a>
        </div>
      </div>
    </footer>
  );
}
