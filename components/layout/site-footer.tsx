import type { ReactNode } from "react";
import Link from "next/link";

import { Logo } from "@/components/shared/primitives";
import { filterFooterNav, footerNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";

type SiteFooterProps = {
  showVip?: boolean;
  showLoadout?: boolean;
  showFeatures?: boolean;
};

function FooterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-2 text-sm leading-relaxed text-foreground/80">
        {children}
      </div>
    </div>
  );
}

export function SiteFooter({
  showVip = false,
  showLoadout = false,
  showFeatures = false,
}: SiteFooterProps) {
  const nav = filterFooterNav(footerNav, {
    vipPage: showVip,
    loadoutPage: showLoadout,
    featuresPage: showFeatures,
  });

  return (
    <footer className="border-t border-border bg-card/40">
      <div className="container-wb grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {siteConfig.tagline}
          </p>
        </div>

        {nav.map((group) => (
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
        <div className="container-wb grid gap-8 py-8 sm:grid-cols-2 lg:grid-cols-4">
          <FooterField label="Legal name">
            <p>{siteConfig.legal.legalName}</p>
            <p className="mt-1 text-muted-foreground">
              Trade name {siteConfig.legal.tradeName}
            </p>
          </FooterField>
          <FooterField label="Registered address">
            <p className="max-w-xs">{siteConfig.legal.address}</p>
          </FooterField>
          <FooterField label="GST">
            <p>{siteConfig.legal.gst}</p>
          </FooterField>
          <FooterField label="Contact">
            <a
              href={`mailto:${siteConfig.legal.email}`}
              className="transition-colors hover:text-foreground"
            >
              {siteConfig.legal.email}
            </a>
          </FooterField>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-wb flex flex-col gap-2 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.legal.tradeName}. Not
            affiliated with Valve.
          </p>
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
