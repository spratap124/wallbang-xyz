import { LegalArticle } from "@/components/legal/legal-article";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Terms & Conditions",
  description:
    "WallBang terms for CS2 community and retake servers, prepaid VIP membership, payments, and server rules.",
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
