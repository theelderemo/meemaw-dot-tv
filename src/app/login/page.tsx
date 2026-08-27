import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Logo from "@/components/layout/logo";
import { getVerifiedUser } from "@/lib/supabase/require-user";
import SignInForm from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign In - Meemaw.tv",
};

export default async function LoginPage() {
  const user = await getVerifiedUser();
  if (user) {
    redirect("/browse");
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex h-[70px] items-center px-4 md:px-[60px]">
        <Link href="/" aria-label="Meemaw.tv home">
          <Logo />
        </Link>
      </div>
      <div className="flex flex-1 items-start justify-center px-4 pt-8 pb-[100px] sm:pt-16">
        <SignInForm />
      </div>
    </main>
  );
}
