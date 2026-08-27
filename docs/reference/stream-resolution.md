# Stream resolution pipeline

The app's core pipeline turns a TMDB ID into a playable URL. It lives in `lib/streaming` as small pure-logic modules around the Torrentio fetch client.

```
tmdbId (+ season/episode for TV)
  │  lib/tmdb external_ids (cached ~30d)
  ▼
imdbId (tt…)
  │  Torrentio RD-configured endpoint (server-side; key never leaves the server)
  ▼
pre-filtered [RD+] streams - every one already cached, each with a resolve `url`
  │  pickCandidates() - our quality ranking, pure + unit-tested
  ▼
best stream's resolve url
  │  server follows the 302 (redirect NOT followed by the browser)
  ▼
final real-debrid.com URL (no credential in it)  ->  /api/stream response  ->  <video>
```

## Step 1: pre-filtered candidates from Torrentio

The app calls Torrentio's configured Stremio-addon JSON API; the config segment carries the Real-Debrid key and a quality filter:

```
https://torrentio.strem.fun/qualityfilter=cam,unknown|realdebrid=<RD_KEY>/stream/movie/{imdbId}.json
https://torrentio.strem.fun/qualityfilter=cam,unknown|realdebrid=<RD_KEY>/stream/series/{imdbId}:{season}:{episode}.json
```

The whole config string is a secret (it contains the Real-Debrid key). It stays server-side, read from env: never in client code, never logged, never in an error message. This is the same shape as `TMDB_API_READ_TOKEN`.

Why the configured endpoint rather than the plain `/stream/` list: Torrentio checks Real-Debrid cache status centrally and returns only survivors, marked `[RD+]`, each carrying a `url` that resolves through its own resolver. In practice that means dozens to hundreds of already-cached streams per title, whereas probing Real-Debrid directly with our own magnet adds got almost nothing accepted (see [real-debrid.md](real-debrid.md)). Streams come back with `url` and no `infoHash`, so `fileIdx`/season-pack file selection happens upstream: an episode request resolves the right file out of a full-season pack.

Etiquette/resilience: cache responses (~15 min), timeout ~8 s, one request per resolution, identifying User-Agent. Torrentio unreachable or empty means `PROVIDER_DOWN` / `NOT_FOUND`. For chronic degradation, see the fallback path section.

## Step 2: pickCandidates() heuristics

Parse each stream's title blob into `{ resolution, sizeBytes, seeders, source, codecHints }`, then:

1. Exclude: CAM/TS/screener; 3D (including `FS3D`); sub-720p; anything over ~12 GB for a movie or ~4 GB for an episode (hostile to TV browsers); HDR/DV/10-bit when an SDR alternative exists (TV browser compatibility); any non-English audio, including dual/multi releases that also list English (a native `<video>` element plays the container's default track, and Chrome/Firefox can't switch audio tracks, so a dual-audio release can come up speaking the wrong language); extras and featurette files (a "behind the episode" featurette can fuzzy-match episode numbers and would play instead of the episode); and trailer/teaser torrents named on the release line, because for a new title the only cached "stream" is sometimes a small trailer file, which would play in place of the movie. (The one exception: titles that contain the word, like *Trailer Park Boys*.)
2. Prefer, in descending order: 1080p, then 720p, then 2160p last (decode burden on weak devices); tier gaps are absolute. Next, BluRay-family sources (BluRay/BDRip/BRRip) rank strongly over WEB: Real-Debrid's content filter refuses WEB releases (WEB-DL/WEBRip/AMZN) at resolve time far more often than BluRay-family ones, so ranking WEB first burns resolve attempts on refusals (`BLOCK_PRONE_SOURCE_PENALTY` encodes this; background in [real-debrid.md](real-debrid.md)). Then higher seeders (log-scaled), H.264 over H.265/AV1 (broadest playback), and an MP4 container hint over MKV (a slight bias only: Chrome and Firefox both play H.264 MKV natively).
3. Movies only: prefer standalone releases. Drop multi-movie collections ("top 250" packs, "super pack" repacks) whenever any standalone release survives, the same pool-narrowing shape as the SDR/HDR rule. Those packs carry huge seeder counts and would otherwise sweep the top of the ranking, handing the viewer one file pulled out of a 250-movie bundle, often dubbed. Episode requests keep packs: season packs are how TV is released, and file selection upstream picks the episode.
4. Return the ranked shortlist, deduped on resolve `url` (the same release is listed by several indexers). When picks fail, the resolver walks further down the list in rounds, up to `MAX_RESOLVE_ATTEMPTS`; each attempt is one cheap GET with zero Real-Debrid API calls, so depth is affordable.

pickCandidates() is a pure function over parsed input, unit-tested against captured real Torrentio fixtures. Expect tuning against the deployment's actual catalog.

## Step 3: resolve to a playable URL

The picked stream's `url` points at `torrentio.strem.fun/resolve/realdebrid/<KEY>/<hash>/…`.

1. `GET` that URL server-side with redirect-following disabled.
2. Expect `302`; take the `Location` header, a `*.download.real-debrid.com` link with no credential in it, serving `Accept-Ranges: bytes` (seeking works).
3. Return only that final URL to the client.

Never hand the resolve URL to the browser: it embeds the Real-Debrid key. Only the post-redirect real-debrid.com link goes to the `<video>` element.

**The failure-video trap.** This check is not optional. `[RD+]` in the listing does not guarantee resolvability: Real-Debrid's content filter fires at *resolve* time, and when it does, Torrentio 302s to its own "blocked" clip on `torrentio.strem.fun` instead of Real-Debrid. Without a host assertion, that failure clip would play in place of the movie: a silent wrong-content bug, the worst kind for a non-technical viewer. The check: accept only `https` with a hostname ending in `.real-debrid.com` (leading dot, so `evil-real-debrid.com` and `real-debrid.com.evil.example` both fail), and treat a redirect back to Torrentio as a routine skip.

Resolution failures (non-302, 4xx/5xx, a redirect off Real-Debrid) move on to the next-ranked stream; exhausting the attempts returns `NOT_CACHED`. Torrents land in the owner's Real-Debrid account as a side effect, exactly as they do from Stremio. That's expected, not a leak.

## `/api/stream` contract

```
GET /api/stream?type=movie&tmdbId=693134
GET /api/stream?type=tv&tmdbId=1668&season=5&episode=14
GET /api/stream?...&fresh=1        # bypass the resolution cache
GET /api/stream?...&stream=<key>   # Switch Streams: resolve this exact stream, no picker, no cache

200 -> { url, key, filename, resolvedQuality, sizeBytes, releaseName }
4xx/5xx -> { error: <code> }

GET /api/stream/options?<same query>   # Switch Streams: every stream, unfiltered
200 -> { options: [{ key, releaseName, resolution, sizeBytes, seeders, provider, languageHints, recommended }] }
```

**Switch Streams.** `key` is an opaque 16-hex hash of the stream's Torrentio resolve url (`stream-key.ts`): the url embeds the Real-Debrid key and never leaves the server, and the hash lets the player name a stream anyway. `/options` lists every stream in Torrentio's own order, including everything the picker excludes (dual audio, packs, HDR, CAM and so on), with `recommended` marking the picker's shortlist. `stream=<key>` resolves that one stream (an unknown key is `NOT_FOUND`; a Real-Debrid refusal is `NOT_CACHED`, same as the automatic path) and is never written to the resolution cache: a manual pick is one sitting's choice, not the next Play's answer. A later `fresh=1` retry carries the same `stream=`, so a manual pick survives a stale-URL recovery.

| Code | Status | Means | Player should say |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | no/expired session | *(redirect to /login)* |
| `BAD_REQUEST` | 400 | malformed query | *(bug; generic message)* |
| `NOT_FOUND` | 404 | unknown tmdbId, or no IMDb id | "We couldn't find that one." |
| `NOT_CACHED` | 404 | nothing resolved after all attempts | "This one isn't ready right now - try another." |
| `PROVIDER_DOWN` | 503 | Torrentio unreachable | "Something's down right now - try again in a bit." |
| `INTERNAL` | 500 | unexpected | "Something went wrong." |

Notes that matter to the player:

- `401` bodies are identical whether the proxy or the handler rejects (`{ "error": "UNAUTHORIZED" }`), so there is one shape to handle.
- Query validation is a discriminated union: `season`/`episode` are required for `type=tv` and rejected for `type=movie`, so a malformed request can never silently resolve the wrong episode.
- Auth is re-verified in the handler (`requireApiUser`), not just at the proxy.
- `url` is short-lived and account-tied. Never persist it, never put it in a DB, never log it. Re-request with `fresh=1` on any playback error; that is the recovery path.
- Resolution cache: instance-local `Map`, TTL 10 min, keyed `type:tmdbId[:season:episode]`. Best-effort by design.

Typical timings (development, warm TMDB cache): movie cold resolve ~2.4 s, episode cold ~1.1 s, cache hit ~0.4 s, comfortably inside the target of under ~10 seconds from Play to video.

## Fallback path (documented, not primary)

Driving Real-Debrid directly (`addMagnet`, `selectFiles`, poll, `unrestrict`) was the original primary path and is now break-glass only: on real shortlists Real-Debrid accepted almost nothing, because its content filter refuses most mainstream hashes at add time (see [real-debrid.md](real-debrid.md)). The self-driven client was deleted outright. If Torrentio's resolver degrades, the better move is a self-hosted Torrentio/Comet/StremThru instance, which keeps the pre-filtering benefit and takes the key back in-house, rather than a return to blind probing.

## Playback compatibility (settled)

Direct play: native `<video>`, no HLS, no player library, no transcode. The supported browsers are Chrome and Firefox; Safari is out of scope.

- Chromium (Chrome/Edge, most smart-TV browsers): H.264/AAC in MKV or MP4 plays natively.
- Firefox plays MKV natively since Firefox 145 (November 2025): `media.mkv.enabled` is on by default, covering H.264/HEVC/VP8/VP9/AV1 with AAC/Opus/Vorbis.
- Safari: still no MKV. It's out of scope here, and the reason the transcode fallback stays documented rather than deleted.
- Resolved URLs serve `Accept-Ranges: bytes`, so seeking works on a plain `<video>` element.
- H.265/HEVC: fine on modern desktop, patchy on weak TV hardware, which is why the picker keeps its H.264 bias.

Break-glass if a TV browser ever chokes: Real-Debrid `/streaming/transcode/{id}` for HLS via hls.js. Proven to work (Real-Debrid's own web player does exactly this), but unnecessary for the devices actually in use. It would also be the likely answer if subtitles are ever added.
