# TMDB reference

Checked against the TMDB developer docs, August 2026. Base URL: `https://api.themoviedb.org/3`

## Auth

Use the **API Read Access Token** (Settings, then API, then "API Read Access Token"; it's the long JWT) as `Authorization: Bearer <token>` on every request. TMDB recommends this method; never use the `api_key` query param, which leaks into URLs and logs. The token stays server-side, as `TMDB_API_READ_TOKEN`.

You get one once, when you create your TMDB account: on themoviedb.org, go to Settings, then API, request a key for personal use, and copy the Read Access Token (not the short v3 key).

## Endpoints we use

| Purpose | Endpoint | Notes |
|---|---|---|
| Trending row | `GET /trending/all/week` | mixed movie+TV |
| Genre rows | `GET /discover/movie?with_genres=<id>&sort_by=popularity.desc` | see genre IDs below |
| TV rows | `GET /discover/tv?with_genres=<id>` | |
| Billboard candidate | pick from trending/popular results | needs `backdrop_path` |
| Movie detail | `GET /movie/{id}?append_to_response=external_ids,credits,recommendations,videos,release_dates` | one call, everything; `recommendations`, never `similar` (see below) |
| TV detail | `GET /tv/{id}?append_to_response=external_ids,credits,recommendations,videos,content_ratings` | |
| Season/episodes | `GET /tv/{id}/season/{n}` | episode list for modal |
| Search | `GET /search/multi?query=...` | filter out `media_type: "person"` |
| IMDb mapping | `external_ids.imdb_id` (from append) or `GET /{type}/{id}/external_ids` | needed by resolver |

`append_to_response` is the efficiency lever: always batch detail sub-requests into one call.

## Genre IDs (stable, hardcodeable in row config)

Movies: Comedy 35, Horror 27, Thriller 53, Romance 10749, Family 10751, Crime 80, Drama 18, Mystery 9648.

TV: Comedy 35, Drama 18, Crime 80, Mystery 9648, Reality 10764. Careful: TV has no Horror genre, because the TMDB TV taxonomy lacks one. For a Horror-TV flavor, use `discover/tv` with horror **keyword** IDs, or accept movie-only for the Horror row. Note this in the row config; don't "fix" it by inventing genre 27 for TV (it returns junk).

## Images

Image URLs are `https://image.tmdb.org/t/p/{size}{path}` and need no auth. Sizes: posters `w342`/`w500`, backdrops `w1280`/`original`, avatars `w185`. Add `image.tmdb.org` to `next/image` `remotePatterns`. A missing `poster_path` is common on obscure titles, so always handle null (skip or placeholder).

## Response shape gotchas

- Movies have `title`/`release_date`; TV has `name`/`first_air_date`. Normalize into our own `Title` type at the boundary (a zod transform); don't leak the union through the app.
- `media_type` is present in trending and search results but absent in discover results, where the endpoint already tells you the type.
- Ratings: `vote_average` is a 0-10 float. US certification requires the `release_dates` (movies) or `content_ratings` (TV) append and feeds the maturity chip.

## Rate limits and caching

TMDB tolerates roughly 50 req/s, which is irrelevant at household scale, but cache anyway for freshness, latency, and resilience. Use Next `fetch` with `next: { revalidate }`: trending 3600 s, discover/genre 86400 s, details/season 86400 s, external_ids 30 d. Search is never cached (`no-store`).

## Related titles: `recommendations`, never `similar`

TMDB has two "related" endpoints and they are not interchangeable. `similar` is keyword/genre matching, and it produces exactly the kind of nonsense you'd expect: for a recent horror sequel it returned over a hundred thousand results, led by unrelated titles that merely shared a "sequel" keyword. `recommendations` is behavior-based and is what TMDB's own site renders: for the same title it returned the rest of the franchise, then genuinely adjacent horror. Both append to the detail call with identical summary shapes, so using the right one is free. The More Like This section uses `recommendations`, and should stay that way.
