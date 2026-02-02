export const FILE_META_KEY = 'app_file_meta';
const LEGACY_KB_KEY = 'kb_file_meta';
const LEGACY_DC_KEY = 'dc_file_meta';

export interface FileMetaItem {
  weight: number;
  note: string;
  tags: string[];
  excluded?: boolean;
}

function parseMetaFromRaw(raw: string): Record<number, FileMetaItem> {
  const parsed = JSON.parse(raw) as Record<string, { weight?: number; note?: string; tags?: string[]; excluded?: boolean }>;
  const out: Record<number, FileMetaItem> = {};
  for (const [k, v] of Object.entries(parsed)) {
    const id = Number(k);
    if (Number.isNaN(id) || !v) continue;
    out[id] = {
      weight: typeof v.weight === 'number' ? Math.min(5, Math.max(0, v.weight)) : 0,
      note: typeof v.note === 'string' ? v.note : '',
      tags: Array.isArray(v.tags) ? v.tags.filter((t) => typeof t === 'string') : [],
      excluded: v.excluded === true
    };
  }
  return out;
}

export function loadFileMeta(): Record<number, FileMetaItem> {
  try {
    let raw = localStorage.getItem(FILE_META_KEY);
    if (!raw) {
      const kbRaw = localStorage.getItem(LEGACY_KB_KEY);
      const dcRaw = localStorage.getItem(LEGACY_DC_KEY);
      const merged: Record<number, FileMetaItem> = {};
      if (kbRaw) {
        const kb = parseMetaFromRaw(kbRaw);
        Object.assign(merged, kb);
      }
      if (dcRaw) {
        const dc = parseMetaFromRaw(dcRaw);
        for (const [k, v] of Object.entries(dc)) {
          const id = Number(k);
          if (Number.isNaN(id)) continue;
          merged[id] = { ...merged[id], ...v };
        }
      }
      if (Object.keys(merged).length > 0) {
        localStorage.setItem(FILE_META_KEY, JSON.stringify(merged));
        return merged;
      }
      return {};
    }
    return parseMetaFromRaw(raw);
  } catch {
    return {};
  }
}

export function saveFileMeta(meta: Record<number, FileMetaItem>): void {
  try {
    const existing = loadFileMeta();
    const merged: Record<number, FileMetaItem> = { ...existing };
    for (const [k, v] of Object.entries(meta)) {
      const id = Number(k);
      if (Number.isNaN(id)) continue;
      merged[id] = { ...merged[id], ...v };
    }
    localStorage.setItem(FILE_META_KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
}
