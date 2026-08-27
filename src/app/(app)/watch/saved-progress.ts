import { getProgressFor, type ProgressTarget } from "@/lib/db/watch-progress";
import { resumePosition } from "@/lib/progress/rules";

// Where a watch page should start: the saved position, or 0 for nothing saved
// / a finished title. A progress read failure must never block playback - it
// logs and plays from the top.
export async function savedStartAt(target: ProgressTarget): Promise<number> {
  try {
    return resumePosition(await getProgressFor(target));
  } catch (error) {
    console.error("[watch] progress lookup failed", error);
    return 0;
  }
}
