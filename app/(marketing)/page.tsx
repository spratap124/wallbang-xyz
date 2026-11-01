import { FaqSection } from "@/components/home/faq-section";
import { FeaturesSection } from "@/components/home/features-section";
import { HeroSection } from "@/components/home/hero-section";
import { RetakeGuideSection } from "@/components/home/retake-guide-section";
import { ReliabilitySection } from "@/components/home/reliability-section";
import { ServersSection } from "@/components/home/servers-section";
import { WaitlistSection } from "@/components/home/waitlist-section";
import { WhatWeProvideSection } from "@/components/home/what-we-provide-section";
import { WhatYouPayForSection } from "@/components/home/what-you-pay-for-section";
import { WhySection } from "@/components/home/why-section";
import { LiveServersProvider } from "@/components/servers/live-servers-provider";
import { JsonLd } from "@/components/shared/json-ld";
import { homeFaqs } from "@/content/faq";
import { siteConfig } from "@/config/site";
import { isFeaturesPageEnabled } from "@/lib/platform/feature-flags";
import { faqJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

/** Homepage targets the player-facing query set, not the hosting framing. */
export const metadata = createPageMetadata({
  title: "CS2 Retake Servers India",
  description:
    "Play CS2 retake on WallBang, a dedicated Indian CS2 server network. Join competitive Counter-Strike 2 retake matches, explore maps and connect with the community.",
  path: "/",
  keywords: [
    ...siteConfig.keywords,
    "CS2 Retake Servers",
    "CS2 Retake Servers India",
    "Indian CS2 Servers",
    "CS2 Retake India",
    "CS2 Servers India",
    "Counter-Strike 2 Retake Servers",
    "CS2 Retake Server India",
  ],
});

export default async function HomePage() {
  const showFeaturesPage = await isFeaturesPageEnabled().catch(() => false);

  return (
    <>
      <JsonLd id="ld-home-faq" data={faqJsonLd(homeFaqs)} />
      <LiveServersProvider>
        <HeroSection />
        <ReliabilitySection />
        <ServersSection />
      </LiveServersProvider>
      <WhatWeProvideSection />
      <RetakeGuideSection />
      <WhatYouPayForSection />
      <FeaturesSection limit={2} showViewAll={showFeaturesPage} />
      <WhySection />
      <FaqSection items={homeFaqs} />
      <WaitlistSection />
    </>
  );
}
