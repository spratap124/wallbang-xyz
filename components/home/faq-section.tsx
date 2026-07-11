import Link from "next/link";

import { Container, SectionHeading } from "@/components/shared/primitives";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { buttonVariants } from "@/components/ui/button";
import type { FaqItem } from "@/types/content";
import { cn } from "@/lib/utils";

type FaqSectionProps = {
  items: FaqItem[];
  showViewAll?: boolean;
};

export function FaqSection({ items, showViewAll = true }: FaqSectionProps) {
  return (
    <section id="faq" className="border-y border-border bg-card/30 py-20 sm:py-24">
      <Container>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="FAQ"
            title="Answers before you queue"
            description="Straight answers about WallBang, launch timing, VIP, regions, and statistics."
            className="mb-0"
          />
          {showViewAll ? (
            <Link
              href="/faq"
              className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
            >
              All FAQs
            </Link>
          ) : null}
        </div>

        <Accordion className="mt-10 max-w-3xl">
          {items.map((faq) => (
            <AccordionItem key={faq.id} value={faq.id}>
              <AccordionTrigger className="text-base">{faq.question}</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">{faq.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </section>
  );
}
