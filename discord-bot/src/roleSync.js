export function registerRoleSync(client, config) {
  const managedRoles = [
    ["VIP", config.vipRoleId],
    ["Top 10", config.topTenRoleId],
  ].filter(([, roleId]) => roleId);

  if (managedRoles.length === 0) {
    console.log("[role-sync] No Discord role IDs configured; role sync disabled");
    return;
  }
  if (!config.pluginApiKey) {
    console.warn("[role-sync] PLUGIN_API_KEY missing; role sync disabled");
    return;
  }

  let syncing = false;
  const removeManagedName = (name) =>
    name
      .replace(/\s+\|\s+WallBang$/i, "")
      .replace(/^\[VIP\]\s*/i, "")
      .replace(/\s+#(?:[1-9]|10)$/, "")
      .trim();
  const formatManagedName = (name, isVip, rank) => {
    const prefix = isVip ? "[VIP] " : "";
    const rankSuffix = rank ? ` #${rank}` : "";
    const brandSuffix = " | WallBang";
    const availableLength = Math.max(
      1,
      32 - prefix.length - rankSuffix.length - brandSuffix.length,
    );
    const base = removeManagedName(name).slice(0, availableLength).trimEnd();
    return `${prefix}${base || "Player"}${rankSuffix}${brandSuffix}`;
  };

  const sync = async () => {
    if (syncing) return;
    syncing = true;
    try {
      const response = await fetch(
        `${config.siteUrl}/api/v1/discord/role-sync`,
        { headers: { "X-API-Key": config.pluginApiKey } },
      );
      const envelope = await response.json().catch(() => null);
      if (!response.ok || envelope?.ok !== true) {
        throw new Error(`WallBang role-sync API returned ${response.status}`);
      }

      const vipIds = new Set(envelope.data?.vipDiscordUserIds);
      const topTenIds = new Set(envelope.data?.topTenDiscordUserIds);
      const rankByDiscordId = new Map(
        (envelope.data?.topTenMembers ?? []).map((entry) => [
          entry.discordUserId,
          entry.rank,
        ]),
      );
      if (
        [...vipIds, ...topTenIds].some(
          (id) => typeof id !== "string" || !/^\d{17,20}$/.test(id),
        )
        || [...rankByDiscordId].some(
          ([id, rank]) =>
            typeof id !== "string" ||
            !/^\d{17,20}$/.test(id) ||
            !Number.isInteger(rank) ||
            rank < 1 ||
            rank > 10,
        )
      ) {
        throw new Error("WallBang role-sync API returned invalid Discord IDs");
      }

      const guild = await client.guilds.fetch(config.guildId);
      const [roles, members] = await Promise.all([
        Promise.all(
          managedRoles.map(async ([label, roleId]) => {
            const role = await guild.roles.fetch(roleId);
            if (!role) throw new Error(`Configured ${label} role was not found`);
            if (!role.editable) {
              throw new Error(
                `Bot cannot manage the ${label} role; move it below the bot role`,
              );
            }
            return { label, role };
          }),
        ),
        guild.members.fetch(),
      ]);

      let changes = 0;
      let nicknameChanges = 0;
      for (const member of members.values()) {
        if (member.user.bot) continue;
        const isVip = vipIds.has(member.id);
        const rank = rankByDiscordId.get(member.id) ?? null;
        const isTopTen = topTenIds.has(member.id);
        const currentName = member.displayName;
        const nickname = formatManagedName(currentName, isVip, rank);
        if (nickname !== member.nickname) {
          if (!member.manageable) {
            console.warn(
              `[role-sync] Cannot brand nickname for ${member.id}; move the bot role above this member`,
            );
          } else {
            try {
              await member.setNickname(nickname, "WallBang community name and rank sync");
              nicknameChanges += 1;
            } catch (err) {
              console.warn(
                `[role-sync] Could not update nickname for ${member.id}; check Manage Nicknames and role hierarchy`,
                err,
              );
            }
          }
        }
        for (const { label, role } of roles) {
          const shouldHaveRole = label === "VIP" ? isVip : isTopTen;
          const hasRole = member.roles.cache.has(role.id);
          if (shouldHaveRole === hasRole) continue;
          try {
            if (shouldHaveRole) {
              await member.roles.add(role, "WallBang role sync");
            } else {
              await member.roles.remove(role, "WallBang role sync");
            }
            changes += 1;
          } catch (err) {
            console.warn(
              `[role-sync] Could not ${shouldHaveRole ? "add" : "remove"} ${label} for ${member.id}`,
              err,
            );
          }
        }
      }
      console.log(
        `[role-sync] Completed; ${changes} role change(s), ${nicknameChanges} nickname change(s)`,
      );
    } catch (err) {
      console.error("[role-sync] Reconciliation failed", err);
    } finally {
      syncing = false;
    }
  };

  client.once("ready", () => {
    void sync();
    const timer = setInterval(() => void sync(), config.roleSyncIntervalMs);
    timer.unref?.();
    console.log(
      `[role-sync] Running every ${Math.round(config.roleSyncIntervalMs / 60_000)} minute(s)`,
    );
  });
}
