import type { FaqItem } from "@/types/content";
import { businessModelFaqs } from "@/content/business";

export const faqs: FaqItem[] = [
  ...businessModelFaqs,
  {
    id: "what-does-access-include",
    question: "What does hosted server access include?",
    answer:
      "Hosted Server Access provides priority/reserved access on the WallBang community servers you select, plus server/community privileges for that term. Privileges may include a reserved slot, VIP chat tag, and server-side visual effects that appear only on WallBang servers. Those effects have no Steam inventory value and are distinct from tradeable CS2 skins. This is not an in-game purchase, wallet, or monetary benefit.",
  },
  {
    id: "how-long-access",
    question: "How long does hosted server access last?",
    answer:
      "Access lasts for the duration you select at checkout: 1 month, 3 months, 6 months, or 1 year. When that term ends, reserved access and related privileges end. You can purchase another term if you want to continue.",
  },
  {
    id: "is-it-free",
    question: "Do I need to pay to use WallBang servers?",
    answer:
      "No. Connecting to WallBang community and retake servers does not require a purchase. Hosted Server Access is optional prepaid reserved access for a stated term.",
  },
  {
    id: "how-to-buy",
    question: "How do I get hosted server access?",
    answer:
      "Open the Pricing page, pick a server and duration, then pay once at checkout. Access is applied to the Steam account you sign in with. During the launch offer, a limited number of players can also claim complimentary access after signing in with Steam.",
  },
  {
    id: "when-launch",
    question: "Are the servers live?",
    answer:
      "[WallBang] Retake #1 | [Mumbai] is live now. Use the Connect button on the homepage (or the connect command) to open Counter-Strike 2 through Steam and join a WallBang community server. You must already own Counter-Strike 2.",
  },
  {
    id: "regions",
    question: "Which regions are supported?",
    answer:
      "WallBang is India first — low-latency Counter-Strike 2 community servers hosted in India are the priority. Additional regions may follow once the India footprint is stable and demand is clear.",
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
      "Yes. Use Sign in with Steam in the site header to link your account. Hosted server access is applied to the Steam account you use on WallBang servers.",
  },
  {
    id: "pay-to-win",
    question: "Does paid access change how the game plays?",
    answer:
      "No. Server-side visual effects, chat tags, and reserved access do not change weapon performance, economy, or match rules. Those stay the same for every player.",
  },
  {
    id: "cosmetics-vs-skins",
    question: "Are WallBang cosmetics the same as Steam skins?",
    answer:
      "No. WallBang's server-only visual cosmetics appear only while you are connected to a WallBang community server. They are not sold as game items, are not Steam Workshop items, are not added to your Steam inventory, and cannot be traded or sold. They are a visual privilege of hosted server access, not tradeable CS2 content.",
  },
  {
    id: "gambling",
    question: "Is WallBang a gambling, betting, or wagering platform?",
    answer:
      "No. WallBang is a game-server hosting service for Counter-Strike 2 community servers. It does not offer gambling, betting, wagering, or real-money gaming. Customers cannot win, lose, cash out, or withdraw money through WallBang.",
  },
  {
    id: "refunds",
    question: "How do refunds and cancellation work?",
    answer:
      "You can request a refund within 7 days if hosted server access has not been used or activated. Approved refunds are initiated within 5–7 business days to the original payment method. Full details are on the Refund Policy and Cancellation Policy pages.",
  },
];

export const homeFaqs = faqs.slice(0, 6);
