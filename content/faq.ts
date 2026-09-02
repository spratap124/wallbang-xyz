import type { FaqItem } from "@/types/content";

export const faqs: FaqItem[] = [
  {
    id: "what-is-wallbang",
    question: "What is WallBang?",
    answer:
      "WallBang operates privately managed Counter-Strike 2 community and retake servers. You can connect without paying. If you want priority/reserved server access and additional server/community privileges, you can purchase a fixed-duration VIP membership.",
  },
  {
    id: "what-do-i-purchase",
    question: "What do I purchase?",
    answer:
      "The only paid product is a prepaid VIP membership for a stated term (1 month, 3 months, 6 months, or 1 year). You pay once for that term. VIP is not automatically renewed.",
  },
  {
    id: "what-does-vip-include",
    question: "What does VIP include?",
    answer:
      "VIP provides priority/reserved server access and additional server/community privileges on the servers you select. Privileges may include a reserved slot, VIP chat tag, and server-only visual cosmetics. VIP is not an in-game financial product, wallet, or monetary benefit.",
  },
  {
    id: "how-long-vip",
    question: "How long does VIP last?",
    answer:
      "VIP lasts for the duration you select at checkout. When that term ends, VIP privileges end. You can purchase another term if you want to continue.",
  },
  {
    id: "is-it-free",
    question: "Do I need VIP to use WallBang servers?",
    answer:
      "No. Connecting to WallBang community and retake servers does not require a purchase. VIP is optional.",
  },
  {
    id: "become-vip",
    question: "How do I become VIP?",
    answer:
      "Buy prepaid VIP on the Pricing page. Select a server, then 1 / 3 / 6 months or 1 year — paid once at checkout. VIP is not automatically renewed. During the launch offer, a limited number of players can also claim complimentary VIP after signing in with Steam.",
  },
  {
    id: "when-launch",
    question: "Are the servers live?",
    answer:
      "[WallBang] Retake #1 | [Mumbai] is live now. Use the Connect button on the homepage (or the connect command) to open CS2 through Steam and join a WallBang community server.",
  },
  {
    id: "regions",
    question: "Which regions are supported?",
    answer:
      "WallBang is India first — low-latency CS2 retake servers for Indian players are the priority. Additional regions may follow once the India footprint is stable and demand is clear.",
  },
  {
    id: "statistics",
    question: "Will player statistics be available?",
    answer:
      "Player statistics are planned, with profiles and leaderboards expanding over time so progress on WallBang servers is easier to follow.",
  },
  {
    id: "steam-login",
    question: "Will WallBang use Steam login?",
    answer:
      "Yes. Use Sign in with Steam in the site header to link your account. VIP is applied to the Steam account you use on WallBang servers.",
  },
  {
    id: "pay-to-win",
    question: "Does VIP change how the game plays?",
    answer:
      "No. VIP privileges such as cosmetics and reserved access do not change weapon performance, economy, or match rules. Those stay the same for every player.",
  },
  {
    id: "refunds",
    question: "How do refunds and cancellation work?",
    answer:
      "You can request a refund within 7 days if VIP has not been used or activated. Approved refunds are initiated within 5–7 business days to the original payment method. Full details are on the Refund Policy and Cancellation Policy pages.",
  },
];

export const homeFaqs = faqs.slice(0, 6);
