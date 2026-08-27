import BrowseScreen from "@/components/browse/browse-screen";
import { requireUser } from "@/lib/supabase/require-user";
import { tvRows } from "@/lib/tmdb/rows";

export default async function TvPage() {
  await requireUser();
  return <BrowseScreen rows={tvRows} />;
}
