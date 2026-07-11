export const siteConfig = {
  name: "WallBang",
  shortName: "WallBang",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://wallbang.xyz",
  discordUrl:
    process.env.NEXT_PUBLIC_DISCORD_URL ?? "https://discord.gg/zE2Xvhgyq5",
  tagline: "The Next Generation Counter-Strike 2 Competitive Platform.",
  description:
    "WallBang is a long-term CS2 competitive platform starting with India-first retake servers — VIP, Steam login, statistics, leaderboards, and tournaments ahead.",
  keywords: [
    "WallBang",
    "wallbang.xyz",
    "CS2 Retake Server",
    "Counter Strike 2 Retakes",
    "CS2 India",
    "CS2 Competitive",
    "CS2 VIP",
    "CS2 Weapon Skins",
    "Counter Strike 2 Statistics",
    "Counter Strike 2 Leaderboards",
  ] as const,
  locale: "en_IN",
  regionFocus: "India",
  social: {
    discord: process.env.NEXT_PUBLIC_DISCORD_URL ?? "https://discord.gg/zE2Xvhgyq5",
  },
  supportingPoints: [
    "Low latency servers.",
    "Powerful player statistics.",
    "Competitive matchmaking.",
    "Community-driven development.",
    "Built for serious Counter-Strike 2 players.",
  ] as const,
} as const;

export type SiteConfig = typeof siteConfig;
