import Spinner from "@/components/watch/spinner";

// Covers the server-side metadata fetch during the route transition; the
// player then shows the same loader while /api/stream resolves, so Play ->
// video reads as one continuous loading screen. Full-screen loading surfaces
// carry the loading line (coding-standards.md §Errors); the mid-playback
// buffering overlay never does.
export default function WatchLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black">
      <Spinner />
      <p className="text-muted">Meemaw is untangling the yarn…</p>
    </div>
  );
}
