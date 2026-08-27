import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const profileRowSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  avatar_color: z.string(),
  is_admin: z.boolean(),
});

export type Profile = {
  id: string;
  displayName: string;
  avatarColor: string;
  isAdmin: boolean;
};

// The signed-in user's own profiles row - RLS makes it the only one visible
// (one profile per auth user). Call behind requireUser(); a missing
// row means the insert step in supabase.md was skipped.
export async function getOwnProfile(): Promise<Profile> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_color, is_admin")
    .single();

  if (error) {
    throw new Error(
      `profiles row missing or unreadable for the signed-in user: ${error.message}`,
    );
  }

  const row = profileRowSchema.parse(data);
  return {
    id: row.id,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    isAdmin: row.is_admin,
  };
}
