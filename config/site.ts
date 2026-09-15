export const siteConfig = {
  name: "WallBang",
  shortName: "WallBang",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://wallbang.xyz",
  discordUrl:
    process.env.NEXT_PUBLIC_DISCORD_URL ?? "https://discord.gg/KY2dRw8Yh4",
  tagline:
    "India-hosted game server infrastructure for Counter-Strike 2 community servers.",
  heroSubtitle: "India-Hosted Game Server Infrastructure",
  description:
    "WallBang operates independently managed Counter-Strike 2 community servers hosted in India. Pay for fixed-duration hosted server access — not the game, licenses, or in-game items.",
  businessCategory: "Game-server hosting / community server access",
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
    "CS2 community servers",
    "Counter-Strike 2 server hosting India",
    "CS2 Retake Server",
    "India CS2 servers",
    "hosted game server access",
    "Counter Strike 2 community",
  ] as const,
  locale: "en_IN",
  regionFocus: "India",
  social: {
    discord: process.env.NEXT_PUBLIC_DISCORD_URL ?? "https://discord.gg/KY2dRw8Yh4",
  },
  supportingPoints: [
    "India-hosted Counter-Strike 2 community server infrastructure.",
    "Optional fixed-duration hosted server access.",
    "Reserved slots and server/community privileges for the paid term.",
    "Independent operator — not affiliated with Valve.",
    "We do not sell the game, licenses, or in-game items.",
  ] as const,
} as const;

export type SiteConfig = typeof siteConfig;
