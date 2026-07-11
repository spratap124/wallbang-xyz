import { Container, SectionHeading } from "@/components/shared/primitives";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export function ComingSoonSection() {
  return (
    <section id="coming-soon" className="py-20 sm:py-24">
      <Container>
        <div className="rounded-2xl border border-border bg-[linear-gradient(135deg,rgba(232,36,42,0.12),transparent_45%),#12151a] px-6 py-12 sm:px-10">
          <SectionHeading
            eyebrow="Platform roadmap"
            title="Retakes are live — the platform is still expanding"
            description="Public retake servers are online today. VIP, Steam login, statistics, leaderboards, and tournaments ship next. Join Discord for patch notes and early feature access."
            className="mb-8"
          />
          <a
            href={siteConfig.discordUrl}
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Follow updates on Discord
          </a>
        </div>
      </Container>
    </section>
  );
}
