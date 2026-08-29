import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { getAllPosts } from "@/lib/content/blog";
import { isVipPageEnabled } from "@/lib/platform/feature-flags";

const staticRoutes = [
  "/",
  "/servers",
  "/features",
  "/offers",
  "/roadmap",
  "/faq",
  "/blog",
  "/changelog",
  "/contact",
  "/about",
  "/business-information",
  "/shipping-and-delivery",
  "/vip",
  "/privacy",
  "/terms",
  "/refund",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const vipPageEnabled = await isVipPageEnabled();

  const pages = staticRoutes
    .filter((path) => vipPageEnabled || path !== "/vip")
    .map((path) => ({
      url: `${siteConfig.url}${path === "/" ? "" : path}`,
      lastModified,
      changeFrequency: path === "/" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "/" ? 1 : 0.7,
    }));

  const posts = getAllPosts().map((post) => ({
    url: `${siteConfig.url}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt ?? post.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...pages, ...posts];
}
