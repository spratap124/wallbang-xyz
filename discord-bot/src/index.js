import { Client, GatewayIntentBits, Partials } from "discord.js";

import { config } from "./config.js";
import {
  registerGuildMemberAdd,
  registerReadyLog,
} from "./events/guildMemberAdd.js";
import { registerRoleSync } from "./roleSync.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.GuildMember],
});

registerReadyLog(client, config);
registerGuildMemberAdd(client, config);
registerRoleSync(client, config);

client.on("error", (err) => {
  console.error("[bot] Client error", err);
});

process.on("unhandledRejection", (err) => {
  console.error("[bot] Unhandled rejection", err);
});

await client.login(config.token);
