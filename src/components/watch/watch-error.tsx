import Link from "next/link";

// Player failure copy (coding-standards §Errors): a Meemaw-voice
// line, then a plain what-to-do line where one helps, then the real error
// code, small and muted - never as the headline.
export type WatchErrorKind =
  | "not-found"
  | "not-cached"
  | "not-cached-manual"
  | "provider-down"
  | "internal"
  | "bad-request"
  | "generic";

export const WATCH_ERROR_MESSAGES: Record<WatchErrorKind, string> = {
  "not-found": "Meemaw couldn't find the recipe for this one.",
  "not-cached": "This one isn't in Meemaw's pantry right now.",
  "not-cached-manual": "Meemaw lost her glasses - try another link, dear.",
  "provider-down":
    "The bridge club is using all the bandwidth. Check back after Bingo.",
  // BAD_REQUEST is a bug, not a mood: plain generic copy.
  "bad-request": "Something's not right with that request.",
  internal: "Meemaw dropped a stitch. Give it another go.",
  // No API code to show (network failure, dead playback): same line, no code.
  generic: "Meemaw dropped a stitch. Give it another go.",
};

export const WATCH_ERROR_INSTRUCTIONS: Partial<Record<WatchErrorKind, string>> =
  {
    "not-found": "Try another title.",
    "not-cached": "Try another title, or check back later.",
  };

// Statuses per the /api/stream contract (stream-resolution.md).
export const WATCH_ERROR_CODES: Partial<Record<WatchErrorKind, string>> = {
  "not-found": "NOT_FOUND · 404",
  "not-cached": "NOT_CACHED · 404",
  "not-cached-manual": "NOT_CACHED · 404",
  "provider-down": "PROVIDER_DOWN · 503",
  "bad-request": "BAD_REQUEST · 400",
  internal: "INTERNAL · 500",
};

// A title or episode reached by URL before its TMDB release date; the date
// arrives formatted from release.ts comingDate().
export function notOutYetMessage(comingDate: string): string {
  return `This one isn't out yet - it arrives ${comingDate}.`;
}

// Full-bleed friendly failure screen: the copy stack and one giant way out -
// the viewer must never be stuck on a black screen.
export default function WatchError({
  message,
  instruction,
  code,
  action,
}: {
  message: string;
  /** The plain what-to-do line under the brand line. */
  instruction?: string;
  /** Muted `CODE · status` line, the quietest element on the screen. */
  code?: string;
  /** An optional second way out beside Back to Browse (Switch Streams). */
  action?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 bg-black px-6 text-center">
      <div className="flex max-w-2xl flex-col items-center gap-4">
        <p className="text-2xl sm:text-3xl">{message}</p>
        {instruction && <p className="text-lg">{instruction}</p>}
        {code && <p className="text-muted text-sm">{code}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {action}
        <Link
          href="/browse"
          className="rounded bg-white px-10 py-4 text-xl font-bold text-black transition-colors hover:bg-white/75"
        >
          Back to Browse
        </Link>
      </div>
    </div>
  );
}
