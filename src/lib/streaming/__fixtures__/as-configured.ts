// Test-only adapter: the Aug 2026 captures in this directory came from the
// PLAIN Torrentio endpoint (infoHash-keyed). The app has since moved to the
// configured endpoint, whose streams carry a resolve `url` and no infoHash -
// and capturing that shape for real would bake the RD key into a fixture, so
// the captures stay as-is and tests adapt them with this helper instead.
//
// The synthetic url is derived from infoHash+fileIdx, mirroring the real
// resolver urls' identity: the same torrent relisted by several indexers maps
// to the same url, which is what pick-candidates' dedupe now keys on.

type PlainCapturedStream = {
  infoHash?: unknown;
  fileIdx?: unknown;
  name?: unknown;
  title?: unknown;
};

export function asConfiguredStreams(streams: unknown[]): unknown[] {
  return streams.map((stream) => {
    const { infoHash, fileIdx, name, title } = stream as PlainCapturedStream;
    return {
      name,
      title,
      url: `https://torrentio.example/fake-resolve/${String(infoHash)}/${fileIdx ?? "null"}`,
    };
  });
}
