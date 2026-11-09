import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { getRuntimeFeatureFlags } from "@/lib/platform/feature-flags";

const staticRoutes = [
  "/",
  "/servers",
  "/bans",
  "/leaderboard",
  "/features",
  "/pricing",
  "/offers",
  "/roadmap",
  "/faq",
  "/contact",
  "/about",
  "/services",
  "/business-information",
  "/shipping-and-delivery",
  "/vip",
  "/privacy",
  "/terms",
  "/refund",
  "/cancellation",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const flags = await getRuntimeFeatureFlags().catch(() => ({
    vipPage: false,
    loadoutPage: false,
    featuresPage: false,
    pricingPage: false,
    bansPage: false,
    leaderboardsPage: false,
  }));

  const pages = staticRoutes
    .filter((path) => {
      if (path === "/vip") return flags.vipPage;
      if (path === "/features") return flags.featuresPage;
      if (path === "/pricing") return flags.pricingPage;
      if (path === "/bans") return flags.bansPage;
      if (path === "/leaderboard") return flags.leaderboardsPage;
      return true;
    })
    .map((path) => ({
      url: `${siteConfig.url}${path === "/" ? "" : path}`,
      lastModified,
      changeFrequency: path === "/" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "/" ? 1 : 0.7,
    }));

  return pages;
}
