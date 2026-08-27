"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { label: "Home", href: "/browse" },
  { label: "TV Shows", href: "/tv" },
  { label: "Movies", href: "/movies" },
  { label: "My List", href: "/my-list" },
] as const;

// The header's only client leaf below the search box: active-link state needs
// usePathname, and the narrow-width "Browse ▾" dropdown needs open state.
// Breakpoint: with the search box open the links collide below ~885 px (our
// wrap was measured at ~780 px) - lg (1024) is
// the smallest Tailwind step that clears it, so links show from lg up and
// collapse into the dropdown below.
export default function NavLinks() {
  const pathname = usePathname();
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

  const linkClassName = (href: string) =>
    `hover:text-muted text-sm transition-colors ${
      pathname === href ? "text-foreground font-medium" : "text-foreground/85"
    }`;

  return (
    <>
      <ul className="hidden items-center gap-5 lg:flex">
        {navLinks.map(({ label, href }) => (
          <li key={href}>
            <Link href={href} className={linkClassName(href)}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
      {/* Same dropdown pattern as the avatar menu: hover opens, click toggles,
          outside click closes. */}
      <div
        ref={containerRef}
        className="relative lg:hidden"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          className="text-foreground flex cursor-pointer items-center gap-2 text-sm font-medium"
        >
          Browse
          <span
            aria-hidden="true"
            className={`border-t-foreground border-x-4 border-t-[5px] border-x-transparent transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        {open && (
          <div role="menu" className="absolute top-full left-0 pt-3">
            <div className="bg-background/90 border-foreground/15 border py-2">
              {navLinks.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`block px-6 py-2 text-[13px] whitespace-nowrap hover:underline ${
                    pathname === href
                      ? "text-foreground font-medium"
                      : "text-foreground/85"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
