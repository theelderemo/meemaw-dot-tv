# Contributing to Meemaw.tv

Thanks for wanting to help. Before you write any code, please read this. It's short, and most of it is about what *not* to build.

Meemaw.tv is a faithful, boring-on-purpose take on the streaming interface everyone already knows, built so a non-technical person can use it unassisted. The viewers it serves have a decade of muscle memory from mainstream streaming apps; that familiarity is the entire UX strategy, and the accessibility strategy too. Restraint is the feature. The best contribution keeps the app exactly as unsurprising as it is today.

## Scope rules (read before opening a PR)

- **UI changes must match the established pattern.** Fidelity fixes are welcome ("the standard behavior here is X, we do Y"); "improvements" are declined, however good they are. The full argument lives in [docs/reference/ui-fidelity.md](docs/reference/ui-fidelity.md): any deviation from the interface the viewers already know creates unfamiliarity, and unfamiliarity is the real accessibility risk here.
- **Departures are recorded, and the list is complete.** Colors, the logo, the footer, Switch Streams, the Meemaw voice and loader: each is listed in [docs/reference/ui-fidelity.md](docs/reference/ui-fidelity.md). Anything not on that list follows the standard pattern. A new departure needs a maintainer-approved issue *before* the code.
- **Feature ideas: open an issue first.** The omissions (signups, subtitles, trailers, multi-profile switching) are deliberate: each was weighed and declined or deferred for reasons that still hold. An issue costs a minute; an unmergeable PR costs an evening.

## Ground rules

- **No new dependencies without an issue first.** The dependency list is short on purpose; a new one needs a reason the existing ones can't cover.
- **Never pin versions.** Install with `@latest`, leave the installer-written ranges alone, and don't add `overrides` or `resolutions`. The lockfile is committed; `npm update` moves it freely.
- **Secrets are server-side only.** Exactly two values may ever be `NEXT_PUBLIC_`: the Supabase URL and the Supabase publishable key. Nothing else: not new keys, not "just this once".
- **Fixtures are real captures.** The JSON under `__fixtures__/` is genuine API output, regenerated only by `scripts/capture-torrentio.mjs` (infohashes and tracker lists are redacted at capture), never hand-edited. If a fixture looks wrong, re-capture it.
- **Vitest uses relative imports in tested modules.** No `@/` alias in files under test or their imports within `src/lib`. Keep it that way; the test runner doesn't resolve the alias.
- **`AGENTS.md` is machine-managed by `next dev`.** Commit its churn, don't fight it, and never delete it.

## Gates

Every PR runs, and states that it ran:

```bash
npm run lint
npm run test
npm run build
```

All three must be green, and they require zero environment variables, so there's no excuse. (The `smoke:*` scripts hit live services and need a populated `.env.local`; they're for your own verification, not the gate.)

## Style

- Prettier owns formatting; never hand-format against it (`npm run format`).
- Comments are for *why*; fewer is better. No narrating-the-code comments.
- [docs/coding-standards.md](docs/coding-standards.md) is the contract, including the two-register copy standard for user-facing text.

## Support posture

This is a personal project, maintained in spare time for real households. There is no SLA, and there's no guarantee an issue gets picked up quickly, or at all. Issues and PRs are welcome anyway.

Kindness is mandatory. The maintainers owe you nothing; you owe everyone in the tracker basic decency. That trade holds in both directions.
