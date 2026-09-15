import { redirect } from "next/navigation";

import { FeaturesSection } from "@/components/home/features-section";
import { Container, SectionHeading } from "@/components/shared/primitives";
import { JsonLd } from "@/components/shared/json-ld";
import { isFeaturesPageEnabled } from "@/lib/platform/feature-flags";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Features",
  description:
    "Explore WallBang Counter-Strike 2 community servers: India-hosted infrastructure, optional hosted server access, Steam login, statistics, and leaderboards.",
  path: "/features",
});

export default async function FeaturesPage() {
  if (!(await isFeaturesPageEnabled())) {
    redirect("/");
  }

  return (
    <div className="py-16 sm:py-20">
      <JsonLd
        id="ld-features-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Features", path: "/features" },
        ])}
      />
      <Container>
        <SectionHeading
          eyebrow="Features"
          title="Everything WallBang is building"
          description="India-hosted Counter-Strike 2 community servers, optional hosted server access, stats, and the features we are building next."
        />
      </Container>
      <FeaturesSection showViewAll={false} />
    </div>
  );
}
