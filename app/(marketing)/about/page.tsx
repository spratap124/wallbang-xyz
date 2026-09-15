import { LegalArticle } from "@/components/legal/legal-article";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "About Us",
  description:
    "About WallBang — independent game-server hosting for Counter-Strike 2 community servers in India. We operate the infrastructure; we do not sell the game.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <LegalArticle slug="about" breadcrumbName="About Us" breadcrumbPath="/about" />
  );
}
