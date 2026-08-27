import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./server";

// getUser() validates the token against the auth server - never trust
// getSession()/claims alone server-side (supabase.md).
export async function getVerifiedUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// The canonical gate for protected pages. The proxy redirect is convenience
// only - every protected page calls this server-side.
export async function requireUser(): Promise<User> {
  const user = await getVerifiedUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

// Gate for route handlers. The body matches the documented /api error
// contract (stream-resolution.md) and the proxy's own /api 401 - one shape
// for the client to handle, wherever the rejection comes from.
// Callers return the NextResponse as-is:
//   const userOr401 = await requireApiUser();
//   if (userOr401 instanceof NextResponse) return userOr401;
// The 401 body matches the proxy's unauthenticated /api response.
export async function requireApiUser(): Promise<User | NextResponse> {
  const user = await getVerifiedUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return user;
}
