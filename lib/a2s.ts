import "server-only";

import dgram from "node:dgram";
import { performance } from "node:perf_hooks";

/**
 * Minimal A2S_INFO client for Source engine servers (CS2).
 *
 * A single A2S_INFO query returns hostname, current map, player and bot counts,
 * and max players in one UDP packet. The round-trip time of that query is our
 * "server latency" metric. Modern Source servers gate the request behind a
 * challenge (0x41) that must be echoed back, which this handles.
 *
 * Requires the Node.js runtime — `node:dgram` is unavailable on the Edge runtime.
 */

const A2S_INFO_HEADER = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]);
const A2S_INFO_PAYLOAD = Buffer.from("Source Engine Query\0", "ascii");
const REQUEST = Buffer.concat([A2S_INFO_HEADER, A2S_INFO_PAYLOAD]);

const RESPONSE_INFO = 0x49; // 'I'
const RESPONSE_CHALLENGE = 0x41; // 'A'

export type A2SInfoResult =
  | {
      online: true;
      name: string;
      map: string;
      folder: string;
      game: string;
      players: number;
      maxPlayers: number;
      bots: number;
      pingMs: number;
    }
  | { online: false };

function readCString(buf: Buffer, start: number): { value: string; next: number } {
  const end = buf.indexOf(0x00, start);
  if (end === -1) {
    return { value: buf.toString("utf8", start), next: buf.length };
  }
  return { value: buf.toString("utf8", start, end), next: end + 1 };
}

function parseInfo(data: Buffer, pingMs: number): A2SInfoResult {
  // Layout after the 4-byte 0xFFFFFFFF prefix:
  //   [4] header (0x49) · [5] protocol · name\0 · map\0 · folder\0 · game\0
  //   appid(int16) · players(u8) · maxPlayers(u8) · bots(u8) · ...
  let i = 6; // skip 0xFFFFFFFF (4) + header (1) + protocol (1)

  const name = readCString(data, i);
  i = name.next;
  const map = readCString(data, i);
  i = map.next;
  const folder = readCString(data, i);
  i = folder.next;
  const game = readCString(data, i);
  i = game.next;

  i += 2; // appid (int16)

  const players = data[i++];
  const maxPlayers = data[i++];
  const bots = data[i++];

  return {
    online: true,
    name: name.value,
    map: map.value,
    folder: folder.value,
    game: game.value,
    players,
    maxPlayers,
    bots,
    pingMs,
  };
}

export async function queryA2SInfo(
  host: string,
  port: number,
  timeoutMs = 2000,
): Promise<A2SInfoResult> {
  const socket = dgram.createSocket("udp4");
  const t0 = performance.now();

  const sendAndReceive = (payload: Buffer) =>
    new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);

      const onMessage = (msg: Buffer) => {
        clearTimeout(timer);
        socket.off("error", onError);
        resolve(msg);
      };
      const onError = (err: Error) => {
        clearTimeout(timer);
        socket.off("message", onMessage);
        reject(err);
      };

      socket.once("message", onMessage);
      socket.once("error", onError);
      socket.send(payload, port, host, (err) => {
        if (err) {
          clearTimeout(timer);
          socket.off("message", onMessage);
          socket.off("error", onError);
          reject(err);
        }
      });
    });

  try {
    let data = await sendAndReceive(REQUEST);

    // Challenge response: re-send with the 4 challenge bytes appended.
    if (data[4] === RESPONSE_CHALLENGE) {
      const challenge = data.subarray(5, 9);
      data = await sendAndReceive(Buffer.concat([REQUEST, challenge]));
    }

    if (data[4] !== RESPONSE_INFO) {
      return { online: false };
    }

    return parseInfo(data, Math.round(performance.now() - t0));
  } catch {
    return { online: false };
  } finally {
    socket.close();
  }
}
