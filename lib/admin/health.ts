import "server-only";

import { getDb, isMongoConfigured } from "@/lib/mongo";
import { getLiveServers } from "@/lib/servers/status";
import { getGameServers } from "@/lib/servers/registry";
import type {
  AdminHealthCheck,
  AdminHealthResponse,
  AdminHealthStatus,
} from "@/types/profile";

async function checkDatabase(): Promise<AdminHealthCheck> {
  if (!isMongoConfigured()) {
    return {
      id: "database",
      label: "Database",
      status: "down",
      detail: "MongoDB is not configured",
      value: "0%",
    };
  }

  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return {
      id: "database",
      label: "Database",
      status: "ok",
      detail: "All systems operational",
      value: "100%",
    };
  } catch {
    return {
      id: "database",
      label: "Database",
      status: "down",
      detail: "Unable to reach MongoDB",
      value: "0%",
    };
  }
}

async function checkGameServers(): Promise<AdminHealthCheck> {
  try {
    const [fleet, live] = await Promise.all([
      getGameServers({ includeDisabled: false }),
      getLiveServers().catch(() => []),
    ]);
    const total = fleet.length;
    const online = live.filter((s) => s.online).length;

    if (total === 0) {
      return {
        id: "game_servers",
        label: "Game Servers",
        status: "degraded",
        detail: "No enabled servers in registry",
        value: "0/0",
      };
    }

    let status: AdminHealthStatus = "ok";
    let detail = "All servers are online";
    if (online === 0) {
      status = "down";
      detail = "No game servers reachable";
    } else if (online < total) {
      status = "degraded";
      detail = `${online} of ${total} servers online`;
    }

    return {
      id: "game_servers",
      label: "Game Servers",
      status,
      detail,
      value: `${online}/${total}`,
    };
  } catch {
    return {
      id: "game_servers",
      label: "Game Servers",
      status: "down",
      detail: "Failed to query game servers",
      value: "—",
    };
  }
}

async function checkDiscordBot(): Promise<AdminHealthCheck> {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) {
    return {
      id: "discord_bot",
      label: "Discord Bot",
      status: "degraded",
      detail: "Bot token not configured",
      value: "—",
    };
  }

  try {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (res.ok) {
      return {
        id: "discord_bot",
        label: "Discord Bot",
        status: "ok",
        detail: "Connected and responsive",
        value: "100%",
      };
    }
    return {
      id: "discord_bot",
      label: "Discord Bot",
      status: "down",
      detail: `Discord API returned ${res.status}`,
      value: "0%",
    };
  } catch {
    return {
      id: "discord_bot",
      label: "Discord Bot",
      status: "down",
      detail: "Unable to reach Discord API",
      value: "0%",
    };
  }
}

function overallFrom(
  checks: AdminHealthCheck[],
): AdminHealthResponse["overall"] {
  if (checks.some((c) => c.status === "down")) return "down";
  if (checks.some((c) => c.status === "degraded")) return "degraded";
  return "operational";
}

export async function getAdminHealth(): Promise<AdminHealthResponse> {
  const [gameServers, database, discordBot] = await Promise.all([
    checkGameServers(),
    checkDatabase(),
    checkDiscordBot(),
  ]);

  const checks: AdminHealthCheck[] = [
    gameServers,
    {
      id: "web_api",
      label: "Web API",
      status: "ok",
      detail: "API is running normally",
      value: "100%",
    },
    database,
    discordBot,
  ];

  return {
    overall: overallFrom(checks),
    checkedAt: new Date().toISOString(),
    checks,
  };
}
