# Self-hosting Meemaw.tv

This guide takes you from nothing to a deployed Meemaw.tv your household can sign into, then covers the handful of things you'll do as its operator afterwards. First-time setup takes under an hour, most of it in the Supabase dashboard.

Meemaw.tv is a stock Next.js app driven by four environment variables. It has no database of its own beyond Supabase and runs no background jobs. No server touches video: streams play from Real-Debrid's CDN straight to the viewer's browser. You bring three accounts (TMDB, Real-Debrid, Supabase) and somewhere to run a Next.js app.

## What you'll need

- **Node.js** (current LTS) and npm.
- A **Supabase** account. The free tier is fine. Handles sign-in and each person's saved state.
- A **TMDB** account, free. Provides all the metadata and artwork.
- A **Real-Debrid** account, paid, and the one thing here that costs money. Provides the streams, via Torrentio.
- Somewhere to host. The **Vercel** free tier works well, but any Node host does.
- Viewers on **Chrome or Firefox**. Playback is direct play (often MKV files), which Safari and iOS can't handle. Decide up front that this is acceptable for your household.

## Step 1: Clone and install

```bash
git clone <your-fork-or-clone-url> meemaw-tv
cd meemaw-tv
npm install
```

## Step 2: Supabase

Everything happens in the Supabase dashboard. The app never needs the Supabase CLI or the secret key. [The Supabase reference](../reference/supabase.md) has the full detail, including the exact SQL:

1. **Create a project.** Pick the region nearest your viewers and store the database password somewhere safe.
2. **Disable signups.** Authentication, then Sign In / Providers, then Email: turn off "Allow new users to sign up" and "Confirm email". This is the closed-household design rather than optional hardening. Meemaw.tv has no sign-up page and won't be getting one.
3. **Create your users by hand.** Authentication, then Users, then "Add user": email and password, with "Auto confirm" on, one per household member. Pick memorable but strong passwords. Each person types theirs once per device and then stays signed in.
4. **Run the schema.** SQL Editor: paste the schema from the reference doc (profiles, My List, watch progress, all with row-level security) and run it.
5. **Insert profile rows.** One per user, with the display name the app should greet them with. The insert statement is in the reference doc. The user UUIDs come from Authentication, then Users.
6. **Leave sessions long-lived.** Authentication, then Sessions: keep time-boxing and inactivity timeouts off (the defaults). Sessions here are meant to last weeks.
7. **Keep "Secure password change" off** (its default, under the email provider). The in-app password-change flow depends on it staying off. Turn it on and Supabase demands an emailed re-authentication, which is what a household app avoids.
8. **Copy the keys.** Project Settings, then API: the Project URL and the **publishable** key. You never need the secret key.

## Step 3: TMDB

Create a TMDB account, then: Settings, API, request an API key for personal use. Copy the **API Read Access Token**, the long JWT, not the short "API Key". Details in [the TMDB reference](../reference/tmdb.md).

## Step 4: Real-Debrid and Torrentio

The app resolves streams through Torrentio's Real-Debrid-configured endpoint, driven by one environment variable, `TORRENTIO_CONFIG`:

1. Get your Real-Debrid API key from `real-debrid.com/apitoken`.
2. Open `torrentio.strem.fun/configure`. Pick your quality filters (recommended: filter out "cam" and "unknown"), choose RealDebrid, and paste your key.
3. Copy the generated install link. It looks like `https://torrentio.strem.fun/qualityfilter=cam,unknown|realdebrid=YOURKEY/manifest.json`.
4. `TORRENTIO_CONFIG` is everything between the host and `/manifest.json`, with no slashes at either end. For example: `qualityfilter=cam,unknown|realdebrid=YOURKEY`.

The whole `TORRENTIO_CONFIG` value embeds your Real-Debrid API key, so treat it as a secret on par with the key itself: server-side only, never committed, never pasted into an issue. The app keeps it out of every log line and error message, and the URLs that contain it never reach the browser.

## Step 5: Run it locally

```bash
cp .env.example .env.local
```

Fill in the four values (the file explains each one), then:

```bash
npm run dev
```

Open http://localhost:3000 and sign in as one of the users you created. Browse a row, play something, and confirm video actually starts before you bother deploying.

## Step 6: Deploy

On Vercel: import the repo, set the same four environment variables under Project Settings, then Environment Variables, deploy, and add your domain. Any other Node host works the same way. It's a stock Next.js build plus four env vars.

Two defaults to know about before you share the address:

- Search engines are refused on purpose. `public/robots.txt` disallows everything and the root layout sends `noindex, nofollow`. A private household app has no business in a search index; if yours should be indexed, flip both.
- There is no public surface without a session. Every page and API route re-verifies sign-in server-side.

## Day-to-day operation

There isn't much of it. The situations you'll actually meet:

- **Adding a household member.** Dashboard: Authentication, Users, "Add user" (auto-confirm on), then insert their profile row in the SQL Editor. Hand them the address, email, and password.
- **Someone forgot their password.** If they can still sign in, the app's own Change Password page (under the profile menu) is the easy path. If they're locked out, reset it in the dashboard: Authentication, then Users.
- **Every title suddenly fails to resolve.** Real-Debrid tokens occasionally need regenerating. Get a fresh one at `real-debrid.com/apitoken`, rebuild `TORRENTIO_CONFIG` with it, update the env var, redeploy. Check [troubleshooting](troubleshooting.md) before assuming this is the cause.
- **A schema change arrives in an update.** Migration SQL lives in `docs/reference/migrations/`, numbered. Run any new files in the Supabase SQL Editor in order. There's no CLI to fight with.
- **Torrents appear in your Real-Debrid account.** Expected. Resolving a stream lands the torrent in the account, exactly as it would from Stremio. It's a side effect of playback, not a leak.

## Making it yours

- **Colors.** The whole pink-on-black scheme is ten `--color-*` tokens in `src/app/globals.css`. Components never use raw hex, so editing the tokens re-themes the entire app. The token-to-role table is in [ui-fidelity.md](../reference/ui-fidelity.md) under Theming map. Change `--color-primary` (and its hover/soft companions) and leave the rest alone.
- **Wordmark.** The logo is text, rendered in `src/components/layout/logo.tsx`. Change the string, keep the manner.
- **Icons.** Replace `src/app/favicon.ico`, `src/app/icon.png`, and `src/app/apple-icon.png`. Next.js generates the tags from the filenames, so you don't need to change any code.
- **Rows.** The browse rows are configuration, not components: edit `src/lib/tmdb/rows.ts` to curate what your household sees.

Resist going further than that. The interface's sameness is what makes it usable by the people it's for, and [ui-fidelity.md](../reference/ui-fidelity.md) explains the reasoning.