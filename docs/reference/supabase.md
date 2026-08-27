# Supabase reference

Supabase provides auth and Postgres. All admin work happens in the dashboard; the project deliberately uses no Supabase CLI. Checked against the Supabase Next.js SSR guide, August 2026.

## Dashboard setup

1. **Create a project.** Any project name works. Pick the region nearest your viewers and put a strong database password into a password manager.
2. **Disable signups.** Authentication, then Sign In / Providers, then Email: turn off "Allow new users to sign up" and "Confirm email". You create the users by hand, so no confirmation emails are needed.
3. **Create the users.** Authentication, then Users, then "Add user": email and password, one per household member, with "Auto confirm" on. Pick memorable but strong passwords. Each member types theirs once per device.
4. **Leave sessions long-lived.** Authentication, then Sessions: keep time-boxing and inactivity timeouts off (the defaults) so refresh tokens keep sessions alive indefinitely.
5. **Run the schema.** In the SQL Editor, paste the SQL below and run it.
6. **Copy the keys.** Project Settings, then API: copy the Project URL and the **publishable** key into `.env.local` and the Vercel env vars. In the current key naming, *publishable* replaces the legacy *anon* key and *secret* replaces *service_role*. The app never needs the secret key.

## Client wiring

The packages are `@supabase/supabase-js` and `@supabase/ssr`. Three pieces, implemented exactly as the current guide at `supabase.com/docs/guides/auth/server-side/nextjs` describes. Read that guide fresh before touching this code; the cookie API has changed before.

- `lib/supabase/client.ts`: `createBrowserClient`, for Client Components.
- `lib/supabase/server.ts`: `createServerClient` over Next's `cookies()`, for Server Components, route handlers, and actions.
- `src/proxy.ts`: session token refresh plus the redirect to `/login` for protected paths. Next 16 renamed the `middleware.ts` convention to `proxy.ts` (verified in Next's bundled docs); older tutorials still say middleware. The interceptor uses `getClaims()` per the current guide. The proxy alone is not auth: every protected page and route handler re-verifies server-side through `requireUser()`, which wraps `supabase.auth.getUser()` and validates against the auth server. Never trust `getSession()` alone on the server.

## Schema (v1, run in the SQL Editor)

```sql
-- Profiles: one row per auth user
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_color text not null default 'pink', -- avatar tile hue on "Who's watching?"
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- My List
create table public.my_list (
  user_id uuid not null references auth.users (id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie','tv')),
  added_at timestamptz not null default now(),
  primary key (user_id, tmdb_id, media_type)
);

-- Continue Watching
create table public.watch_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie','tv')),
  season integer not null default 0,   -- 0 for movies
  episode integer not null default 0,
  position_seconds integer not null default 0,
  duration_seconds integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, tmdb_id, media_type, season, episode)
);

alter table public.profiles enable row level security;
alter table public.my_list enable row level security;
alter table public.watch_progress enable row level security;

create policy "own profile read"  on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
create policy "own list all" on public.my_list for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own progress all" on public.watch_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

After creating the auth users, insert their profile rows in the SQL Editor. The UUIDs come from Authentication, then Users:

```sql
insert into public.profiles (id, display_name, is_admin) values
  ('<user-uuid>', '<Display name>', false),
  ('<admin-uuid>', '<Display name>', true);
```

`display_name` is what the profile tile greets them with.

## Password change (in-app)

`/account/password` (profile menu, then Change Password) lets the signed-in user set a new password directly: a server action calls `supabase.auth.updateUser({ password })` on the session, with no email round-trip. That is a deliberate choice for a household app.

- The email provider's "Secure password change" toggle must stay **off** (its default). Turned on, Supabase demands recent-login reauthentication through an emailed nonce, which is exactly what this flow avoids. Sessions here are weeks old by design, so enabling the toggle would break the flow exactly when it's needed.
- The minimum length is Supabase's default 6, mirrored as `MIN_PASSWORD_LENGTH` in `password-rules.ts`. Raising the dashboard minimum is safe: the server then rejects with `weak_password`, which the form maps to friendly copy (as it does `same_password`).
- This only works while signed in. A truly forgotten password (the person can't sign in) is not covered in-app; the operator resets it in the dashboard under Authentication, then Users.

## Conventions

- DB access goes only through the typed functions in `lib/db`; components never call `supabase.from()` directly.
- RLS is the security boundary. The model is the publishable key plus RLS; the app holds no secret key.
- Auth cookies are not httpOnly, on purpose: `@supabase/ssr` ships `httpOnly: false` because `createBrowserClient` must read the session from `document.cookie`. The boundary is RLS plus server-side `getUser()` through `requireUser()`, not cookie invisibility. This is expected behavior; do not re-audit or "fix" it.
- Schema changes: the migration SQL goes into `docs/reference/migrations/NNN-*.sql`, the operator runs it in the SQL Editor, and the file is committed. That is the no-CLI migration trail.
