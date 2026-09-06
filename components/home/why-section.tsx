import { Container, SectionHeading } from "@/components/shared/primitives";

const reasons = [
  {
    title: "Clear membership",
    body: "VIP is a fixed-duration membership for reserved access and server privileges — paid once for the term you choose.",
  },
  {
    title: "Community servers",
    body: "Privately managed CS2 community and retake servers. Connecting does not require a purchase.",
  },
  {
    title: "Performance",
    body: "India-first low latency servers so retake sessions feel responsive.",
  },
];

export function WhySection() {
  return (
    <section id="why" className="border-y border-border bg-card/30 py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Why WallBang"
          title="A CS2 community built to last"
          description="Privately managed community and retake servers in India, with an optional VIP membership for players who want reserved access and extra privileges."
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
