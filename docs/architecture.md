# Architecture

## System overview

```
                        ┌─────────────────────────────────────────────┐
                        │                 Vercel                      │
 Viewer's browser ────► │  Next.js (App Router)                       │
                        │                                             │
                        │  Server Components / Route Handlers         │
                        │  ├── lib/tmdb        ──────► TMDB API       │
                        │  ├── lib/streaming   ──┬───► Torrentio JSON │
                        │  │   (resolver)        └───► Torrentio (302)│
                        │  └── lib/supabase    ──────► Supabase       │
                        │                              (auth + db)    │
                        └─────────────────────────────────────────────┘

 Video bytes flow DIRECTLY from Real-Debrid's CDN to the Viewer's browser
 (the resolved URL is handed to the <video> element). Vercel never
 proxies video traffic.
```

All third-party calls happen **server-side**. The browser only ever talks to our own app, Supabase (auth session), TMDB's image CDN (`image.tmdb.org`), and the final Real-Debrid stream URL.

## Request flows

### Browse

1. The Server Component for `/browse` calls `lib/tmdb` list functions (trending, discover-by-genre, etc.).
2. The app caches TMDB responses via Next.js fetch caching (`revalidate` between 1 and 24 hours per list type; details in [tmdb.md](reference/tmdb.md)).
3. Rows render server-side; hover cards/detail modal hydrate client-side.

### Play

1. The client (watch page) calls our authed route: `GET /api/stream?type=movie&tmdbId=...` (or `type=tv` + season/episode).
2. The route handler verifies the Supabase session and rejects anonymous requests.
3. `lib/streaming` maps the TMDB ID to an IMDb ID, queries Torrentio's Real-Debrid-configured endpoint for pre-filtered `[RD+]` cached candidates, picks the best one, then follows Torrentio's resolve 302 to a credential-free `real-debrid.com` URL. The app never adds magnets to the Real-Debrid account itself. Full pipeline: [stream-resolution.md](reference/stream-resolution.md).
4. The route returns the URL to the client, and the player sets it as the `<video>` source. Playback is direct play only, with no HLS or transcode fallback (Chrome and Firefox are the only supported browsers). On a `<video>` error the player re-resolves once with `fresh=1`.

### Progress

The player posts position beats (throttled to roughly every 15 seconds, plus on pause/leave) to `POST /api/progress`, an authed route handler that upserts `watch_progress` in Supabase under RLS. It's a route, not a server action, so tab-close beats can ride `keepalive`/`sendBeacon`. Watch pages read the saved position server-side to resume; Play entry points resolve a show's in-progress episode through a client provider seeded from the same rows.

## Module layout

```
src/
  app/
    login/                   # sign-in
    profiles/                # "Who's watching?"
    (app)/                   # signed-in area
      (browse)/              # chrome group: shared Header/Footer layout
        browse/              # home rows + hero billboard (+ actions.ts server actions)
        movies/  tv/         # media-type-scoped row pages
        my-list/             # saved-titles grid
        search/              # live search results grid
        account/password/    # in-app password change (no email flow; supabase.md)
      watch/                 # chrome-free player pages: movie/[tmdbId], tv/[tmdbId]/[season]/[episode]
    api/stream/              # stream resolution endpoint (authed)
    api/progress/            # watch-progress beats (authed)
    layout.tsx  globals.css
  components/
    layout/                  # nav header, footer
    browse/                  # billboard, slider row, hover card, detail modal
    profiles/                # profile avatar
    watch/                   # video element wrapper, player controls
  hooks/                     # shared React hooks
  lib/
    tmdb/                    # client + typed endpoint functions + row config
    streaming/               # torrentio client, candidate picker, resolver
    supabase/                # client.ts, server.ts, middleware helpers (per @supabase/ssr)
    progress/                # pure progress rules: continue watching, next episode
    db/                      # typed queries: progress, my-list, profiles
  proxy.ts                   # session refresh + route protection (Next 16's renamed middleware convention)
```

Services (`lib/*`) are plain typed functions; no classes needed. Each external service gets a thin fetch client (auth header, base URL, error normalization), typed response schemas (zod) at the boundary, and pure logic separated from I/O (e.g. candidate picking is a pure function, so it unit-tests cleanly).

## Security model

| Concern | Handling |
|---|---|
| Who can browse/play | Supabase session required; `proxy.ts` guards pages as convenience, every protected page/handler re-verifies server-side (`requireUser()`) |
| Account creation | Disabled in Supabase dashboard; users created by hand (no signups) |
| TMDB token / Torrentio config (embeds the Real-Debrid key) | Server-only env vars; never `NEXT_PUBLIC_`; never logged |
| Data isolation | Postgres RLS: rows keyed to `auth.uid()` |
| Stream endpoint abuse | Auth required + Real-Debrid's own 250 req/min ceiling; resolver caches recent resolutions in-memory per instance |
| Search engines | `robots.txt` disallow all + `noindex` |

## Caching strategy

- **TMDB lists**: Next fetch cache, revalidate 1 h (trending) to 24 h (genre/discover). Detail lookups 24 h.
- **TMDB to IMDb ID mapping**: effectively immutable, so it gets a long cache.
- **Stream resolutions**: short-lived server cache (a few minutes) keyed by title/episode. Real-Debrid unrestricted links are session-ish; don't persist them long term. Re-resolve on playback error.
- **Images**: TMDB CDN + `next/image` with `image.tmdb.org` in `remotePatterns`.

## Key constraints (as of August 2026)

- Real-Debrid removed `/torrents/instantAvailability`: there is **no** bulk "is it cached?" check, and blind add-and-probe gets almost nothing accepted. Cached-ness comes from Torrentio's Real-Debrid-configured endpoint instead (see [stream-resolution.md](reference/stream-resolution.md)).
- Real-Debrid rate limit: 250 requests/min per token.
- Chromium and Firefox 145+ (November 2025) both play H.264/AAC Matroska natively, verified with real Real-Debrid streams, so direct play is the only path. Safari is out of scope by design.
- Supabase SSR requires the request-interceptor token-refresh pattern from the `@supabase/ssr` docs, implemented in `src/proxy.ts` (**Next 16 renamed `middleware.ts` to `proxy.ts`**) exactly per their current guide, not from memory.
