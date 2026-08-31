import { LegalArticle } from "@/components/legal/legal-article";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Terms & Conditions",
  description:
    "WallBang terms and conditions for wallbang.xyz, CS2 retake servers, prepaid VIP access, payments, and fair play.",
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
