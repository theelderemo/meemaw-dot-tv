"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { changePassword } from "./actions";

// Mirrors the sign-in card (sign-in-form.tsx) - same inputs, pink button,
// error banner - so the one new form in the app reads as already familiar.
// Success swaps the form for one calm sentence and one big way back.
export default function ChangePasswordForm({
  email,
}: {
  email: string | null;
}) {
  const [state, formAction, isPending] = useActionState(changePassword, null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const isIncomplete = password === "" || confirm === "";

  return (
    <div className="w-full max-w-[450px] rounded-[5px] bg-black/75 px-6 pt-[60px] pb-10 sm:px-[68px]">
      {state !== null && "ok" in state ? (
        <>
          <h1 className="text-foreground mb-7 text-[32px] font-bold">
            All done
          </h1>
          <p className="text-foreground mb-8 text-base">
            Your password is changed. Use the new one next time you sign in.
          </p>
          <Link
            href="/browse"
            className="bg-primary hover:bg-primary-hover text-foreground block w-full rounded p-4 text-center text-base font-bold transition-colors"
          >
            Back to Browse
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-foreground mb-2 text-[32px] font-bold">
            Change Password
          </h1>
          <p className="text-muted mb-7 text-sm">
            {email !== null
              ? `Pick a new password for ${email}.`
              : "Pick a new password for signing in."}
          </p>
          {state !== null && "error" in state && (
            <div className="bg-error text-foreground mb-4 rounded px-5 py-[15px] text-sm">
              {state.error}
            </div>
          )}
          <form action={formAction} className="flex flex-col">
            <input
              name="password"
              type="password"
              placeholder="New password"
              aria-label="New password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="bg-background-input text-foreground placeholder:text-muted mb-5 h-[50px] rounded border-0 px-5"
            />
            <input
              name="confirm"
              type="password"
              placeholder="Retype new password"
              aria-label="Retype new password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="bg-background-input text-foreground placeholder:text-muted mb-5 h-[50px] rounded border-0 px-5"
            />
            <button
              type="submit"
              disabled={isIncomplete || isPending}
              className="bg-primary hover:bg-primary-hover text-foreground mt-6 w-full cursor-pointer rounded p-4 text-base font-bold transition-colors disabled:cursor-default disabled:opacity-50"
            >
              {isPending ? "Changing…" : "Change Password"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
