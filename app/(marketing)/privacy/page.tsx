import { LegalArticle } from "@/components/legal/legal-article";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Privacy Policy",
  description:
    "WallBang privacy policy covering Steam ID, VIP transactions, payment processing, cookies, data retention, and your rights.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalArticle
      slug="privacy"
      breadcrumbName="Privacy Policy"
      breadcrumbPath="/privacy"
    />
  );
}
