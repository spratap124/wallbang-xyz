import { LegalArticle } from "@/components/legal/legal-article";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "WallBang Shipping & Digital Delivery Policy",
  description:
    "WallBang shipping and delivery policy — digital gaming services only. VIP memberships are delivered electronically with no physical shipping.",
  path: "/shipping-and-delivery",
});

export default function ShippingAndDeliveryPage() {
  return (
    <LegalArticle
      slug="shipping-and-delivery"
      breadcrumbName="Shipping & Delivery"
      breadcrumbPath="/shipping-and-delivery"
    />
  );
}
