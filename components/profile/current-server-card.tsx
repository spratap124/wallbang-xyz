import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prettyMapName } from "@/config/servers";
import type { CurrentServerInfo } from "@/types/profile";

type CurrentServerCardProps = {
  server: CurrentServerInfo | null;
};

export function CurrentServerCard({ server }: CurrentServerCardProps) {
  const online = Boolean(server);
  const playersLabel =
    server?.players != null && server.maxPlayers != null
      ? `${server.players}/${server.maxPlayers} Players`
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Server</CardTitle>
      </CardHeader>
      <CardContent>
        {online && server ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-400" aria-hidden />
              Playing
            </p>
            <div>
              <p className="text-lg font-semibold leading-snug">
                {server.serverName}
              </p>
              {server.map ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {prettyMapName(server.map)}
                </p>
              ) : null}
              {playersLabel ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {playersLabel}
                </p>
              ) : null}
            </div>
            {server.connectUrl ? (
              <Button
                size="sm"
                className="w-full"
                render={<a href={server.connectUrl} />}
              >
                Join Server
                <ExternalLink data-icon="inline-end" />
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Not playing right now
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
