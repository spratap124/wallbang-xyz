export type NavItem = {
  title: string;
  href: string;
  description?: string;
};

export const mainNav: NavItem[] = [
  { title: "Servers", href: "/servers" },
  { title: "Loadout", href: "/loadout" },
  { title: "VIP", href: "/vip" },
  { title: "Pricing", href: "/pricing" },
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
      { title: "Pricing", href: "/pricing" },
      { title: "Offers", href: "/offers" },
      { title: "Features", href: "/features" },
    ],
  },
  {
    title: "Resources",
    items: [{ title: "FAQ", href: "/faq" }],
  },
  {
    title: "Legal",
    items: [
      { title: "About Us", href: "/about" },
      { title: "Services", href: "/services" },
      { title: "Terms & Conditions", href: "/terms" },
      { title: "Privacy Policy", href: "/privacy" },
      { title: "Refund Policy", href: "/refund" },
      { title: "Cancellation Policy", href: "/cancellation" },
      { title: "Shipping & Delivery", href: "/shipping-and-delivery" },
      { title: "Business Information", href: "/business-information" },
      { title: "Contact Us", href: "/contact" },
    ],
  },
];

export type NavVisibility = {
  vipPage?: boolean;
  loadoutPage?: boolean;
  featuresPage?: boolean;
};

const gatedHrefs: Record<string, keyof NavVisibility> = {
  "/vip": "vipPage",
  "/loadout": "loadoutPage",
  "/features": "featuresPage",
};

/** Drop gated nav entries when their public page flag is off. */
export function filterNavItems(
  items: NavItem[],
  options: NavVisibility,
): NavItem[] {
  return items.filter((item) => {
    const flag = gatedHrefs[item.href];
    if (!flag) return true;
    return Boolean(options[flag]);
  });
}

export function filterFooterNav(
  groups: typeof footerNav,
  options: NavVisibility,
): typeof footerNav {
  return groups.map((group) => ({
    ...group,
    items: filterNavItems(group.items, options),
  }));
}
