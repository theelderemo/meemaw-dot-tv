# Security policy

Meemaw.tv is a self-hosted app for households, but "small and private" is not
an excuse for sloppy: it holds sign-in sessions and touches secrets that map
to a paid Real-Debrid account. Reports are taken seriously.

## Reporting a vulnerability

**Please don't open a public issue for a vulnerability.** Use GitHub's private
reporting instead: the repository's **Security** tab → **Report a
vulnerability**. That keeps the details between you and the maintainer until
a fix ships.

Never include real credentials in a report - no `TORRENTIO_CONFIG`, no
Real-Debrid keys, no Supabase URLs from a live deployment. A redacted example
or a reproduction against your own throwaway values works fine.

This is a spare-time project with no SLA, but security reports jump the
queue. You'll get an acknowledgment, and credit in the fix unless you'd
rather not.

## What counts

The interesting boundaries, roughly in order of how much they'd hurt:

- **Secret leakage.** `TORRENTIO_CONFIG` (which embeds the Real-Debrid API
  key) and `TMDB_API_READ_TOKEN` are server-side only, scrubbed from errors
  and logs, and the resolve URLs that contain them must never reach the
  browser. Any path where they do is a vulnerability.
- **Auth and RLS.** Exactly two values are public by design (the Supabase URL
  and publishable key); row-level security is the boundary. Reading or
  writing another user's state (profile, My List, watch progress) - or
  anything - without their session is a vulnerability.
- **The closed-household property.** Any way to create an account, sign up,
  or reach app data without a manually created user.
- **Server-side request forgery** in the resolve pipeline (it fetches
  upstream URLs on the viewer's behalf).

Out of scope: the security of TMDB, Torrentio, Real-Debrid, Supabase, or
your hosting provider themselves; and misconfigured deployments (signups
left enabled, RLS not applied - the docs are explicit about both).

## Supported versions

The tip of the default branch. There are no maintained release lines;
self-hosters are expected to pull fixes.
