import { CopyIpButton } from "@/components/servers/copy-ip-button";
import { Container, SectionHeading } from "@/components/shared/primitives";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  getConnectCommand,
  getSteamConnectUrl,
  servers,
} from "@/config/servers";
import { cn } from "@/lib/utils";

const statusLabel = {
  live: "Live",
  offline: "Offline",
  maintenance: "Maintenance",
} as const;

export function ServersSection({
  showHeading = true,
}: {
  showHeading?: boolean;
}) {
  return (
    <section id="servers" className="border-t border-border py-20 sm:py-24">
      <Container>
        {showHeading ? (
          <SectionHeading
            eyebrow="Live servers"
            title="Jump into a retake right now"
            description="Click a connect link to open Counter-Strike 2 through Steam and join the server automatically."
          />
        ) : null}

        <ul className={showHeading ? "grid gap-4" : "mt-0 grid gap-4"}>
          {servers.map((server) => (
            <li
              key={server.id}
              className="flex flex-col gap-5 rounded-xl border border-border bg-card/50 p-6 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-semibold">{server.name}</h3>
                  <Badge
                    variant="secondary"
                    className={cn(
                      server.status === "live" &&
                        "border-transparent bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15",
                      server.status === "offline" &&
                        "bg-muted text-muted-foreground",
                      server.status === "maintenance" &&
                        "bg-amber-500/15 text-amber-400 hover:bg-amber-500/15",
                    )}
                  >
                    {statusLabel[server.status]}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {server.mode} · {server.region}
                </p>
                <div className="mt-3 flex items-center gap-1.5">
                  <a
                    href={getSteamConnectUrl(server)}
                    className="font-mono text-sm text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {getConnectCommand(server)}
                  </a>
                  <CopyIpButton server={server} />
                </div>
              </div>

              <a
                href={getSteamConnectUrl(server)}
                className={cn(buttonVariants({ size: "lg" }), "shrink-0 justify-center")}
              >
                Connect in CS2
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
