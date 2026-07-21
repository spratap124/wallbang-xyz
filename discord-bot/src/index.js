import { Client, GatewayIntentBits, Partials } from "discord.js";

import { config } from "./config.js";
import {
  registerGuildMemberAdd,
  registerReadyLog,
} from "./events/guildMemberAdd.js";
import { registerMessageCreate } from "./events/messageCreate.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.GuildMember],
});

registerReadyLog(client, config);
registerGuildMemberAdd(client, config);
registerMessageCreate(client, config);

client.on("error", (err) => {
  console.error("[bot] Client error", err);
});

process.on("unhandledRejection", (err) => {
  console.error("[bot] Unhandled rejection", err);
});

await client.login(config.token);
