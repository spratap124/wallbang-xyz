import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { getAllPosts } from "@/lib/content/blog";

const staticRoutes = [
  "/",
  "/servers",
  "/features",
  "/roadmap",
  "/faq",
  "/blog",
  "/changelog",
  "/contact",
  "/privacy",
  "/terms",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const pages = staticRoutes.map((path) => ({
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
