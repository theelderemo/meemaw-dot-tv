"use client";

import { useSyncExternalStore } from "react";

function subscribe(onScroll: () => void): () => void {
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}

/** True once the page has scrolled past `top` px. */
export default function useOffsetTop(top: number): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > top,
    () => false,
  );
}
