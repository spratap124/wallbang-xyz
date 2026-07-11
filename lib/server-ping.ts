import dgram from "node:dgram";

const A2S_INFO_HEADER = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]); // T
const A2S_INFO_PAYLOAD = Buffer.from("Source Engine Query\0", "ascii");
const A2S_INFO = Buffer.concat([A2S_INFO_HEADER, A2S_INFO_PAYLOAD]);

/**
 * Measures RTT to a Source/CS2 game server via A2S_INFO (UDP).
 * Called from a Vercel Node function near the user for an approximate path RTT.
 */
export function measureSourceServerLatency(
  host: string,
  port: number,
  timeoutMs = 2500,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    let settled = false;
    let start = 0;

    const finish = (error?: Error, value?: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // ignore
      }
      if (error) reject(error);
      else resolve(value as number);
    };

    const timer = setTimeout(() => finish(new Error("Ping timed out")), timeoutMs);

    socket.on("error", (error) => finish(error));

    socket.on("message", (message) => {
      if (message.length < 5) return;

      // Challenge response: 0x41
      if (message[4] === 0x41 && message.length >= 9) {
        const challenge = message.subarray(5, 9);
        const challenged = Buffer.concat([A2S_INFO, challenge]);
        start = performance.now();
        socket.send(challenged, port, host, (error) => {
          if (error) finish(error);
        });
        return;
      }

      // Info response: 0x49 (or goldsource 0x6D)
      if (message[4] === 0x49 || message[4] === 0x6d) {
        const elapsed = Math.max(1, Math.round(performance.now() - start));
        finish(undefined, elapsed);
      }
    });

    start = performance.now();
    socket.send(A2S_INFO, port, host, (error) => {
      if (error) finish(error);
    });
  });
}
