import {
  Activity,
  RefreshCw,
  Server,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { Container } from "@/components/shared/primitives";

const reliabilityItems: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: ShieldCheck,
    title: "DDoS-Protected Infrastructure",
    description:
      "Our game servers run on DDoS-protected infrastructure designed to mitigate malicious traffic and keep gameplay accessible during network attacks.",
  },
  {
    icon: RefreshCw,
    title: "Automatic CS2 Updates",
    description:
      "When Valve releases CS2 updates, our servers automatically receive the latest game files, helping players get back into matches with minimal downtime.",
  },
  {
    icon: Server,
    title: "India-Based Infrastructure",
    description:
      "Servers hosted in India for a more responsive experience and lower latency for Indian players.",
  },
  {
    icon: Activity,
    title: "Reliability-Focused Operations",
    description:
      "We monitor server health and performance to identify issues and keep our retake servers running smoothly.",
  },
];

export function ReliabilitySection() {
  return (
    <section className="border-y border-border py-16 sm:py-20">
      <Container>
        <div className="rounded-2xl border border-border bg-card/30 px-6 py-8 sm:px-10 sm:py-10">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium tracking-wide text-emerald-400 uppercase">
              Built for reliability
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Play More. Worry Less.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Your matches deserve reliable infrastructure. We’ve got the
              protection and maintenance covered.
            </p>
          </div>

          <ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {reliabilityItems.map(({ icon: Icon, title, description }) => (
              <li key={title}>
                <Icon
                  className="mb-3 size-5 text-emerald-400"
                  aria-hidden="true"
                />
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-border bg-card/30 p-5 sm:p-6">
            <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-1 text-[0.7rem] font-medium tracking-wide text-emerald-400 uppercase">
              Network protection
            </span>
            <h3 className="mt-3 text-xl font-semibold">
              Your Matches. Protected.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              WallBang servers operate on DDoS-protected game server
              infrastructure, designed to mitigate malicious network traffic
              that can disrupt online gameplay.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Network-level DDoS mitigation.</li>
              <li>Protection against malicious traffic targeting game servers.</li>
              <li>Infrastructure designed for uninterrupted community gameplay.</li>
              <li>Reliability-focused server hosting.</li>
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Protection is designed to mitigate attacks; no infrastructure can
              guarantee immunity from every possible attack.
            </p>
          </article>

          <article className="rounded-xl border border-border bg-card/30 p-5 sm:p-6">
            <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-1 text-[0.7rem] font-medium tracking-wide text-emerald-400 uppercase">
              Automated server maintenance
            </span>
            <h3 className="mt-3 text-xl font-semibold">
              New CS2 Update? We&apos;ve Got It Covered.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Valve releases a CS2 update, and our automated update system
              takes care of the rest.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Our servers automatically check for and install the latest CS2
              game updates, helping minimize downtime and ensuring players can
              get back into the action without unnecessary waiting.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Automatic update detection.</li>
              <li>Automated game file updates.</li>
              <li>Controlled server restarts when required.</li>
              <li>Minimal downtime during routine game updates.</li>
            </ul>
          </article>
        </div>
      </Container>
    </section>
  );
}
