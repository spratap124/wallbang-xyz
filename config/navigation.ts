export type NavItem = {
  title: string;
  href: string;
  description?: string;
};

export const mainNav: NavItem[] = [
  { title: "Servers", href: "/servers" },
  { title: "Loadout", href: "/loadout" },
  { title: "Launch VIP", href: "/offer" },
  { title: "Features", href: "/features" },
];

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: "Product",
    items: [
      { title: "Servers", href: "/servers" },
      { title: "Loadout", href: "/loadout" },
      { title: "Launch VIP Offer", href: "/offer" },
      { title: "Features", href: "/features" },
      { title: "Roadmap", href: "/roadmap" },
      { title: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Resources",
    items: [
      { title: "Blog", href: "/blog" },
      { title: "FAQ", href: "/faq" },
      { title: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    items: [
      { title: "Privacy", href: "/privacy" },
      { title: "Terms", href: "/terms" },
    ],
  },
];
