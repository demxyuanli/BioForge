import React from 'react';
import type { DirectoryNode } from '../services/api';

const DEFAULT_KEYWORD_CLASS = 'dc-kp-keyword-highlight';

/**
 * Splits content by keywords and returns React nodes with keywords wrapped in <mark>.
 * @param keywordClassName - optional class for <mark> elements (default: dc-kp-keyword-highlight)
 */
export function highlightKeywords(
  content: string,
  keywords: string[],
  keywordClassName: string = DEFAULT_KEYWORD_CLASS
): React.ReactNode {
  if (!content || keywords.length === 0) return content;

  const parts: Array<{ text: string; isKeyword: boolean }> = [];
  const sortedKeywords = [...keywords]
    .filter((kw) => kw && kw.trim().length > 0)
    .sort((a, b) => b.length - a.length);

  if (sortedKeywords.length === 0) return content;

  const findNextKeyword = (startIndex: number): { keyword: string; index: number } | null => {
    let found: { keyword: string; index: number } | null = null;
    for (const kw of sortedKeywords) {
      const index = content.indexOf(kw, startIndex);
      if (index !== -1 && (!found || index < found.index)) {
        found = { keyword: kw, index };
      }
    }
    return found;
  };

  let currentIndex = 0;
  while (currentIndex < content.length) {
    const found = findNextKeyword(currentIndex);
    if (!found) {
      if (currentIndex < content.length) {
        parts.push({ text: content.substring(currentIndex), isKeyword: false });
      }
      break;
    }

    if (found.index > currentIndex) {
      parts.push({ text: content.substring(currentIndex, found.index), isKeyword: false });
    }

    parts.push({ text: found.keyword, isKeyword: true });
    currentIndex = found.index + found.keyword.length;
  }

  if (parts.length === 0) return content;

  return React.createElement(
    React.Fragment,
    null,
    ...parts.map((part, idx) =>
      part.isKeyword
        ? React.createElement('mark', { key: idx, className: keywordClassName }, part.text)
        : React.createElement('span', { key: idx }, part.text)
    )
  );
}

const DC_EXCLUDED_DIRS_KEY = 'dc_excluded_dirs';

export function loadExcludedDirs(): Set<number> {
  try {
    const raw = localStorage.getItem(DC_EXCLUDED_DIRS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(Array.isArray(arr) ? arr.filter((n) => typeof n === 'number') : []);
  } catch {
    return new Set();
  }
}

export function saveExcludedDirs(ids: Set<number>): void {
  try {
    localStorage.setItem(DC_EXCLUDED_DIRS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function flattenFileNodes(nodes: DirectoryNode[]): DirectoryNode[] {
  const out: DirectoryNode[] = [];
  for (const n of nodes) {
    if (n.type === 'file') out.push(n);
    if (n.children) out.push(...flattenFileNodes(n.children));
  }
  return out;
}
