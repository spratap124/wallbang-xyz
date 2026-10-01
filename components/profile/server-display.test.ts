import assert from "node:assert/strict";
import test from "node:test";

import {
  formatMapName,
  formatServerLocation,
  selectRetakeServers,
} from "@/components/profile/server-display";
import type { ServerSummary } from "@/lib/servers/types";

function server(
  overrides: Partial<ServerSummary> & Pick<ServerSummary, "id" | "name" | "mode">,
): ServerSummary {
  return {
    ip: "127.0.0.1:27015",
    region: "Mumbai, India",
    city: "Mumbai",
    online: true,
    map: "de_mirage",
    players: 1,
    maxPlayers: 10,
    pingUrl: null,
    lastSeen: null,
    ...overrides,
  };
}

test("retake rows are server instances and maps stay metadata", () => {
  const rows = selectRetakeServers([
    server({
      id: "retake-1",
      name: "WallBang Retake #1",
      mode: "Retakes",
      map: "de_mirage",
    }),
    server({
      id: "retake-2",
      name: "WallBang Retake #2",
      mode: "Retakes",
      map: "de_inferno",
      players: 5,
    }),
  ]);

  assert.deepEqual(
    rows.map((row) => row.id),
    ["retake-1", "retake-2"],
  );
  assert.equal(formatMapName(rows[0]?.map), "Mirage");
  assert.equal(formatMapName(rows[1]?.map), "Inferno");
  assert.equal(rows[0]?.name, "WallBang Retake #1");
});

test("non-retake modes are omitted when the fleet has retake servers", () => {
  const rows = selectRetakeServers([
    server({ id: "retake-1", name: "WallBang Retake #1", mode: "Retakes" }),
    server({ id: "dm-1", name: "Deathmatch", mode: "Deathmatch", map: "de_dust2" }),
  ]);

  assert.deepEqual(
    rows.map((row) => row.id),
    ["retake-1"],
  );
});

test("location uses registry city and region", () => {
  assert.equal(
    formatServerLocation({ city: "Mumbai", region: "Mumbai, India" }),
    "Mumbai, India",
  );
  assert.equal(
    formatServerLocation({ city: "Mumbai", region: "India" }),
    "India (Mumbai)",
  );
  assert.equal(formatServerLocation({ city: "", region: "" }), null);
});
