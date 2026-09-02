import { LegalArticle } from "@/components/legal/legal-article";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Our Services",
  description:
    "WallBang CS2 community and retake servers, plus optional fixed-duration VIP membership for priority/reserved access and server privileges.",
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
