// Supabase's default minimum password length; raising it in the dashboard is
// fine - the server then rejects with weak_password and the form shows that
// copy instead.
export const MIN_PASSWORD_LENGTH = 6;

export type PasswordRuleError = "too-short" | "mismatch";

// Pure and shared: the form pre-checks with it, the server action re-checks
// with it (the client is never trusted). Length first - a short mismatched
// pair should read as "too short", the more actionable problem.
export function validateNewPassword(
  password: string,
  confirm: string,
): PasswordRuleError | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "too-short";
  if (password !== confirm) return "mismatch";
  return null;
}
