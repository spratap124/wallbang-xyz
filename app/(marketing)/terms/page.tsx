import { LegalArticle } from "@/components/legal/legal-article";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Terms & Conditions",
  description:
    "WallBang terms for hosted Counter-Strike 2 community servers, prepaid Hosted Server Access, payments, and server rules.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalArticle
      slug="terms"
      breadcrumbName="Terms & Conditions"
      breadcrumbPath="/terms"
    />
  );
}
