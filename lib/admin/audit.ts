import type { GameServerAdminView } from "@/types/servers";

/** Compact server fields stored in audit oldValue/newValue. */
export function serverAuditSnapshot(
  server: Pick<
    GameServerAdminView,
    | "id"
    | "name"
    | "shortName"
    | "host"
    | "port"
    | "enabled"
    | "featured"
    | "map"
    | "mode"
  >,
): Record<string, unknown> {
  return {
    id: server.id,
    name: server.name,
    shortName: server.shortName,
    host: server.host,
    port: server.port,
    enabled: server.enabled,
    featured: server.featured,
    map: server.map,
    mode: server.mode,
  };
}
