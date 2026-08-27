import Link from "next/link";
import Logo from "@/components/layout/logo";
import ProfileAvatar from "@/components/profiles/profile-avatar";
import { getOwnProfile } from "@/lib/db/profiles";
import { requireUser } from "@/lib/supabase/require-user";

// Post-login greeting moment: a single tile - the signed-in user's
// own profile. No switching, no "Add profile".
export default async function ProfilesPage() {
  await requireUser();
  const profile = await getOwnProfile();

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex h-[70px] items-center px-4 md:px-[60px]">
        <Link href="/browse" aria-label="Meemaw.tv home">
          <Logo />
        </Link>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center pb-[70px]">
        <h1 className="text-foreground text-center text-[clamp(30px,3.5vw,48px)] font-medium">
          Who&apos;s watching?
        </h1>
        <ul className="mt-8 flex list-none flex-row p-0">
          <li className="text-center">
            <Link
              href="/browse"
              className="group block w-[10vw] max-w-[200px] min-w-[84px]"
            >
              <ProfileAvatar className="group-hover:border-foreground w-full border-[3px] border-transparent" />
              <p className="text-muted-dark group-hover:text-foreground mt-4 text-base">
                {profile.displayName}
              </p>
            </Link>
          </li>
        </ul>
      </div>
    </main>
  );
}
