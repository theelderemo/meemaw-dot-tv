import BrowseScreen from "@/components/browse/browse-screen";
import { requireUser } from "@/lib/supabase/require-user";
import { browseRows } from "@/lib/tmdb/rows";

export default async function BrowsePage() {
  await requireUser();
  return <BrowseScreen rows={browseRows} continueWatching />;
}
