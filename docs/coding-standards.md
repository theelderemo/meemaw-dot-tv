# Coding standards

## Principles

1. **KISS**: a tiny team, forever. The simplest thing that keeps the interface exactly as familiar as it is today wins. Cleverness is a maintenance debt.
2. **YAGNI**: build the current task, not imagined futures. Deferred features get zero speculative hooks.
3. **DRY, rule of three**: extract on the third duplication, not the second. Premature abstraction is worse than duplication.
4. **SOLID, pragmatically applied to React/TS:**
   - *Single responsibility*: one component = one concern; data fetching lives in `lib/`, not components. Files past roughly 200 lines usually mean a split is due.
   - *Open/closed in practice*: row config drives browse rows; adding a row is config, not new components.
   - *Interface segregation / dependency inversion*: components consume narrow typed props and `lib/` functions, never raw fetch or third-party response shapes. External services are swappable behind their `lib/` module (Torrentio could become Comet without touching UI).
5. **Boundaries are sacred**: every external response (TMDB, Torrentio, Real-Debrid, Supabase rows) is zod-parsed into our own types at the `lib/` edge. Nothing downstream handles foreign shapes or `any`.

## TypeScript

- `strict` on (scaffold default). No `any`: `unknown` + narrowing at boundaries. No non-null `!` except where a comment states the invariant.
- Exported functions: explicit return types. Domain types live at their `lib/` boundary (zod schemas + their inferred types, e.g. `lib/tmdb/schemas.ts`); one-off types stay inline.
- Discriminated unions over boolean flags (`{ type: 'movie' } | { type: 'tv'; season: number }`).

## React / Next.js

- **Server Components by default.** `"use client"` only for state/effects/browser APIs, and pushed to the leaf (hover cards, player, search input), never whole pages.
- Data fetching server-side (Server Components / route handlers / server actions). Client fetches only our own `/api/*`.
- Route handlers stay thin: parse+auth, call `lib/`, shape the response.
- State: local `useState`, then a small context (the portal/modal providers), then nothing heavier. No Redux/Zustand; the app doesn't need a store.
- Loading/error via route conventions (`loading.tsx`, `error.tsx`) + skeletons that match the screens they stand in for.
- Images through `next/image`; TMDB domains in `remotePatterns`; poster `alt` = title.

## Styling

- Tailwind utilities against the theme tokens in `src/app/globals.css` (see [ui-fidelity.md](reference/ui-fidelity.md) §Theming map). **Never raw hex in components**: tokens only, or the theme stops being swappable.
- Component classname soup > premature `@apply`/CSS extraction. Extract only shared primitives (buttons, chips).
- Dark-only. Transitions keep the timings the app already ships; don't retune them in passing.

## Errors & logging

- No silent `catch`. Handle it, or let route-level `error.tsx`/normalized API errors surface it.
- User-facing copy runs on the two-register standard:
  - **Meemaw voice**, for content & streaming surfaces (watch errors, browse/modal/My-List fetch failures, loading/buffering): one playful brand line, then one plain instruction, then the real error code, small and muted.
  - **Plain voice**, for auth & account forms (login, password): calm, precise, zero flavor. Whimsy where the user waits; precision where the user types.
- **Code visibility:** every API-backed error shows its real code + status as a muted `CODE · status` line (`NOT_CACHED · 404`) under the friendly copy (never as the headline), and the client logs `console.error` with code + status when rendering the state. The instruction line always says what to do in plain words. Canonical strings live in the components that render them.
- Server logs (`console.error` in serverless is fine) carry the real cause + context, but **never tokens, magnet URIs with keys, or unrestricted URLs**.

## Security

- Secrets are server-only; the `NEXT_PUBLIC_` allowlist is just the two Supabase values (URL and publishable key).
- Auth: protected pages and route handlers re-verify server-side via `requireUser()` (`lib/supabase`); the proxy (Next 16's renamed middleware) is convenience, not the boundary.
- RLS on every table; no secret-key client in the app.

## Testing (pragmatic, not ceremonial)

- Every change: `npm run lint` + `npm run build` clean.
- Unit tests where logic is pure and risky: TMDB boundary schemas (`lib/tmdb`), candidate parsing/picking in `lib/streaming` (real captured fixtures), progress arithmetic. Runner: Vitest (dev-dep).
- No e2e framework for v1; release checks are manual by design.

## Dependencies & versions

- The dependency list is short on purpose and stays that way. Before installing anything, open an issue and make the case; a new dependency needs a reason the existing ones can't cover.
- Never pin versions: install `@latest`, leave installer-written ranges alone, no `overrides`. Commit the lockfile.

## Hygiene

- Comments explain *why* / non-obvious invariants only (e.g. "RD counts 429s toward the quota; do not retry on 429"). No narrating-the-code comments, no dead code, no commented-out blocks.
- Names: files kebab-case; components PascalCase; functions/vars camelCase; DB snake_case. Match the app's domain language (billboard, row, title, maturity rating).
- Formatting is Prettier's problem; never hand-format against it.
