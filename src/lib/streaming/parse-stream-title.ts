// Boundary parser for Torrentio's stream `title` text blob (coding-standards
// §5): the emoji-delimited blob is turned into OUR ParsedStream shape here and
// never leaks further. Shaped by the Aug 2026 captures in __fixtures__ (256
// streams, structure 100% consistent):
//
//   line 1            torrent/release name
//   line 2 (optional) file-within-torrent name - season packs / collections
//   stats line        "👤 <seeders> 💾 <size> <GB|MB> ⚙️ <provider>"
//   last (optional)   audio languages - "Multi Audio / 🇬🇧 / 🇷🇺", "🇫🇷", …
//
// Pure function, no I/O. Anything unexpected degrades to null/[]/false -
// parsing never throws (junk fuzzy-matches are real: see the Pokémon pack in
// the Dune capture).

export type Resolution = "2160p" | "1440p" | "1080p" | "720p" | "480p" | "360p";

export type CodecHint =
  "h264" | "h265" | "av1" | "xvid" | "10bit" | "hdr" | "dv" | "3d";

export type SourceHint =
  | "cam"
  | "telesync"
  | "telecine"
  | "screener"
  | "webdl"
  | "webrip"
  | "bluray"
  | "bdrip"
  | "hdrip"
  | "hdtv"
  | "dvdrip";

export type ContainerHint = "mkv" | "mp4" | "m4v" | "avi" | "ts" | "wmv";

export type ParsedStream = {
  /** Line 1 of the blob - the torrent-level release name. */
  releaseName: string | null;
  resolution: Resolution | null;
  /** Size of the specific video file (verified against captures), not the torrent. */
  sizeBytes: number | null;
  seeders: number | null;
  /** Indexer the stream was scraped from ("TorrentGalaxy", "Rutracker", …). */
  provider: string | null;
  /** Rip source - feeds both exclusions (cam/telesync/…) and the source bonus. */
  sourceHint: SourceHint | null;
  codecHints: CodecHint[];
  containerHint: ContainerHint | null;
  /**
   * Audio-language signals, normalized lowercase ("en", "ru", "multi",
   * "dual", …). Empty means no signal - which in practice means plain
   * English; Torrentio only annotates non-original audio.
   */
  languageHints: string[];
  /** True when the stream points into a multi-video torrent (season pack / collection). */
  seasonPack: boolean;
  /**
   * True when the file line names a non-feature video (extras/samples -
   * captures include an "Inside the Episode" featurette fuzzy-matched as
   * TLOU S01E03). Playing one of these would be worse than failing.
   */
  extrasFile: boolean;
};

const STATS_MARKERS = /[👤💾⚙]/u;
const SEEDERS_PATTERN = /👤\s*([\d,]+)/u;
const SIZE_PATTERN = /💾\s*([\d,.]+)\s*([kmgt]b)\b/iu;
const PROVIDER_PATTERN = /⚙️?\s*(.*\S)\s*$/u;

const SIZE_MULTIPLIERS: Record<string, number> = {
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4,
};

const CONTAINER_EXTENSION = /\.(mkv|mp4|m4v|avi|ts|wmv)\s*$/i;

// First match wins - junk sources first so hybrid names ("1080p X264 HDTS")
// stay marked as junk, webrip before webdl so bare "WEB" doesn't claim rips.
const SOURCE_PATTERNS: ReadonlyArray<readonly [SourceHint, RegExp]> = [
  ["cam", /\b(?:hd)?cam(?:rip)?\b/i],
  ["telesync", /\b(?:hd[-. ]?ts|tele[-. ]?sync|ts)\b/i],
  ["telecine", /\b(?:hd[-. ]?tc|tele[-. ]?cine|tc)\b/i],
  ["screener", /\b(?:dvd[-. ]?scr|bd[-. ]?scr|screener|scr|r5)\b/i],
  ["webrip", /\bweb[-. ]?(?:rip|mux)\b/i],
  ["webdl", /\bweb(?:[-. ]?dl)?\b/i],
  ["bluray", /\b(?:blu[-. ]?ray|bd[-. ]?remux|remux)\b/i],
  ["bdrip", /\b(?:bd|br)[-. ]?rip\b/i],
  ["hdrip", /\bhd[-. ]?rip\b/i],
  ["hdtv", /\b(?:hdtv|pdtv|satrip|tvrip)\b/i],
  ["dvdrip", /\bdvd[-. ]?rip\b/i],
];

// Output order is this list's order (deterministic for tests/logs).
const CODEC_PATTERNS: ReadonlyArray<readonly [CodecHint, RegExp]> = [
  ["h264", /\b(?:x[-. ]?264|h[-. ]?264|avc)\b/i],
  ["h265", /\b(?:x[-. ]?265|h[-. ]?265|hevc)\b/i],
  ["av1", /\bav1\b/i],
  ["xvid", /\b(?:xvid|divx)\b/i],
  ["10bit", /10[-. _]?bit\b/i],
  ["hdr", /\bhdr(?:10)?\b/i],
  ["dv", /\b(?:dv|dovi|dolby[-. ]?vision)\b/i],
  ["3d", /\b(?:3d|fs3d|h?sbs|half[-. ]?(?:sbs|ou)|hou)\b/i],
];

const LANGUAGE_TOKEN_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ["en", /\b(?:eng|english)\b/i],
  ["it", /\b(?:ita|italian)\b/i],
  ["fr", /\b(?:french|truefrench)\b/i],
  ["es", /\b(?:spanish|castellano|latino|espanol)\b/i],
  ["hi", /\bhindi\b/i],
  ["ru", /\b(?:rus|russian)\b/i],
  ["uk", /\b(?:ukr|ukrainian)\b/i],
  ["de", /\bgerman\b/i],
  ["pl", /\b(?:polish|lektor)\b/i],
  ["pt", /\b(?:portuguese|legendado)\b/i],
  // "MULTi4" (four audio languages) counts; "Multi-Subs"/"MultiSubs" is about
  // subtitles and must not - a false audio hint would exclude a
  // perfectly good English release.
  ["multi", /\bmulti\d*\b(?![-. ]?subs?\b)/i],
  ["dual", /\bdual\b/i],
  ["dubbed", /\bdubbed\b/i],
];

// Flag lines list audio languages as country flags; only "Multi/Dual Audio"
// text counts there ("Multi Subs" is about subtitles, not audio).
const AUDIO_MARKER_PATTERN = /\b(multi|dual)[-. ]?audio\b/i;
const REGIONAL_INDICATOR_PAIR = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;

const FLAG_LANGUAGES: Record<string, string> = {
  gb: "en",
  us: "en",
  au: "en",
  ie: "en",
  it: "it",
  es: "es",
  mx: "es",
  ar: "es",
  fr: "fr",
  de: "de",
  pl: "pl",
  cz: "cs",
  jp: "ja",
  ru: "ru",
  ua: "uk",
  in: "hi",
  pt: "pt",
  br: "pt",
  dk: "da",
  fi: "fi",
  se: "sv",
  no: "no",
  nl: "nl",
  hu: "hu",
  gr: "el",
  tr: "tr",
  kr: "ko",
  cn: "zh",
};

// Scanned on the file line only - pack names legitimately advertise
// "+ 2xBonus" etc. without the picked file being an extra.
const EXTRAS_FILE_MARKER =
  /\b(?:sample|extras?|featurettes?|bloopers?|deleted[ ._-]scenes?|behind[ ._-]the[ ._-]scenes|inside[ ._-]the[ ._-]episode|trailers?|bonus)\b/i;

// A single-file torrent has no file line, so a trailer torrent names itself
// on the release line - live: Moana (2026)'s only stream was "Moana (2026)
// Trailer 2 FS3D 1080p WEB-DL …" (267 MB) and it resolved and played. Unlike
// "bonus"/"extras", no feature or pack advertises "trailer"/"teaser" in its
// name - except titles that contain the word: Trailer Park Boys (and Trailer
// Park Shark) are the exception the lookahead spares.
const NON_FEATURE_RELEASE_MARKER = /\b(?:trailers?|teasers?)\b(?![ ._-]?park)/i;

const EPISODE_MARKER = /\bs\d{1,2}[ ._-]?e\d{1,3}\b|\b\d{1,2}x\d{2,3}\b/i;
const SEASON_MARKER =
  /\bseasons?\b|\bs\d{1,2}[ ._]?-[ ._]?s?\d{1,2}\b|stagion|temporada|сезон/i;

function flagToCountryCode(flag: string): string {
  const letters = Array.from(flag).map((half) =>
    // Regional indicators map 1:1 onto A–Z; offset converts to lowercase ASCII.
    String.fromCharCode((half.codePointAt(0) ?? 0) - 0x1f1e6 + 0x61),
  );
  return letters.join("");
}

function parseResolution(texts: string[]): Resolution | null {
  for (const text of texts) {
    const explicit = text.match(/\b(2160|1440|1080|720|480|360)p\b/i);
    if (explicit) return `${explicit[1]}p` as Resolution;
  }
  for (const text of texts) {
    if (/\b(?:4k|uhd)\b/i.test(text)) return "2160p";
    if (/\bsd\b/i.test(text)) return "480p";
  }
  return null;
}

function parseSizeBytes(statsLine: string): number | null {
  const match = statsLine.match(SIZE_PATTERN);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  const multiplier = SIZE_MULTIPLIERS[match[2].toLowerCase()];
  if (!Number.isFinite(amount) || multiplier === undefined) return null;
  return Math.round(amount * multiplier);
}

function parseLanguageHints(
  flagLines: string[],
  contentText: string,
): string[] {
  const hints: string[] = [];
  const add = (hint: string) => {
    if (!hints.includes(hint)) hints.push(hint);
  };
  for (const line of flagLines) {
    const marker = line.match(AUDIO_MARKER_PATTERN);
    if (marker) add(marker[1].toLowerCase());
    for (const flag of line.match(REGIONAL_INDICATOR_PAIR) ?? []) {
      const country = flagToCountryCode(flag);
      add(FLAG_LANGUAGES[country] ?? country);
    }
  }
  for (const [hint, pattern] of LANGUAGE_TOKEN_PATTERNS) {
    if (pattern.test(contentText)) add(hint);
  }
  return hints;
}

function parseSeasonPack(releaseLine: string, hasFileLine: boolean): boolean {
  if (EPISODE_MARKER.test(releaseLine)) return false;
  return hasFileLine || SEASON_MARKER.test(releaseLine);
}

export function parseStreamTitle(title: string): ParsedStream {
  const lines = title.split("\n");
  const statsIndex = lines.findIndex((line) => STATS_MARKERS.test(line));
  const contentLines = statsIndex === -1 ? lines : lines.slice(0, statsIndex);
  const statsLine = statsIndex === -1 ? "" : lines[statsIndex];
  const flagLines = statsIndex === -1 ? [] : lines.slice(statsIndex + 1);

  const releaseLine = contentLines[0]?.trim() ?? "";
  const fileLine = contentLines[1]?.trim() ?? "";

  // Container comes from a trailing file extension; strip it before token
  // scans so ".ts" (MPEG-TS files) can't read as a TeleSync source marker.
  const containerMatch =
    fileLine.match(CONTAINER_EXTENSION) ??
    releaseLine.match(CONTAINER_EXTENSION);
  const strippedRelease = releaseLine.replace(CONTAINER_EXTENSION, "");
  const strippedFile = fileLine.replace(CONTAINER_EXTENSION, "");
  const contentText = `${strippedRelease} ${strippedFile}`.trim();

  const seedersMatch = statsLine.match(SEEDERS_PATTERN);
  const providerMatch = statsLine.match(PROVIDER_PATTERN);

  return {
    releaseName: releaseLine === "" ? null : releaseLine,
    // The file line names the exact video we'd play, so it wins over the
    // torrent name (a 2160p pack can carry a 1080p cut and vice versa).
    resolution: parseResolution([strippedFile, strippedRelease]),
    sizeBytes: parseSizeBytes(statsLine),
    seeders: seedersMatch ? Number(seedersMatch[1].replace(/,/g, "")) : null,
    provider: providerMatch ? providerMatch[1] : null,
    sourceHint:
      SOURCE_PATTERNS.find(([, pattern]) => pattern.test(contentText))?.[0] ??
      null,
    codecHints: CODEC_PATTERNS.filter(([, pattern]) =>
      pattern.test(contentText),
    ).map(([hint]) => hint),
    containerHint: containerMatch
      ? (containerMatch[1].toLowerCase() as ContainerHint)
      : null,
    languageHints: parseLanguageHints(flagLines, contentText),
    seasonPack:
      releaseLine !== "" && parseSeasonPack(releaseLine, fileLine !== ""),
    extrasFile:
      EXTRAS_FILE_MARKER.test(strippedFile) ||
      NON_FEATURE_RELEASE_MARKER.test(releaseLine),
  };
}
