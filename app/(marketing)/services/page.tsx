import { LegalArticle } from "@/components/legal/legal-article";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Our Services",
  description:
    "WallBang CS2 retake server access and optional prepaid VIP plans, including duration, expiry, and renewal terms.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <LegalArticle
      slug="services"
      breadcrumbName="Services"
      breadcrumbPath="/services"
    />
  );
}
