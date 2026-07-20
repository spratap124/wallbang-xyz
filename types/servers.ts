import type { GameServer } from "@/config/servers";

export type GameServerStatus = GameServer["status"];

/** Persisted fleet row in Mongo `game_servers`. */
export type GameServerDoc = {
  _id: string;
  id: string;
  name: string;
  shortName: string;
  mode: string;
  map: string;
  region: string;
  city: string;
  host: string;
  port: number;
  tickRate: number;
  maxPlayers: number;
  maxPlayersOverride?: number | null;
  pingUrl?: string | null;
  status: GameServerStatus;
  featured: boolean;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Runtime fleet entry used by A2S, presence, and admin. */
export type RegisteredServer = GameServer & {
  enabled: boolean;
  featured: boolean;
};

export type CreateGameServerInput = {
  id: string;
  name: string;
  shortName: string;
  mode: string;
  map: string;
  region: string;
  city: string;
  host: string;
  port: number;
  tickRate?: number;
  maxPlayers: number;
  maxPlayersOverride?: number | null;
  pingUrl?: string | null;
  status?: GameServerStatus;
  featured?: boolean;
  enabled?: boolean;
};

export type UpdateGameServerInput = Partial<
  Omit<CreateGameServerInput, "id">
>;

/** Admin API JSON shape (dates as ISO strings). */
export type GameServerAdminView = Omit<
  GameServerDoc,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};
