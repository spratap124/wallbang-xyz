import { FaqSection } from "@/components/home/faq-section";
import { FeaturesSection } from "@/components/home/features-section";
import { HeroSection } from "@/components/home/hero-section";
import { ServersSection } from "@/components/home/servers-section";
import { WaitlistSection } from "@/components/home/waitlist-section";
import { WhySection } from "@/components/home/why-section";
import { LiveServersProvider } from "@/components/servers/live-servers-provider";
import { JsonLd } from "@/components/shared/json-ld";
import { homeFaqs } from "@/content/faq";
import { siteConfig } from "@/config/site";
import { isFeaturesPageEnabled } from "@/lib/platform/feature-flags";
import { faqJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: siteConfig.name,
  description: siteConfig.description,
  path: "/",
});

export default async function HomePage() {
  const showFeaturesPage = await isFeaturesPageEnabled().catch(() => false);

  return (
    <>
      <JsonLd id="ld-home-faq" data={faqJsonLd(homeFaqs)} />
      <LiveServersProvider>
        <HeroSection />
        <ServersSection />
      </LiveServersProvider>
      <FeaturesSection limit={2} showViewAll={showFeaturesPage} />
      <WhySection />
      <FaqSection items={homeFaqs} />
      <WaitlistSection />
    </>
  );
}
