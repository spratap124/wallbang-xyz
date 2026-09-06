import { LegalArticle } from "@/components/legal/legal-article";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Cancellation Policy",
  description:
    "WallBang cancellation policy for prepaid VIP membership: cancellation before activation, no automatic renewal, and expiry terms.",
  path: "/cancellation",
});

export default function CancellationPage() {
  return (
    <LegalArticle
      slug="cancellation"
      breadcrumbName="Cancellation Policy"
      breadcrumbPath="/cancellation"
    />
  );
}
