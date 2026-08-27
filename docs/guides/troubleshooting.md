# Troubleshooting

For operators. When a viewer says "it's broken", this page turns what they're seeing into a cause and a fix.

## How the app reports errors

Every failure a viewer can see follows the same two-line pattern: a friendly line in the Meemaw voice, a plain instruction, and underneath, small and muted, the real error code and HTTP status, something like `NOT_CACHED · 404`. That little code is written for you. Ask the viewer to read it to you, and you can skip the guesswork.

Under the hood, the app also logs the same code to the browser console when the error renders, and your host's function logs (for example Vercel's) carry the server-side cause. Secrets never appear in either, by rule: no tokens, no magnet URIs, no unrestricted URLs.

## The error codes

These come from the stream endpoint; the full contract lives in [stream-resolution.md](../reference/stream-resolution.md).

| Code | Status | What actually happened | What to do |
|---|---|---|---|
| `NOT_CACHED` | 404 | Torrentio listed candidates, but Real-Debrid refused every one the resolver tried. Its content filter fires at resolve time, and for some titles nothing survives. | Have the viewer try **Switch Streams** and pick a different release, try another title, or check back later. If *every* title does this, see "Nothing resolves at all" below. |
| `PROVIDER_DOWN` | 503 | Torrentio didn't answer: down, or timed out. | It's upstream; wait and retry. If it's chronic, the fallback options are in [stream-resolution.md](../reference/stream-resolution.md) under Fallback path. |
| `NOT_FOUND` | 404 | Unknown title, or TMDB has no IMDb mapping for it, so there's nothing to search for. | Rare and title-specific. Nothing to fix; that title just isn't resolvable. |
| `UNAUTHORIZED` | 401 | No valid session. | Usually the viewer just needs to sign in again. If it's persistent, see "Stuck at the sign-in page" below. |
| `BAD_REQUEST` | 400 | Malformed request. This indicates a bug, not an operations problem. | Worth an issue with the URL that produced it. |
| `INTERNAL` | 500 | Something unexpected server-side. | Check your host's function logs for the cause. |

## Situations

### Stuck at the sign-in page, or bounced back to it

A `401` loop nearly always means one of three things: the two Supabase env values are wrong (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), the user was never actually created in the Supabase dashboard, or the session genuinely expired. Check the env vars first, confirm the user exists under Authentication, then Users (auto-confirmed), and have them sign in again.

If sessions keep expiring after days instead of weeks, check Authentication, then Sessions in the dashboard: the time-boxing and inactivity timeouts should be off.

### Nothing resolves at all

One title failing with `NOT_CACHED` is normal life. *Every* title failing, when things worked yesterday, points at the Real-Debrid token inside `TORRENTIO_CONFIG`: tokens occasionally need regenerating. Get a fresh one at `real-debrid.com/apitoken`, rebuild the config string (see [self-hosting](self-hosting.md), step 4), update the env var, redeploy.

### A title plays in the wrong language

The automatic picker tries hard to avoid this (dual-audio releases play the container's default track, and browsers can't switch audio tracks on a plain video element), but the metadata on releases is messy and one slips through now and then. The viewer-side fix is **Switch Streams**: pick a release without the extra language in its name. If a particular title reliably picks a bad stream, that's useful picker feedback, worth an issue with the release names from the Switch Streams list.

### Playback dies partway through

Resolved stream URLs are short-lived by nature. The player already handles this: on a video error it re-resolves once, fresh, and carries on. If a title dies repeatedly at the same spot, try a different release via Switch Streams; the file itself may be bad.

### Playback never starts on a particular device

Check the browser first. Chrome and Firefox are the supported browsers; Safari and iOS cannot play these streams at all. That's a codec/container limitation, not a bug you can configure away. The compatibility details are in [stream-resolution.md](../reference/stream-resolution.md) under Playback compatibility.

### The password-change page errors out

If the in-app password change fails with a re-authentication demand, someone has turned on "Secure password change" in the Supabase dashboard's email provider settings. Turn it back off; the flow depends on it, deliberately, because household sessions are weeks old. If a viewer is fully locked out (can't sign in at all), reset them from the dashboard instead: Authentication, then Users.

## Still stuck

Check your host's function logs for the server-side cause, then open an issue with: the muted error code and status, the title (if title-specific), and what the logs said. Never paste your `TORRENTIO_CONFIG`, tokens, or any `real-debrid.com` URL into an issue; the code and the log line are enough.
