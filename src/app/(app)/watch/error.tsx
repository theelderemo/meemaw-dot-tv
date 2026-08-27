"use client";

import { useEffect } from "react";
import WatchError, {
  WATCH_ERROR_CODES,
  WATCH_ERROR_MESSAGES,
} from "@/components/watch/watch-error";

// Route-level boundary: an unexpected server crash (TMDB down mid-render)
// still lands on the friendly screen with a way out, never a dead page.
export default function WatchErrorBoundary({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("[watch] INTERNAL (500)", error);
  }, [error]);

  return (
    <WatchError
      message={WATCH_ERROR_MESSAGES.internal}
      code={WATCH_ERROR_CODES.internal}
    />
  );
}
