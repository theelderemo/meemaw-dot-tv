# Real-Debrid API reference

Checked against `https://api.real-debrid.com/` docs, August 2026. Base: `https://api.real-debrid.com/rest/1.0`

## Auth

Real-Debrid issues a private API token at `https://real-debrid.com/apitoken`. The app no longer calls the Real-Debrid REST API directly and reads no Real-Debrid token env var; the token travels only inside `TORRENTIO_CONFIG` (see [stream-resolution.md](stream-resolution.md)). The OAuth device flow isn't used; this is a single-owner account. Real-Debrid notes that tokens can require refresh: if resolution starts failing wholesale, regenerate the token at `real-debrid.com/apitoken` and rebuild `TORRENTIO_CONFIG` with the new key. The REST endpoints below (sent as `Authorization: Bearer <token>`) document the fallback path only.

## Removed endpoint: do not use

`GET /torrents/instantAvailability` no longer exists (removed by Real-Debrid; confirmed absent from current docs). Any tutorial or library using it is stale. There is no bulk "is this hash cached?" check anymore. You find out whether a hash is cached by adding the magnet: a cached torrent reports `status: "downloaded"` immediately after file selection. (Separately, even a genuinely cached torrent may be refused outright by the content filter; see below.)

## The content filter

In May 2026 Real-Debrid activated a content filter on cached torrents, a permanent measure driven by DSA and French-law compliance. Community estimates say it removed somewhere between half and two-thirds of previously cached mainstream content. The entire stream-resolution design follows from this one fact.

How it behaves, from testing against the live API:

- At `addMagnet` time, refusals arrive as `451 {"error":"infringing_file","error_code":35}`, keyed to the hash. The pattern here is messy: BluRay and WEB releases alike get refused, and occasionally a hash passes that "should" have failed. Treat it as per-hash blocklisting with a heavy bias against mainstream titles, not a reliable filename heuristic. Handle a 451 as skip-this-candidate (`RD_REJECTED`), never as an auth or rate error, and never retry it.
- At resolve time (via Torrentio), the pattern is much cleaner: WEB releases (WEB-DL/WEBRip/AMZN) are refused far more often than BluRay-family releases (BluRay/BDRip/BRRip), reliably enough that the candidate picker penalizes WEB sources outright (`BLOCK_PRONE_SOURCE_HINTS` in `lib/streaming`). Trust the pattern at resolve time; don't use it to explain an `addMagnet` refusal.
- Magnet format doesn't matter. Pass or fail depends on the *hash*, not on whether the magnet carries `dn`/`tr` parameters. Dressing magnets is still harmless and helps peer discovery for non-cached adds, so keep it, but never explain a 451 with it.
- Blind probing is not viable. Feeding quality-ranked shortlists straight to `addMagnet` gets almost nothing accepted for mainstream titles. This is why the app resolves through Torrentio's pre-filtered endpoint instead of driving Real-Debrid itself.
- How Stremio/Kodi setups still "just work": the community addons (Comet, AIOStreams, MediaFusion, StremThru, hosted Torrentio variants) filter out `infringing_file` results before showing them, so the user only ever sees survivors. Same accounts, same filter; the addon hides the losers. A plain unconfigured `/stream/` list is unfiltered, which is why survivor selection has to happen somewhere.

One strategic consequence: a real fraction of mainstream titles simply aren't resolvable on Real-Debrid anymore. Some other debrid services have no such filter. `lib/streaming` isolates the debrid layer, so an adapter for a different service behind the same resolver interface is a clean option if Real-Debrid's catalog proves too thin in practice.

## Endpoints (fallback path)

| Step | Call | Notes |
|---|---|---|
| Add | `POST /torrents/addMagnet` (`magnet=...`) | returns `{ id, uri }` |
| Inspect | `GET /torrents/info/{id}` | returns `status`, `files[]` (id, path, bytes), `links[]`, `progress` |
| Select | `POST /torrents/selectFiles/{id}` (`files=1,2` or `all`) | pick the video file(s) only |
| Re-inspect | `GET /torrents/info/{id}` | cached: `status: "downloaded"` with `links[]` populated, near-instantly |
| Unrestrict | `POST /unrestrict/link` (`link=<links[n]>`) | returns `{ download }`, the direct HTTPS URL for `<video>` |
| Cleanup | `DELETE /torrents/delete/{id}` | remove non-cached adds we abandon |
| Transcode (fallback) | `GET /streaming/transcode/{id}` | HLS/quality variants for an unrestricted file |
| Media info | `GET /streaming/mediaInfos/{id}` | container/codec/track details, useful for subtitle + compatibility logic |
| Slots | `GET /torrents/activeCount` | guard: Real-Debrid caps concurrent active (non-downloaded) torrents |

`status` values worth handling: `magnet_conversion`, `waiting_files_selection`, `queued`, `downloading`, `downloaded`, `error`, `magnet_error`, `virus`, `dead`.

## Cached-detection pattern (replaces instantAvailability)

1. `addMagnet`, then `selectFiles` (largest video file).
2. Poll `info` briefly (2-3 polls over ~3 s).
3. `downloaded` means cached: unrestrict `links[0]` and return.
4. Anything stuck in `queued`/`downloading` is not cached: `DELETE` the torrent and try the next candidate.

Never leave abandoned torrents accumulating; always delete non-cached attempts (active-slot limits).

## Limits & behavior

- 250 requests/min per token; 429 responses also count toward the limit, and repeated abuse blocks the account. A fallback resolver would make no more than ~10 calls per playback, which is fine, but never build retry storms.
- Unrestricted `download` URLs are tied to the account and not permanent. Treat them as short-lived: resolve at play time, re-resolve on player error, and don't store them in a database.
- Error body shape: `{ error, error_code }` with HTTP 4xx. Normalize it in the client.
