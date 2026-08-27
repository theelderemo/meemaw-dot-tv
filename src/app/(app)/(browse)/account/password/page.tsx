import { requireUser } from "@/lib/supabase/require-user";
import ChangePasswordForm from "./change-password-form";

// /account/password - in-app password change, reached from the profile menu.
// Lives inside the (browse) chrome on purpose: streaming apps keep the header
// on account pages, and the header is the viewer's familiar way back out.
export default async function ChangePasswordPage() {
  const user = await requireUser();

  return (
    <main className="flex flex-1 items-center justify-center px-[30px] pt-[100px] pb-12 sm:px-[60px]">
      <ChangePasswordForm email={user.email ?? null} />
    </main>
  );
}
