import { LegalArticle } from "@/components/legal/legal-article";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "WallBang Shipping & Digital Delivery Policy",
  description:
    "WallBang delivery policy — VIP membership is applied electronically. No physical products are shipped.",
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
