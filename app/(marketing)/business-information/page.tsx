import { LegalArticle } from "@/components/legal/legal-article";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "WallBang Business Information",
  description:
    "WallBang business information — independent Counter-Strike 2 community server operator in India, Hosted Server Access terms, support contact, and registered address.",
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
