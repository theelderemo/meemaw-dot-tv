const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// Defense in depth: no code path puts the token in a message (it travels only
// in the Authorization header), but every TmdbError message is scrubbed anyway
// so a future mistake can't leak it into logs or error pages.
function redactToken(text: string): string {
  const token = process.env.TMDB_API_READ_TOKEN;
  return token ? text.split(token).join("[redacted]") : text;
}

export class TmdbError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null, options?: ErrorOptions) {
    super(redactToken(message), options);
    this.name = "TmdbError";
    this.status = status;
  }
}

export type TmdbRequestOptions = {
  searchParams?: Record<string, string | number | undefined>;
  /** Seconds for Next's fetch cache; 0 = never cache (`no-store`). */
  revalidate: number;
};

export async function tmdbFetch(
  path: string,
  { searchParams, revalidate }: TmdbRequestOptions,
): Promise<unknown> {
  if (typeof window !== "undefined") {
    throw new TmdbError("tmdbFetch must only run on the server", null);
  }
  const token = process.env.TMDB_API_READ_TOKEN;
  if (!token) {
    throw new TmdbError(
      "TMDB_API_READ_TOKEN is not set in the server env",
      null,
    );
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      ...(revalidate === 0
        ? { cache: "no-store" as const }
        : { next: { revalidate } }),
    });
  } catch (cause) {
    throw new TmdbError(`TMDB request failed to connect: ${path}`, null, {
      cause,
    });
  }

  if (!response.ok) {
    const detail = await readStatusMessage(response);
    throw new TmdbError(
      `TMDB responded ${response.status} on ${path}${detail ? `: ${detail}` : ""}`,
      response.status,
    );
  }

  try {
    return await response.json();
  } catch (cause) {
    throw new TmdbError(`TMDB returned non-JSON on ${path}`, response.status, {
      cause,
    });
  }
}

// TMDB error bodies carry a human-readable status_message ("Invalid id: ...").
async function readStatusMessage(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "status_message" in body &&
      typeof body.status_message === "string"
    ) {
      return body.status_message;
    }
  } catch {
    // Non-JSON error body - the status code alone is enough.
  }
  return null;
}
