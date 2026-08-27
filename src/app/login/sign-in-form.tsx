"use client";

import { useActionState, useState } from "react";
import { signIn } from "./actions";

export default function SignInForm() {
  const [state, formAction, isPending] = useActionState(signIn, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isInvalid = email === "" || password === "";

  return (
    <div className="w-full max-w-[450px] rounded-[5px] bg-black/75 px-6 pt-[60px] pb-10 sm:px-[68px]">
      <h1 className="text-foreground mb-7 text-[32px] font-bold">Sign In</h1>
      {state?.error && (
        <div className="bg-error text-foreground mb-4 rounded px-5 py-[15px] text-sm">
          {state.error}
        </div>
      )}
      <form action={formAction} className="flex flex-col">
        <input
          name="email"
          type="email"
          placeholder="Email address"
          aria-label="Email address"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="bg-background-input text-foreground placeholder:text-muted mb-5 h-[50px] rounded border-0 px-5"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          aria-label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="bg-background-input text-foreground placeholder:text-muted mb-5 h-[50px] rounded border-0 px-5"
        />
        <button
          type="submit"
          disabled={isInvalid || isPending}
          className="bg-primary hover:bg-primary-hover text-foreground mt-6 w-full cursor-pointer rounded p-4 text-base font-bold transition-colors disabled:cursor-default disabled:opacity-50"
        >
          {isPending ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
