# Meemaw.tv documentation

Meemaw.tv is a private, self-hosted streaming app for a household: the classic streaming interface everyone already knows (billboard, poster rows, hover cards, a dark player), pointed at accounts you bring yourself. TMDB provides the metadata, your own Real-Debrid account (via Torrentio) provides the streams, and Supabase handles sign-in and each person's saved state. There are no signups; the operator creates a handful of users by hand and shares the address.

This page is the map. Start with whichever description fits you.

## Start here

**I just want to watch something.**
Someone in your household runs Meemaw.tv and gave you an address and a password. [The viewer's guide](guides/watching.md) covers everything from signing in to fixing a stream that comes up in the wrong language, and assumes no technical background.

**I want to run Meemaw.tv for my household.**
[The self-hosting guide](guides/self-hosting.md) goes from an empty folder to a deployed app: the three accounts you need, the Supabase dashboard work, the four environment variables, and the small amount of upkeep afterwards. Keep [troubleshooting](guides/troubleshooting.md) nearby for when a viewer reports something broken.

**I want to work on the code.**
Read [architecture.md](architecture.md) first; it's short and the whole system fits in one diagram. Then [coding-standards.md](coding-standards.md) for how code is written here, and the [reference section](#reference) for the services you'll be touching. The project deliberately resists UI invention; [ui-fidelity.md](reference/ui-fidelity.md) explains why before you propose a redesign.

**I want to contribute a change.**
Welcome. Start with [CONTRIBUTING.md](../CONTRIBUTING.md) at the repo root. It's short, and most of it is about what *not* to build. The scope rules there and the fidelity bar in [ui-fidelity.md](reference/ui-fidelity.md) will save you from spending an evening on an unmergeable PR.

## Guides

| Doc | For | What's in it |
|---|---|---|
| [guides/watching.md](guides/watching.md) | Viewers | Signing in, browsing, the player, Switch Streams, changing your password |
| [guides/self-hosting.md](guides/self-hosting.md) | Operators | Full setup, deployment, day-to-day operation, theming |
| [guides/troubleshooting.md](guides/troubleshooting.md) | Operators | Error codes and what they mean, common failures and their fixes |

## Core docs

| Doc | What's in it |
|---|---|
| [architecture.md](architecture.md) | System overview, request flows, module layout, security model, caching |
| [coding-standards.md](coding-standards.md) | Principles, TypeScript/React/styling rules, error copy standard, testing |
| [reference/ui-fidelity.md](reference/ui-fidelity.md) | The design doctrine: don't improve it. Deliberate departures, theming map, the fidelity bar |

## Reference

Deeper detail on each external service, kept current against their live docs and APIs. These are the docs the code itself cites.

| Doc | What's in it |
|---|---|
| [reference/stream-resolution.md](reference/stream-resolution.md) | The whole pipeline from TMDB ID to playable URL, the candidate picker, the `/api/stream` contract |
| [reference/tmdb.md](reference/tmdb.md) | Endpoints, genre IDs, images, response gotchas, caching |
| [reference/real-debrid.md](reference/real-debrid.md) | Auth, the content filter and what it means, fallback endpoints, limits |
| [reference/supabase.md](reference/supabase.md) | Dashboard setup, schema and RLS policies, client wiring, password change |
| [reference/migrations/](reference/migrations/README.md) | Numbered schema migration SQL, run by hand in the SQL Editor |

## A note on the shape of these docs

The reference docs state constraints unusually firmly ("do not use", "this check is not optional"). That's deliberate: most of those lines mark a spot where someone tried the obvious approach and it failed against the real services. When a doc here disagrees with a tutorial elsewhere, trust the doc, or better, re-verify against the live service and open a PR if the world has changed.
