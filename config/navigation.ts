export type NavItem = {
  title: string;
  href: string;
  description?: string;
};

export const mainNav: NavItem[] = [
  { title: "Servers", href: "/servers" },
  { title: "Loadout", href: "/loadout" },
  { title: "VIP", href: "/vip" },
  { title: "Offers", href: "/offers" },
  { title: "Features", href: "/features" },
];

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: "Product",
    items: [
      { title: "Servers", href: "/servers" },
      { title: "Loadout", href: "/loadout" },
      { title: "VIP", href: "/vip" },
      { title: "Offers", href: "/offers" },
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
      { title: "Refund Policy", href: "/refund" },
    ],
  },
];

/** Drop VIP nav entries when the public VIP page flag is off. */
export function filterNavItems(
  items: NavItem[],
  options: { vipPage: boolean },
): NavItem[] {
  if (options.vipPage) return items;
  return items.filter((item) => item.href !== "/vip");
}

export function filterFooterNav(
  groups: typeof footerNav,
  options: { vipPage: boolean },
): typeof footerNav {
  if (options.vipPage) return groups;
  return groups.map((group) => ({
    ...group,
    items: filterNavItems(group.items, options),
  }));
}
