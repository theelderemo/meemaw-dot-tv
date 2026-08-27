"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DetailModalContent from "./detail-modal-content";
import {
  titleKey,
  useDetailModal,
  type DetailTarget,
} from "./detail-modal-provider";

// The detail modal: 900px max width (MUI "md"), scroll="body",
// slide-up transition (225 ms in / 195 ms out on MUI's easing), #181818 body.
// Deliberate departure: no URL deep-linking for the modal - its state
// lives in the client provider only.
const ENTER_EASE = "cubic-bezier(0,0,0.2,1)";
const EXIT_MS = 195;

export default function DetailModal() {
  const { target, close, getDetails, hasDetailsError, loadDetails } =
    useDetailModal();

  // `shown` lags `target` on close so the exit animation plays over the last
  // content; `entered` drives both transitions. Render-time state adjustment
  // (React's "adjusting state when props change" pattern) - swapping titles
  // while open keeps entered true, so content swaps in place.
  const [shown, setShown] = useState<DetailTarget | null>(null);
  const [entered, setEntered] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  if (target && target !== shown) setShown(target);
  if (!target && entered) setEntered(false);

  const isOpen = shown !== null;
  const shownKey = shown ? titleKey(shown) : null;

  useEffect(() => {
    if (target) {
      // Two frames so a fresh mount paints once at the slide-down start state.
      let innerFrame = 0;
      const frame = requestAnimationFrame(() => {
        innerFrame = requestAnimationFrame(() => setEntered(true));
      });
      return () => {
        cancelAnimationFrame(frame);
        cancelAnimationFrame(innerFrame);
      };
    }
    const timeout = setTimeout(() => setShown(null), EXIT_MS);
    return () => clearTimeout(timeout);
  }, [target]);

  // Body scroll lock, with scrollbar-width compensation so the page doesn't
  // shift while the modal is up.
  useEffect(() => {
    if (!isOpen) return;
    const { overflow, paddingRight } = document.body.style;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [isOpen]);

  // Focus moves into the dialog on open and back to the opener on close.
  useEffect(() => {
    if (!isOpen) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    panelRef.current?.focus();
    return () => opener?.focus();
  }, [isOpen]);

  // Escape closes; Tab wraps within the dialog (aria-modal needs the keyboard
  // to actually stay inside).
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  // Swapping to a More Like This title restarts the modal at the top.
  useEffect(() => {
    if (shownKey) scrollRef.current?.scrollTo(0, 0);
  }, [shownKey]);

  if (!shown) return null;

  const details = getDetails(shown);
  const failed = hasDetailsError(shown);

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-black/70 transition-opacity duration-[225ms] ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Full-screen scroll container doubles as the overlay click target. */}
      <div
        ref={scrollRef}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="absolute inset-0 overflow-y-auto overscroll-contain"
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={details?.title ?? "Title details"}
          tabIndex={-1}
          style={{
            transition: `transform ${entered ? 225 : EXIT_MS}ms ${ENTER_EASE}, opacity ${entered ? 225 : EXIT_MS}ms ${ENTER_EASE}`,
          }}
          className={`bg-background-elevated relative mx-auto my-8 w-[calc(100%-2rem)] max-w-[900px] overflow-hidden rounded-md shadow-2xl outline-none ${
            entered ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
          }`}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="bg-background-elevated hover:bg-primary absolute top-[15px] right-[15px] z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="h-[22px] w-[22px]"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          {details ? (
            <DetailModalContent key={shownKey} details={details} />
          ) : failed ? (
            <DetailError retry={() => loadDetails(shown)} />
          ) : (
            <DetailSkeleton />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DetailError({ retry }: { retry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 px-10 py-28 text-center">
      <p className="text-lg">
        Meemaw&apos;s photo album is stuck together. Give it another try.
      </p>
      <button
        type="button"
        onClick={retry}
        className="bg-background-input cursor-pointer rounded px-6 py-2 font-medium transition-colors hover:bg-neutral-600"
      >
        Try again
      </button>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading…
      </p>
      <div aria-hidden="true">
        <div className="aspect-video w-full animate-pulse bg-neutral-800" />
        <div className="flex flex-col gap-4 px-4 py-8 sm:px-6 md:px-10">
          <div className="h-7 w-1/3 animate-pulse rounded bg-neutral-800" />
          <div className="h-4 w-full animate-pulse rounded bg-neutral-800" />
          <div className="h-4 w-full animate-pulse rounded bg-neutral-800" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-800" />
        </div>
      </div>
    </div>
  );
}
