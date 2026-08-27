<!--
Thanks for helping. Two minutes of reading saves an evening of rework:
CONTRIBUTING.md has the scope rules, and most of them are about what
NOT to build. Fidelity fixes welcome; "improvements" politely declined.
-->

## What & why

<!-- What does this change, and what problem does it solve? Link the issue.
     Features and new UI departures need a maintainer-approved issue BEFORE
     the code - if there isn't one, open it first and save your evening. -->

## Kind of change

- [ ] **Fidelity fix** - the standard streaming interface does X, we did Y (name the app you compared against)
- [ ] **Bug fix**
- [ ] **Docs**
- [ ] **Approved feature / departure** - issue: #
- [ ] Chore (deps, CI, tooling)

## Gates

Ran locally, all green (CI re-runs them; none need environment variables):

- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build`

## Scope checks

- [ ] No new dependencies (or: approved in issue #___)
- [ ] Nothing new is `NEXT_PUBLIC_`; secrets stay server-side and out of logs
- [ ] Fixtures untouched, or re-captured with `scripts/capture-torrentio.mjs` (never hand-edited)
- [ ] UI matches the established pattern per [docs/reference/ui-fidelity.md](../blob/HEAD/docs/reference/ui-fidelity.md), or this PR's departure is recorded there

## Screenshots

<!-- For anything visual: before / after, plus the mainstream reference
     you matched. Delete this section for non-UI changes. -->
