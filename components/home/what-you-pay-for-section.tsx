import { Check, X } from "lucide-react";

import { Container, SectionHeading } from "@/components/shared/primitives";
import {
  notSoldItems,
  whatYouPayFor,
} from "@/content/business";

export function WhatYouPayForSection() {
  return (
    <section
      id="what-you-pay-for"
      className="border-y border-border bg-card/30 py-20 sm:py-24"
    >
      <Container>
        <SectionHeading
          eyebrow="Pricing"
          title="What you're paying for"
          description={whatYouPayFor}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-primary/30 bg-primary/5 p-6 sm:p-8">
            <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
              Hosted server access
            </p>
            <h3 className="mt-3 text-xl font-semibold">
              Fixed-duration access to WallBang servers
            </h3>
            <ul className="mt-5 space-y-3">
              {[
                "Server capacity on India-hosted community servers",
                "Server administration and maintenance",
                "Reserved access for the term you select",
                "Community privileges included with that access period",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-relaxed">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-border bg-card/60 p-6 sm:p-8">
            <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
              Not included
            </p>
            <h3 className="mt-3 text-xl font-semibold">
              WallBang does not sell the game
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Counter-Strike 2 is a third-party game. Players must own it separately.
              Your payment is for WallBang server infrastructure only.
            </p>
            <ul className="mt-5 space-y-3">
              {notSoldItems.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground"
                >
                  <X className="mt-0.5 size-4 shrink-0 text-destructive/80" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </Container>
    </section>
  );
}
