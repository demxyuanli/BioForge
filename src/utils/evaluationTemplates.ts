const STORAGE_KEY = 'evaluation_templates';
const HIDDEN_BUILTIN_KEY = 'evaluation_hidden_builtin_ids';

export const BUILTIN_TEMPLATE_IDS = ['proposal', 'technical', 'paper', 'multistep'] as const;

export type BuiltInTemplateId = (typeof BUILTIN_TEMPLATE_IDS)[number];

export interface EvaluationTemplate {
  id: string;
  name: string;
  body: string;
}

export function isBuiltInTemplateId(id: string): id is BuiltInTemplateId {
  return BUILTIN_TEMPLATE_IDS.includes(id as BuiltInTemplateId);
}

function nextId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function loadUserTemplates(): EvaluationTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EvaluationTemplate[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => !isBuiltInTemplateId(t.id));
  } catch {
    return [];
  }
}

export function saveUserTemplates(templates: EvaluationTemplate[]): void {
  const userOnly = templates.filter((t) => !isBuiltInTemplateId(t.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userOnly));
}

export function loadHiddenBuiltInIds(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_BUILTIN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && isBuiltInTemplateId(id)) : [];
  } catch {
    return [];
  }
}

export function saveHiddenBuiltInIds(ids: string[]): void {
  const valid = ids.filter((id) => isBuiltInTemplateId(id));
  localStorage.setItem(HIDDEN_BUILTIN_KEY, JSON.stringify(valid));
}

export function createTemplate(name: string, body: string): EvaluationTemplate {
  return { id: nextId(), name, body };
}

export function extractVariableNames(body: string): string[] {
  const re = /\{\{([^}]+)\}\}/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) set.add(m[1].trim());
  return Array.from(set);
}

export function resolveTemplateBody(body: string, values: Record<string, string>): string {
  if (!body) return '';
  return body.replace(/\{\{([^}]+)\}\}/g, (_, key) => values[key.trim()] ?? `{{${key.trim()}}}`);
}

/** Delimiter for multi-step templates: each step is one API call; previous responses are prepended as context to the next. */
export const STEP_DELIMITER = '\n---step---\n';

export function splitTemplateSteps(body: string): string[] {
  if (!body || !body.trim()) return [];
  const parts = body.split(STEP_DELIMITER).map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [body.trim()];
}

const TEMPLATES_BASE = '/evaluation-templates';

export function getTemplateLocale(language: string): 'en' | 'zh' {
  if (typeof language !== 'string') return 'en';
  const lang = language.toLowerCase();
  return lang.startsWith('zh') ? 'zh' : 'en';
}

export function getBuiltInTemplateMdPath(locale: 'en' | 'zh', id: string): string {
  return `${TEMPLATES_BASE}/${locale}/${id}.md`;
}

export async function fetchBuiltInTemplateBody(locale: 'en' | 'zh', id: string): Promise<string> {
  const path = getBuiltInTemplateMdPath(locale, id);
  try {
    const res = await fetch(path);
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}
