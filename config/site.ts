export const siteConfig = {
  name: "WallBang",
  shortName: "WallBang",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://wallbang.xyz",
  discordUrl:
    process.env.NEXT_PUBLIC_DISCORD_URL ?? "https://discord.gg/KY2dRw8Yh4",
  tagline: "Privately managed Counter-Strike 2 community and retake servers.",
  heroSubtitle: "CS2 Community Servers",
  description:
    "WallBang operates privately managed CS2 community and retake servers. Optional fixed-duration VIP membership provides priority/reserved server access and additional server/community privileges.",
  businessCategory: "CS2 community and retake server membership",
  legal: {
    tradeName: "WallBang",
    legalName: "Shivani",
    gst: "GST not applicable",
    email: "admin@wallbang.xyz",
    address:
      "109/364, Ram Krishna Nagar, R K Nagar, Kanpur Nagar, Uttar Pradesh, 208012, India",
  },
  keywords: [
    "WallBang",
    "wallbang.xyz",
    "CS2 Retake Server",
    "CS2 Community Servers",
    "Counter Strike 2 Retakes",
    "CS2 India",
    "CS2 VIP membership",
    "Counter Strike 2 community",
  ] as const,
  locale: "en_IN",
  regionFocus: "India",
  social: {
    discord: process.env.NEXT_PUBLIC_DISCORD_URL ?? "https://discord.gg/KY2dRw8Yh4",
  },
  supportingPoints: [
    "Low latency community and retake servers.",
    "Optional fixed-duration VIP membership.",
    "Priority and reserved server access for VIP.",
    "Community-driven development.",
    "Built for Counter-Strike 2 community players.",
  ] as const,
} as const;

export type SiteConfig = typeof siteConfig;
