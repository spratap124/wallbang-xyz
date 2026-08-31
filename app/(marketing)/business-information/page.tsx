import { LegalArticle } from "@/components/legal/legal-article";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "WallBang Business Information",
  description:
    "WallBang business information — brand name, legal operator, business category, support contact, and registered address for wallbang.xyz.",
  path: "/business-information",
});

export default function BusinessInformationPage() {
  return (
    <LegalArticle
      slug="business-information"
      breadcrumbName="Business Information"
      breadcrumbPath="/business-information"
    />
  );
}
