import { TmdbError } from "@/lib/tmdb/client";

// A TMDB 404 (unknown id, unaired season) reads as "we don't have that one";
// anything else stays a real fault for the route's error boundary. Keeps the
// pages' JSX out of try/catch (react-hooks/error-boundaries).
export async function orNotFound<T>(fetching: Promise<T>): Promise<T | null> {
  try {
    return await fetching;
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) return null;
    throw error;
  }
}
