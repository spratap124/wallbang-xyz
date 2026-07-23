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
      "Create your WallBang account using Steam. This securely links your player identity and enables stats, loadouts, and rewards.",
    successLabel: "Steam account connected",
  },
  {
    step: 2,
    title: "Join the WallBang Discord",
    description:
      "Join our Discord community to receive announcements, server updates, tournaments, support, and to verify your eligibility for the Launch VIP reward.",
    successLabel: "Discord membership verified",
  },
] as const;
