import { createHash } from "node:crypto";

// Opaque client-facing handle for one Torrentio stream. The resolve url it
// hashes EMBEDS THE RD KEY (torrentio.ts) and must never leave the server -
// the hash lets the player name a stream ("switch to this one") without ever
// seeing it. 16 hex chars: no collisions within one title's ~200 streams.
export const STREAM_KEY_PATTERN = /^[0-9a-f]{16}$/;

export function streamKey(resolveUrl: string): string {
  return createHash("sha256").update(resolveUrl).digest("hex").slice(0, 16);
}
