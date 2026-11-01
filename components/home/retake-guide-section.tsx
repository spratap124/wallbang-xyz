import { Container, SectionHeading } from "@/components/shared/primitives";
import {
  getServerAddress,
  prettyMapName,
} from "@/config/servers";
import { getGameServers } from "@/lib/servers/registry";
import type { RegisteredServer } from "@/types/servers";

function asAddress(server: RegisteredServer): string {
  return getServerAddress({ host: server.host, port: server.port });
}

/**
 * Player-facing guide rendered on the server so Google indexes the connect
 * instructions and the real, current server addresses (the live grid above
 * hydrates client-side and ships an empty list in the initial HTML).
 */
export async function RetakeGuideSection() {
  const servers = await getGameServers().catch(() => [] as RegisteredServer[]);

  return (
    <section id="retake-guide" className="border-b border-border py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="CS2 Retake"
          title="What is a CS2 retake server?"
          description="Retake is one of the most-played community formats of Counter-Strike 2."
        />

        <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            On a retake server you skip the buy round and drop straight into the
            final seconds of a round: the defending side already holds the
            bombsite and the attacking side storms in to plant or clear. You
            take a short fight, the site resets, and the next round starts
            immediately — round-after-round site practice without a strategy
            phase or long wait.
          </p>
          <p>
            WallBang hosts dedicated CS2 retake servers in India. Every game
            server runs on infrastructure hosted in India, for Indian CS2
            players — it is how the network is built and there are no plans to
            change it. You connect from the game server list below, pick a
            session through the CS2 console or a one-click Steam link, and pay
            nothing: connecting is free. Optional hosted server access adds
            reserved slots and server-only privileges.
          </p>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">
              How to join a WallBang retake server
            </h3>
            <ol className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">1. Launch Counter-Strike 2.</span>{" "}
                You need the game installed on Steam.
              </li>
              <li>
                <span className="font-medium text-foreground">2. Open the developer console</span>{" "}
                (enable it in Settings → Game → &ldquo;Enable developer console&rdquo;,
                then press <kbd className="font-mono">~</kbd>).
              </li>
              <li>
                <span className="font-medium text-foreground">
                  3. Enter the connect command.
                </span>{" "}
                Type <code className="font-mono text-foreground">connect ip:port</code>{" "}
                from the list below and press Enter. Copy buttons on the live
                server cards fill it in for you.
              </li>
              <li>
                <span className="font-medium text-foreground">4. Join the retake match.</span>{" "}
                The server drops you into the next retake round automatically.
              </li>
            </ol>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              You can also skip the console: the{" "}
              <a
                href="/servers"
                className="text-foreground underline underline-offset-4 hover:text-primary"
              >
                live servers page
              </a>{" "}
              and the homepage cards use a{" "}
              <code className="font-mono text-foreground">steam://</code> link
              that opens Counter-Strike 2 and connects in one click.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold tracking-tight">
              Indian CS2 server addresses
            </h3>
            {servers.length > 0 ? (
              <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card/40">
                {servers.map((server) => (
                  <li
                    key={server.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {server.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {prettyMapName(server.map)} · {server.region}
                      </p>
                    </div>
                    <code className="shrink-0 rounded border border-border/70 bg-background px-2 py-1 font-mono text-xs text-foreground">
                      connect {asAddress(server)}
                    </code>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Server addresses are listed on each live server card above.
              </p>
            )}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Add each address to your Counter-Strike 2 favourites, or save the{" "}
              <a
                href="/faq"
                className="underline underline-offset-4 hover:text-primary"
              >
                FAQ page
              </a>{" "}
              for the join steps — both link to the current connect commands.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
