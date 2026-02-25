import type { Annotation } from '../services/api';

export const SAVED_DATA_PAGE_SIZE = 10;
export const AUTO_REFRESH_INTERVAL_MS = 8000;

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const formatDateTime = (value?: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

export const formatTimeOnly = (value: Date | null): string => {
  if (!value) return '-';
  return value.toLocaleTimeString();
};

export const statusClassName = (status: string): string =>
  (status || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const compactIdentifier = (
  value?: string,
  head: number = 12,
  tail: number = 12
): string => {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
};

export const buildLinkedJobsTooltip = (annotation: Annotation): string => {
  const links = Array.isArray(annotation.linked_jobs) ? annotation.linked_jobs : [];
  if (links.length === 0) return '-';
  return links
    .map((link, index) => {
      const parts: string[] = [`${index + 1}. ${link.job_id || '-'}`];
      if (link.job_status) parts.push(`[${link.job_status}]`);
      if (link.used_at) parts.push(`@ ${link.used_at}`);
      return parts.join(' ');
    })
    .join('\n');
};
