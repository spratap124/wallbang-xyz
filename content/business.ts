import type { FaqItem } from "@/types/content";

/** Customer-facing name of the paid product. */
export const hostedAccessProduct = "Hosted Server Access";

export const valveDisclaimer =
  "Counter-Strike 2 is a trademark of Valve Corporation. WallBang is an independent community server operator and is not affiliated with, endorsed by, or sponsored by Valve Corporation.";

export const businessSummary =
  "WallBang is an independent game-server hosting and community platform focused on providing reliable, low-latency Counter-Strike 2 community servers in India.";

export const serviceDescription =
  "WallBang operates independently managed Counter-Strike 2 community servers hosted in India. Customers pay for fixed-duration access to this hosted game-server infrastructure and related server/community privileges.";

export const notAGameStore =
  "WallBang operates the server infrastructure. We do not sell or distribute Counter-Strike 2, game licenses, or in-game items.";

export const whatYouPayFor =
  "WallBang provides access to independently operated game-server infrastructure, including server capacity, administration, maintenance, and reserved access for the selected membership period.";

export const notSoldItems = [
  "Counter-Strike 2",
  "Game licenses or keys",
  "Steam accounts",
  "Skins, weapons, or in-game items",
  "In-game currency",
  "Gambling, betting, or tournament entry",
] as const;

export const wallbangProvides = [
  {
    id: "india-hosted",
    title: "India-hosted game server infrastructure",
    description:
      "WallBang runs Counter-Strike 2 community servers on infrastructure hosted in India for lower ping and more consistent play.",
    icon: "Server",
  },
  {
    id: "community-servers",
    title: "Dedicated community servers",
    description:
      "Independently operated community and retake servers — not Valve official matchmaking, and not a game store.",
    icon: "Users",
  },
  {
    id: "admin-maintenance",
    title: "Server administration and maintenance",
    description:
      "WallBang handles deployment, configuration, updates, and day-to-day server operations.",
    icon: "Wrench",
  },
  {
    id: "reserved-access",
    title: "Reserved server access",
    description:
      "Paid access includes a reserved slot and related community privileges on the servers you select.",
    icon: "Lock",
  },
  {
    id: "fixed-duration",
    title: "Fixed-duration server access",
    description:
      "You pay once for 1 month, 3 months, 6 months, or 1 year. Access ends when that term ends — no auto-renewal.",
    icon: "Timer",
  },
  {
    id: "low-latency",
    title: "Low-latency Indian server infrastructure",
    description:
      "India-first hosting so players in the region get responsive community retake sessions.",
    icon: "Zap",
  },
] as const;

export function hostedAccessPlanLabel(durationName: string): string {
  return `${durationName} — ${hostedAccessProduct}`;
}

export function hostedAccessDaysLabel(durationDays: number): string {
  return `${hostedAccessProduct} — ${durationDays} Days`;
}

export function hostedAccessPlanBlurb(durationDays: number): string {
  return `Access to the selected WallBang community server for ${durationDays} days, including the server features and privileges described below.`;
}

export const checkoutProductName = "WallBang Hosted Server Access";

export function checkoutProductDescription(input: {
  durationDays: number;
  accessType: "ALL_RETAKES" | "INDIVIDUAL_SERVER";
}): string {
  const scope =
    input.accessType === "ALL_RETAKES"
      ? "all WallBang CS2 community servers"
      : "selected WallBang CS2 community server";
  return `${hostedAccessDaysLabel(input.durationDays)} (${scope})`;
}

export const businessModelFaqs: FaqItem[] = [
  {
    id: "what-is-wallbang",
    question: "What is WallBang?",
    answer:
      "WallBang operates independently managed Counter-Strike 2 community servers hosted in India. We provide server infrastructure and access to these hosted servers.",
  },
  {
    id: "own-cs2",
    question: "Do I need to own Counter-Strike 2?",
    answer:
      "Yes. WallBang does not sell or distribute Counter-Strike 2. Players must obtain and own the game separately through the official game platform.",
  },
  {
    id: "what-am-i-paying-for",
    question: "What am I paying for?",
    answer:
      "You are paying for access to WallBang's independently operated hosted server infrastructure and the server/community privileges included with your selected access period.",
  },
  {
    id: "sell-skins",
    question: "Does WallBang sell game skins or items?",
    answer:
      "No. WallBang does not sell, distribute, or trade Counter-Strike 2 skins, weapons, currency, or other in-game items.",
  },
  {
    id: "affiliated-valve",
    question: "Is WallBang affiliated with Valve?",
    answer:
      "No. WallBang is an independent community server operator and is not affiliated with Valve.",
  },
];
