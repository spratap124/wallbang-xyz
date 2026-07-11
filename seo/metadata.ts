import type { Metadata } from "next";

import { siteConfig } from "@/config/site";
import { seoKeywords } from "@/seo/keywords";

type CreateMetadataInput = {
  title: string;
  description: string;
  path?: string;
  keywords?: readonly string[];
  noIndex?: boolean;
  image?: string;
  type?: "website" | "article";
};

export function absoluteUrl(path = "/"): string {
  const base = siteConfig.url.replace(/\/$/, "");
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function createPageMetadata({
  title,
  description,
  path = "/",
  keywords = seoKeywords,
  noIndex = false,
  image,
  type = "website",
}: CreateMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const fullTitle = title === siteConfig.name ? title : `${title} | ${siteConfig.name}`;

  return {
    title: fullTitle,
    description,
    keywords: [...keywords],
    authors: [{ name: siteConfig.name }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    metadataBase: new URL(siteConfig.url),
    alternates: {
      canonical: url,
    },
    openGraph: {
      type,
      locale: siteConfig.locale,
      url,
      title: fullTitle,
      description,
      siteName: siteConfig.name,
      ...(image
        ? {
            images: [
              {
                url: image,
                width: 1200,
                height: 630,
                alt: `${siteConfig.name} — ${siteConfig.tagline}`,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      ...(image ? { images: [image] } : {}),
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
  };
}
