"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// The nav search box (expanding input: width slides open on focus, black fill
// + white border while open - MUI "complex" 375 ms ease-in timing), with live
// routing on top: typing replaces /search?q=<term>
// (debounced) and clearing returns to /browse. router.replace throughout so
// the back button jumps straight back to browse instead of every keystroke.
// A box holding text stays open on blur - a :focus-driven width would
// collapse over the text.
const DEBOUNCE_MS = 300;

export default function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = pathname === "/search" ? (searchParams.get("q") ?? "") : "";

  const [value, setValue] = useState(urlQuery);
  const [isOpen, setIsOpen] = useState(urlQuery !== "");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // URL -> box sync (back/forward, nav links, direct /search?q= visits) - never
  // while typing: the focused input is the source of truth until its debounce
  // commits to the URL.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setValue(urlQuery);
    setIsOpen(urlQuery !== "");
  }, [urlQuery]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const navigateFor = (term: string) => {
    const trimmed = term.trim();
    if (trimmed !== "") {
      router.replace(`/search?q=${encodeURIComponent(trimmed)}`);
    } else if (window.location.pathname === "/search") {
      // Ground-truth pathname: a debounce can fire mid-navigation, after the
      // render this closure came from.
      router.replace("/browse");
    }
  };

  const handleChange = (next: string) => {
    setValue(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigateFor(next), DEBOUNCE_MS);
  };

  const flushNow = (term: string) => {
    clearTimeout(debounceRef.current);
    navigateFor(term);
  };

  const handleIconClick = () => {
    if (!isOpen) setIsOpen(true);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    setValue("");
    inputRef.current?.focus();
    flushNow("");
  };

  // mousedown preventDefault on both buttons keeps the input focused through
  // the click - otherwise blur fires first and an empty box collapses under it.
  const keepInputFocus = (event: React.MouseEvent) => event.preventDefault();

  return (
    <div
      className={`flex items-center border transition-colors duration-[375ms] ${
        isOpen
          ? "border-white bg-black/90"
          : "border-transparent bg-transparent"
      }`}
    >
      <button
        type="button"
        aria-label="Search"
        onMouseDown={keepInputFocus}
        onClick={handleIconClick}
        className="text-foreground cursor-pointer p-1"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.35-4.35" strokeLinecap="round" />
        </svg>
      </button>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") flushNow(value);
        }}
        onBlur={() => {
          if (value.trim() === "") setIsOpen(false);
        }}
        placeholder="Titles, people, genres"
        aria-label="Search"
        className={`placeholder:text-muted bg-transparent py-1.5 text-sm transition-[width] duration-[375ms] ease-in outline-none ${
          isOpen ? "w-36 pr-1 sm:w-[212px]" : "w-0"
        }`}
      />
      {isOpen && value !== "" && (
        <button
          type="button"
          aria-label="Clear search"
          onMouseDown={keepInputFocus}
          onClick={handleClear}
          className="text-foreground cursor-pointer px-1"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            className="h-5 w-5"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}
