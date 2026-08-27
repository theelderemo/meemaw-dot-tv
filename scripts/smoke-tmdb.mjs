// Live smoke: loads .env.local, hits the real TMDB API for each
// configured browse row plus one details lookup, and prints the first titles
// of each. Plain JS on purpose - it proves the token and the live queries;
// the lib itself is proven by build + tests.
//
// The row queries below mirror src/lib/tmdb/rows.ts (keep in sync by hand).
// Run with: node scripts/smoke-tmdb.mjs
import { readFileSync } from "node:fs";

const BASE = "https://api.themoviedb.org/3";

function loadToken() {
  let text;
  try {
    text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    throw new Error(".env.local not found next to package.json");
  }
  for (const line of text.split("\n")) {
    const match = line.match(/^TMDB_API_READ_TOKEN=(.*)$/);
    if (match) {
      const value = match[1].trim().replace(/^["']|["']$/g, "");
      if (value) return value;
    }
  }
  throw new Error("TMDB_API_READ_TOKEN missing from .env.local");
}

const token = loadToken();

async function tmdb(path, params = {}) {
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) {
    // Status only - never echo bodies or headers from a failed auth exchange.
    throw new Error(`TMDB responded ${response.status} on ${path}`);
  }
  return response.json();
}

// Mirror of browseRows in src/lib/tmdb/rows.ts.
const rows = [
  { label: "Trending Now", path: "/trending/all/week", params: {} },
  {
    label: "Comedy Movies",
    path: "/discover/movie",
    params: { with_genres: "35", sort_by: "popularity.desc" },
  },
  {
    label: "Horror & Thrillers",
    path: "/discover/movie",
    params: { with_genres: "27|53", sort_by: "popularity.desc" },
  },
  {
    label: "Popular TV Shows",
    path: "/discover/tv",
    params: {
      without_genres: "10763|10767",
      with_original_language: "en",
      sort_by: "popularity.desc",
    },
  },
  {
    label: "Classic Sitcoms",
    path: "/discover/tv",
    params: {
      with_genres: "35",
      without_genres: "16",
      "first_air_date.lte": "2005-12-31",
      with_original_language: "en",
      sort_by: "vote_count.desc",
    },
  },
];

const displayName = (item) => item.title ?? item.name ?? "(untitled)";
const displayYear = (item) => {
  const date = item.release_date ?? item.first_air_date ?? "";
  return date ? ` (${date.slice(0, 4)})` : "";
};

let detailSubject = null;
for (const row of rows) {
  const page = await tmdb(row.path, row.params);
  const titles = page.results
    .filter((item) => item.media_type !== "person")
    .slice(0, 3);
  if (titles.length === 0)
    throw new Error(`row "${row.label}" came back empty`);
  console.log(
    `${row.label}: ${titles.map((t) => displayName(t) + displayYear(t)).join(" · ")}`,
  );
  if (row.label === "Classic Sitcoms") {
    detailSubject = titles[0];
  }
}

const details = await tmdb(`/tv/${detailSubject.id}`, {
  append_to_response: "external_ids,credits,recommendations,videos",
});
const imdbId = details.external_ids?.imdb_id;
console.log(
  `Details: ${details.name} [tv ${details.id}] → imdbId ${imdbId ?? "MISSING"}`,
);
if (!imdbId) {
  throw new Error("details lookup did not resolve an imdbId");
}
