"use server";

import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/require-user";
import { createClient } from "@/lib/supabase/server";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "./password-rules";

export type ChangePasswordState = { ok: true } | { error: string } | null;

// One plain sentence per failure (coding-standards §Errors): our own rule
// codes plus the two Supabase error codes worth telling apart.
const ERROR_COPY = {
  "too-short": `That password is too short - use at least ${MIN_PASSWORD_LENGTH} characters.`,
  mismatch: "Those passwords don't match - type the same one in both boxes.",
  same_password: "That's already your password - pick a new one.",
  weak_password: "That password won't work here - try a longer one.",
  generic: "Something went wrong - your password wasn't changed. Try again.",
} as const;

// Direct in-app password change for the signed-in account - deliberately no
// email round-trip. Depends on the dashboard's "Secure password change"
// toggle staying OFF, or Supabase demands a reauthentication nonce by email
// (supabase.md §Password change).
export async function changePassword(
  _previousState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const password = formData.get("password");
  const confirm = formData.get("confirm");
  if (typeof password !== "string" || typeof confirm !== "string") {
    return { error: ERROR_COPY.generic };
  }

  const ruleError = validateNewPassword(password, confirm);
  if (ruleError !== null) return { error: ERROR_COPY[ruleError] };

  // Same server-side gate as every protected surface (proxy = convenience).
  if ((await getVerifiedUser()) === null) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    // Log the code only - never the attempted password.
    console.error(
      "[account] password change failed:",
      error.code ?? error.status,
    );
    if (error.code === "same_password") {
      return { error: ERROR_COPY.same_password };
    }
    if (error.code === "weak_password") {
      return { error: ERROR_COPY.weak_password };
    }
    return { error: ERROR_COPY.generic };
  }

  return { ok: true };
}
