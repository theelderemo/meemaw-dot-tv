"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import ProfileAvatar from "@/components/profiles/profile-avatar";

export default function AvatarMenu({ displayName }: { displayName: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", closeOnOutsideClick);
    return () => document.removeEventListener("click", closeOnOutsideClick);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex cursor-pointer items-center gap-2"
      >
        <ProfileAvatar className="h-8 w-8" />
        <span
          aria-hidden="true"
          className={`border-t-foreground border-x-4 border-t-[5px] border-x-transparent transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 pt-3">
          <div className="bg-background/90 border-foreground/15 border py-2">
            <div
              role="none"
              className="flex cursor-default items-center gap-2.5 px-4 py-2"
            >
              <ProfileAvatar className="h-7 w-7 shrink-0" />
              <span className="text-foreground text-[13px] whitespace-nowrap">
                {displayName}
              </span>
            </div>
            <div role="none" className="border-foreground/15 my-1 border-t" />
            <Link
              href="/account/password"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="text-foreground block px-4 py-2 text-[13px] whitespace-nowrap hover:underline"
            >
              Change Password
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="text-foreground block w-full cursor-pointer px-4 py-2 text-left text-[13px] whitespace-nowrap hover:underline"
              >
                Sign out of Meemaw.tv
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
