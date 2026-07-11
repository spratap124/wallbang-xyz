import type { Metadata, Viewport } from "next";

import { JsonLd } from "@/components/shared/json-ld";
import { siteConfig } from "@/config/site";
import { fontMono, fontSans } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { organizationJsonLd, websiteJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

import "./globals.css";

export const metadata: Metadata = {
  ...createPageMetadata({
    title: siteConfig.name,
    description: siteConfig.description,
    path: "/",
  }),
  applicationName: siteConfig.name,
  category: "game",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  verification: {
    google: "Wnvozkpb8bWT8G486m8Kxi9GcTETfnMypygBeTyZxpo",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0D10",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("dark", fontSans.variable, fontMono.variable)}
      suppressHydrationWarning
    >
      <body className={cn(fontSans.className, "min-h-svh antialiased")}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <JsonLd id="ld-organization" data={organizationJsonLd()} />
        <JsonLd id="ld-website" data={websiteJsonLd()} />
        {children}
      </body>
    </html>
  );
}
