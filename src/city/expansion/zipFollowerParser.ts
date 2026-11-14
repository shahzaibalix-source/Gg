import {
  CompactShardEntry,
  FollowerRecord,
  ParsedFollowerDataset,
} from './types';

export const VIP_TARGET_USERNAME_LOWER = 'sweet_thedevil';
export const VIP_DISPLAY_LABEL = 'Sweet_thedevil';
export const BUNDLED_ARCHIVE_PATH =
  '/assets/aistudio/instagram-cityofoldow-2026-11-13-slO8lUZ9_2d52143b.zip';
export const BUNDLED_SEED_JSON_PATH = '/data/lindenhof-followers-seed.json';

interface RawExtractedFollower {
  username: string;
  joinedAt: string;
  joinedTimestamp: number;
  originalOrder: number;
}

/**
 * Extracts raw text for `followers_1.html` (or any matching followers*.html entry)
 * from a standard PKZIP ArrayBuffer using stored (0) or Web DecompressionStream('deflate-raw') (8).
 */
export async function extractFollowersHtmlFromZipBuffer(
  buffer: ArrayBuffer,
): Promise<{ htmlText: string; entryName: string }> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Locate End of Central Directory (0x06054b50)
  let eocdOffset = -1;
  const searchStart = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= searchStart; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error('Invalid ZIP archive: End of Central Directory signature missing.');
  }

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder('utf-8');

  let pos = cdOffset;
  let fallbackHtml: { compMethod: number; dataStart: number; compSize: number; name: string } | null =
    null;
  let targetEntry: { compMethod: number; dataStart: number; compSize: number; name: string } | null =
    null;

  for (let i = 0; i < entryCount; i++) {
    if (pos + 46 > bytes.length || view.getUint32(pos, true) !== 0x02014b50) {
      throw new Error('Corrupt ZIP Central Directory entry.');
    }
    const compMethod = view.getUint16(pos + 10, true);
    const compSize = view.getUint32(pos + 20, true);
    const fnLen = view.getUint16(pos + 28, true);
    const exLen = view.getUint16(pos + 30, true);
    const cmLen = view.getUint16(pos + 32, true);
    const lfhOffset = view.getUint32(pos + 42, true);

    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + fnLen));
    const lowerName = name.toLowerCase();

    if (lowerName.endsWith('followers_1.html')) {
      const lfnLen = view.getUint16(lfhOffset + 26, true);
      const lexLen = view.getUint16(lfhOffset + 28, true);
      targetEntry = {
        compMethod,
        dataStart: lfhOffset + 30 + lfnLen + lexLen,
        compSize,
        name,
      };
      break;
    }

    if (!fallbackHtml && lowerName.includes('followers') && lowerName.endsWith('.html')) {
      const lfnLen = view.getUint16(lfhOffset + 26, true);
      const lexLen = view.getUint16(lfhOffset + 28, true);
      fallbackHtml = {
        compMethod,
        dataStart: lfhOffset + 30 + lfnLen + lexLen,
        compSize,
        name,
      };
    }

    pos += 46 + fnLen + exLen + cmLen;
  }

  const chosen = targetEntry ?? fallbackHtml;
  if (!chosen) {
    throw new Error('No Instagram followers HTML file found inside ZIP archive.');
  }

  const slice = bytes.subarray(chosen.dataStart, chosen.dataStart + chosen.compSize);
  if (chosen.compMethod === 0) {
    return { htmlText: decoder.decode(slice), entryName: chosen.name };
  }
  if (chosen.compMethod === 8) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Browser DecompressionStream is unavailable for deflated ZIP entries.');
    }
    const ds = new DecompressionStream('deflate-raw');
    const decompressedStream = new Blob([slice]).stream().pipeThrough(ds);
    const outBuffer = await new Response(decompressedStream).arrayBuffer();
    return { htmlText: decoder.decode(new Uint8Array(outBuffer)), entryName: chosen.name };
  }

  throw new Error(`Unsupported ZIP compression method (${chosen.compMethod}).`);
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Parses Instagram export HTML (connections/followers_and_following/followers_1.html)
 * and builds the verified 50-OG + VIP-1 + remaining unique residents dataset without inventing any data.
 */
export function parseInstagramFollowersHtml(
  htmlText: string,
  sourceName: string,
): ParsedFollowerDataset {
  const cardRegex =
    /<a[^>]*href="https:\/\/www\.instagram\.com\/([^"/?#]+)\/?"[^>]*>([^<]+)<\/a><\/div><div>([^<]+)<\/div>/gi;

  const rawList: RawExtractedFollower[] = [];
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = cardRegex.exec(htmlText)) !== null) {
    const hrefUser = decodeHtmlEntities(match[1]).trim();
    const labelUser = decodeHtmlEntities(match[2]).trim();
    const joinedAt = decodeHtmlEntities(match[3]).trim();
    const username = labelUser || hrefUser;
    if (!username) continue;

    const parsedTs = Date.parse(joinedAt);
    rawList.push({
      username,
      joinedAt,
      joinedTimestamp: Number.isFinite(parsedTs) ? parsedTs : 0,
      originalOrder: idx++,
    });
  }

  if (rawList.length === 0) {
    throw new Error('Could not find any follower records in the provided Instagram HTML.');
  }

  return buildFollowerDatasetFromRaw(rawList, sourceName);
}

/**
 * Builds deduplicated OG-50 (VIP #1 + 49 oldest unique followers) and remaining residents.
 */
export function buildFollowerDatasetFromRaw(
  rawList: RawExtractedFollower[],
  sourceName: string,
): ParsedFollowerDataset {
  const dedupMap = new Map<string, RawExtractedFollower>();
  for (const row of rawList) {
    const key = row.username.trim().toLowerCase();
    if (!key) continue;
    const existing = dedupMap.get(key);
    // Keep the earliest recorded join date / oldest originalOrder when deduplicating
    if (
      !existing ||
      row.joinedTimestamp < existing.joinedTimestamp ||
      (row.joinedTimestamp === existing.joinedTimestamp && row.originalOrder > existing.originalOrder)
    ) {
      dedupMap.set(key, row);
    }
  }

  const uniqueRaw = Array.from(dedupMap.values());
  const duplicatesRemoved = Math.max(0, rawList.length - uniqueRaw.length);

  // Oldest first: ascending timestamp, tie-break by descending originalOrder (since IG HTML lists newest first)
  const oldestFirst = [...uniqueRaw].sort((a, b) => {
    if (a.joinedTimestamp !== b.joinedTimestamp) {
      return a.joinedTimestamp - b.joinedTimestamp;
    }
    return b.originalOrder - a.originalOrder;
  });

  const oldestRankByKey = new Map<string, number>();
  oldestFirst.forEach((entry, i) => {
    oldestRankByKey.set(entry.username.toLowerCase(), i + 1);
  });

  const vipRaw = oldestFirst.find((e) => e.username.toLowerCase() === VIP_TARGET_USERNAME_LOWER) ?? null;

  // Select 49 oldest OTHER followers + Special #1 VIP => exactly 50 unique OG members
  const ogOtherRaw: RawExtractedFollower[] = [];
  for (const entry of oldestFirst) {
    if (vipRaw && entry.username.toLowerCase() === vipRaw.username.toLowerCase()) continue;
    if (ogOtherRaw.length < (vipRaw ? 49 : 50)) {
      ogOtherRaw.push(entry);
    } else {
      break;
    }
  }

  const ogKeys = new Set<string>();
  const ogMembers: FollowerRecord[] = [];

  if (vipRaw) {
    const k = vipRaw.username.toLowerCase();
    ogKeys.add(k);
    ogMembers.push({
      residentId: 'RES-0001',
      plotId: 'og-01',
      plotCode: 'OG-01',
      username: vipRaw.username,
      usernameKey: k,
      joinedAt: vipRaw.joinedAt,
      joinedTimestamp: vipRaw.joinedTimestamp,
      originalOrder: vipRaw.originalOrder,
      oldestRank: oldestRankByKey.get(k) ?? 1,
      tier: 'vip-1',
      ogRank: 1,
    });
  }

  ogOtherRaw.forEach((entry, i) => {
    const ogRank = (vipRaw ? 2 : 1) + i;
    const k = entry.username.toLowerCase();
    ogKeys.add(k);
    ogMembers.push({
      residentId: `RES-${String(ogRank).padStart(4, '0')}`,
      plotId: `og-${String(ogRank).padStart(2, '0')}`,
      plotCode: `OG-${String(ogRank).padStart(2, '0')}`,
      username: entry.username,
      usernameKey: k,
      joinedAt: entry.joinedAt,
      joinedTimestamp: entry.joinedTimestamp,
      originalOrder: entry.originalOrder,
      oldestRank: oldestRankByKey.get(k) ?? ogRank,
      tier: 'og-50',
      ogRank,
    });
  });

  // Remaining unique followers follow chronological oldest-first progression
  const remainingRaw = oldestFirst.filter((e) => !ogKeys.has(e.username.toLowerCase()));
  const remainingResidents: FollowerRecord[] = remainingRaw.map((entry, idx) => {
    const num = ogMembers.length + idx + 1;
    const k = entry.username.toLowerCase();
    return {
      residentId: `RES-${String(num).padStart(4, '0')}`,
      plotId: `exp-${String(num).padStart(4, '0')}`,
      plotCode: `LDF-${String(num).padStart(4, '0')}`,
      username: entry.username,
      usernameKey: k,
      joinedAt: entry.joinedAt,
      joinedTimestamp: entry.joinedTimestamp,
      originalOrder: entry.originalOrder,
      oldestRank: oldestRankByKey.get(k) ?? num,
      tier: 'resident',
      ogRank: null,
    };
  });

  const allResidents = [...ogMembers, ...remainingResidents];
  return {
    sourceName,
    totalRawFollowers: rawList.length,
    uniqueFollowers: uniqueRaw.length,
    duplicatesRemoved,
    ogMembers,
    remainingResidents,
    allResidents,
    vipRecord: ogMembers[0]?.tier === 'vip-1' ? ogMembers[0] : null,
  };
}

export async function parseFollowersFromUploadedFile(file: File): Promise<ParsedFollowerDataset> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.zip')) {
    const buf = await file.arrayBuffer();
    const { htmlText } = await extractFollowersHtmlFromZipBuffer(buf);
    return parseInstagramFollowersHtml(htmlText, file.name);
  }
  const text = await file.text();
  return parseInstagramFollowersHtml(text, file.name);
}

export async function parseFollowersFromZipUrl(
  url: string = BUNDLED_ARCHIVE_PATH,
): Promise<ParsedFollowerDataset> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ZIP archive (${res.status} ${res.statusText}).`);
  }
  const buf = await res.arrayBuffer();
  const { htmlText } = await extractFollowersHtmlFromZipBuffer(buf);
  const name = url.split('/').pop() ?? 'instagram-followers.zip';
  return parseInstagramFollowersHtml(htmlText, name);
}

export function serializeDatasetToShards(
  dataset: ParsedFollowerDataset,
  shardSize = 200,
): CompactShardEntry[][] {
  const entries: CompactShardEntry[] = dataset.allResidents.map((r) => {
    const item: CompactShardEntry = {
      r: r.residentId,
      p: r.plotId,
      c: r.plotCode,
      u: r.username,
      j: r.joinedAt,
      ts: r.joinedTimestamp,
      o: r.originalOrder,
      k: r.oldestRank,
      t: r.tier,
    };
    if (r.ogRank !== null) item.g = r.ogRank;
    return item;
  });

  const shards: CompactShardEntry[][] = [];
  for (let i = 0; i < entries.length; i += shardSize) {
    shards.push(entries.slice(i, i + shardSize));
  }
  return shards;
}

export function hydrateDatasetFromCompactEntries(
  entries: CompactShardEntry[],
  meta: { sourceName: string; totalRawFollowers: number; duplicatesRemoved: number },
): ParsedFollowerDataset {
  const allResidents: FollowerRecord[] = entries.map((e) => ({
    residentId: e.r,
    plotId: e.p,
    plotCode: e.c,
    username: e.u,
    usernameKey: e.u.toLowerCase(),
    joinedAt: e.j,
    joinedTimestamp: e.ts,
    originalOrder: e.o,
    oldestRank: e.k,
    tier: e.t,
    ogRank: e.g ?? null,
  }));

  const ogMembers = allResidents.filter((r) => r.tier === 'vip-1' || r.tier === 'og-50');
  const remainingResidents = allResidents.filter((r) => r.tier === 'resident');
  const vipRecord = ogMembers.find((r) => r.tier === 'vip-1') ?? null;

  return {
    sourceName: meta.sourceName,
    totalRawFollowers: meta.totalRawFollowers,
    uniqueFollowers: allResidents.length,
    duplicatesRemoved: meta.duplicatesRemoved,
    ogMembers,
    remainingResidents,
    allResidents,
    vipRecord,
  };
}
