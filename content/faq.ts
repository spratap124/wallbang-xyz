import type { FaqItem } from "@/types/content";

export const faqs: FaqItem[] = [
  {
    id: "what-is-wallbang",
    question: "What is WallBang?",
    answer:
      "WallBang is a long-term Counter-Strike 2 competitive platform. It starts with public retake servers and grows into VIP membership, Steam login, player profiles, statistics, leaderboards, inventory, tournaments, and more — beginning with an India-first server footprint.",
  },
  {
    id: "when-launch",
    question: "When will WallBang launch?",
    answer:
      "[WallBang] Retake #1 | [Mumbai] is live now. Use the Connect button on the homepage (or the connect command) to open CS2 through Steam. More platform features — VIP, stats, and profiles — continue rolling out on the public roadmap.",
  },
  {
    id: "is-it-free",
    question: "Will WallBang be free?",
    answer:
      "Yes. Core retake servers and competitive play are designed to remain accessible. VIP is optional and focused on cosmetics and member perks — not pay-to-win advantages.",
  },
  {
    id: "become-vip",
    question: "How do I become VIP?",
    answer:
      "During the launch offer, the first 100 players who sign in with Steam at wallbang.xyz/offer receive 3 months of VIP automatically — no Discord posting required. Join our Discord server to stay close to the community. After the launch slots fill, paid VIP details will be announced on the site and in Discord.",
  },
  {
    id: "regions",
    question: "Which regions will be supported?",
    answer:
      "WallBang is India first — low-latency CS2 retake servers for Indian players are the priority. Additional regions may follow once the India footprint is stable and demand is clear.",
  },
  {
    id: "statistics",
    question: "Will player statistics be available?",
    answer:
      "Yes. Player statistics are planned for Phase 2, with leaderboards, profiles, and season rankings expanding in Phase 3 so progress is visible and competitive.",
  },
  {
    id: "steam-login",
    question: "Will WallBang use Steam login?",
    answer:
      "Yes. Use Sign in with Steam in the site header to link your account. Your profile, inventory, and progress stay tied to your Steam identity across WallBang services.",
  },
  {
    id: "pay-to-win",
    question: "Is WallBang pay-to-win?",
    answer:
      "No. Cosmetics and VIP perks must never alter competitive fairness. Weapon performance, economy, and match rules stay the same for every player.",
  },
];

export const homeFaqs = faqs.slice(0, 6);
