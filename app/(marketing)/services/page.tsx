import { LegalArticle } from "@/components/legal/legal-article";
import { VipServicePrices } from "@/components/legal/vip-service-prices";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Our Services",
  description:
    "WallBang hosted Counter-Strike 2 community servers in India, plus optional fixed-duration Hosted Server Access for reserved slots and server privileges.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <LegalArticle
      slug="services"
      breadcrumbName="Services"
      breadcrumbPath="/services"
    >
      <VipServicePrices />
    </LegalArticle>
  );
}
