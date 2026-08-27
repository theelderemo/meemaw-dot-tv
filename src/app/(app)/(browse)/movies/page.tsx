import BrowseScreen from "@/components/browse/browse-screen";
import { requireUser } from "@/lib/supabase/require-user";
import { movieRows } from "@/lib/tmdb/rows";

export default async function MoviesPage() {
  await requireUser();
  return <BrowseScreen rows={movieRows} />;
}
