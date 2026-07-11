import { Container, SectionHeading } from "@/components/shared/primitives";

const reasons = [
  {
    title: "Fair competition",
    body: "No pay-to-win. VIP and cosmetics never rewrite the competitive ruleset — integrity comes first.",
  },
  {
    title: "Modern technology",
    body: "CounterStrikeSharp, Metamod, and a production web stack designed to grow into auth, stats, and tournaments.",
  },
  {
    title: "Performance",
    body: "India-first low latency servers so practice feels like the real fight — not a high-ping approximation.",
  },
  {
    title: "Transparent development",
    body: "Public roadmap, changelog, and Discord feedback loops. You can see what ships next.",
  },
  {
    title: "Community feedback",
    body: "WallBang is shaped with players, not around them. Community-driven priorities keep the product honest.",
  },
  {
    title: "Long-term platform",
    body: "Not another disposable server IP. A foundation for profiles, leaderboards, inventory, and competitive events.",
  },
];

export function WhySection() {
  return (
    <section id="why" className="border-y border-border bg-card/30 py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Why WallBang"
          title="Why another CS2 platform?"
          description="Because serious players deserve infrastructure that respects fairness, latency, and long-term progression — especially in India."
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
