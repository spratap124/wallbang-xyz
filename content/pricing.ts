import type { FaqItem } from "@/types/content";

export const pricingFaqs: FaqItem[] = [
  {
    id: "auto-renew",
    question: "Do plans auto-renew?",
    answer:
      "No. Every VIP plan is prepaid. Access ends when the term ends, and you only pay again if you choose to renew.",
  },
  {
    id: "same-perks",
    question: "Do longer plans include extra perks?",
    answer:
      "No. 1 month, 3 months, 6 months, and 1 year all include the same VIP perks. Longer terms just cost less per month.",
  },
  {
    id: "pay-to-win",
    question: "Is VIP pay-to-win?",
    answer:
      "No. Cosmetics, chat tags, and member perks never change weapon performance, economy, or match rules.",
  },
  {
    id: "how-to-buy",
    question: "How do I buy VIP?",
    answer:
      "Open the Pricing page, pick a server and duration, then pay once at checkout. Your VIP is applied to the Steam account you sign in with. Membership status lives on the VIP page.",
  },
];
