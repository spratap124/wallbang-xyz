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
    "Explore WallBang CS2 community servers: low-latency India retakes, optional VIP membership, Steam login, statistics, and leaderboards.",
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
          description="India-first community and retake servers, optional VIP membership, stats, and the features we are building next."
        />
      </Container>
      <FeaturesSection showViewAll={false} />
    </div>
  );
}
