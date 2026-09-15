import { Container, SectionHeading } from "@/components/shared/primitives";

const reasons = [
  {
    title: "Clear hosted access",
    body: "You pay once for reserved access to WallBang-hosted community servers for a stated term — not for the game or in-game items.",
  },
  {
    title: "Community servers",
    body: "Independently operated Counter-Strike 2 community and retake servers in India. Connecting does not require a purchase.",
  },
  {
    title: "India-hosted performance",
    body: "Low-latency Indian server infrastructure so retake sessions feel responsive.",
  },
];

export function WhySection() {
  return (
    <section id="why" className="border-y border-border bg-card/30 py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Why WallBang"
          title="CS2 servers. Independent hosting."
          description="Counter-Strike 2 is the game we support. WallBang is the independent company operating and hosting the community server infrastructure in India."
        />

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {reasons.map((reason) => (
            <article key={reason.title}>
              <h3 className="text-lg font-semibold text-foreground">{reason.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {reason.body}
              </p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
