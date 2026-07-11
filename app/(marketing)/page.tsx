import { ComingSoonSection } from "@/components/home/coming-soon-section";
import { FaqSection } from "@/components/home/faq-section";
import { FeaturesSection } from "@/components/home/features-section";
import { HeroSection } from "@/components/home/hero-section";
import { RoadmapSection } from "@/components/home/roadmap-section";
import { ServersSection } from "@/components/home/servers-section";
import { WaitlistSection } from "@/components/home/waitlist-section";
import { WhySection } from "@/components/home/why-section";
import { JsonLd } from "@/components/shared/json-ld";
import { homeFaqs } from "@/content/faq";
import { siteConfig } from "@/config/site";
import { faqJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: siteConfig.name,
  description: siteConfig.description,
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <JsonLd id="ld-home-faq" data={faqJsonLd(homeFaqs)} />
      <HeroSection />
      <ServersSection />
      <FeaturesSection limit={6} />
      <WhySection />
      <RoadmapSection />
      <FaqSection items={homeFaqs} />
      <ComingSoonSection />
      <WaitlistSection />
    </>
  );
}
