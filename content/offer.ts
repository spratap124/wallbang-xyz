export const launchOfferPerks = [
  {
    title: "Reserved server slot",
    description: "Join full retake servers when regular slots are taken.",
  },
  {
    title: "VIP chat tag",
    description: "Stand out in CS2 chat with a VIP tag on WallBang servers.",
  },
  {
    title: "Colored chat",
    description: "Customize your in-game chat color as a VIP member.",
  },
  {
    title: "Website badge",
    description: "Show a VIP badge on your WallBang profile.",
  },
  {
    title: "Priority queue",
    description: "Higher join priority when servers are busy.",
  },
] as const;

export const launchOfferSteps = [
  {
    step: 1,
    title: "Sign in with Steam",
    description:
      "Create your WallBang account with Steam login. This locks in your player identity — VIP is not granted yet.",
  },
  {
    step: 2,
    title: "Join our Discord",
    description:
      "Join the WallBang Discord server, then link Discord on this page so we can confirm you're a member.",
  },
  {
    step: 3,
    title: "Claim VIP",
    description:
      "After Steam + Discord membership are verified, launch VIP is applied automatically while slots remain.",
  },
] as const;
