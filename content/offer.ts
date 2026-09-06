export const launchOfferIncludes = [
  "3 months of VIP",
  "Priority access to all VIP server features",
  "Reserved for the first 100 eligible players",
] as const;

export const launchOfferRewardBenefits = [
  "VIP access for 3 months",
  "Automatic activation",
  "No payment required",
] as const;

export const launchOfferSteps = [
  {
    step: 1,
    title: "Sign in with Steam",
    description:
      "Create your WallBang account using Steam. This links your player identity for VIP and server access.",
    successLabel: "Steam account connected",
  },
  {
    step: 2,
    title: "Join the WallBang Discord",
    description:
      "Join our Discord community to receive announcements, server updates, support, and to verify your eligibility for Launch VIP.",
    successLabel: "Discord membership verified",
  },
] as const;

/** Copy when Discord is not required for the launch VIP claim. */
export function launchOfferSteamOnlyBlurb(vipMonths: number): string {
  return `Sign in with Steam below to unlock ${vipMonths} months of Launch VIP. Spots are limited — claim yours while they last.`;
}

