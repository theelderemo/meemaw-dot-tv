import { Suspense } from "react";
import Link from "next/link";
import { getOwnProfile } from "@/lib/db/profiles";
import AvatarMenu from "./avatar-menu";
import HeaderShell from "./header-shell";
import Logo from "./logo";
import NavLinks from "./nav-links";
import SearchBox from "./search-box";

export default async function Header() {
  const profile = await getOwnProfile();

  return (
    <HeaderShell>
      <Link href="/browse" aria-label="Meemaw.tv home" className="mr-6">
        <Logo />
      </Link>
      <nav className="flex-1">
        <NavLinks />
      </nav>
      <div className="flex items-center gap-4">
        {/* useSearchParams inside - Suspense keeps the header prerenderable. */}
        <Suspense fallback={null}>
          <SearchBox />
        </Suspense>
        <AvatarMenu displayName={profile.displayName} />
      </div>
    </HeaderShell>
  );
}
