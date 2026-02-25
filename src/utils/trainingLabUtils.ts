import type { KnowledgePoint } from '../services/api';

export const DEFAULT_PROMPT_TEMPLATE_FALLBACK =
  'Create one high-quality instruction-response pair from the following knowledge point.\nKnowledge Point:\n{{knowledge_point}}';

export const getKnowledgePointKey = (kp: KnowledgePoint): string => {
  if (kp.id != null) return `id:${kp.id}`;
  return `doc:${kp.document_id}:chunk:${kp.chunk_index}:${kp.content}`;
};

export const replaceToken = (
  source: string,
  token: string,
  value: string
): string => source.split(token).join(value);

export const buildPromptFromTemplate = (
  template: string,
  kp: KnowledgePoint,
  defaultTemplate: string
): string => {
  const cleanedTemplate =
    (template || '').trim() ||
    (defaultTemplate || '').trim() ||
    DEFAULT_PROMPT_TEMPLATE_FALLBACK;
  const keywordsText = (kp.keywords ?? []).join(', ');
  const hasKnowledgePointToken = cleanedTemplate.includes('{{knowledge_point}}');
  const hasDocumentNameToken = cleanedTemplate.includes('{{document_name}}');
  const hasWeightToken = cleanedTemplate.includes('{{weight}}');
  const hasKeywordsToken = cleanedTemplate.includes('{{keywords}}');

  const replaced = [
    ['{{knowledge_point}}', kp.content],
    ['{{document_name}}', kp.document_name ?? ''],
    ['{{weight}}', String(kp.weight ?? 1)],
    ['{{keywords}}', keywordsText],
  ].reduce(
    (acc, [token, value]) => replaceToken(acc, token as string, value as string),
    cleanedTemplate
  );

  const metadataLines: string[] = [];
  if (!hasDocumentNameToken && kp.document_name)
    metadataLines.push(`Document: ${kp.document_name}`);
  if (!hasWeightToken)
    metadataLines.push(`Weight: ${String(kp.weight ?? 1)}`);
  if (!hasKeywordsToken && keywordsText)
    metadataLines.push(`Keywords: ${keywordsText}`);

  let withContext = replaced;
  if (metadataLines.length > 0) {
    withContext = `${withContext}\n\nContext:\n${metadataLines.join('\n')}`;
  }

  if (!hasKnowledgePointToken) {
    return `${withContext}\n\nKnowledge Point:\n${kp.content}`;
  }
  return withContext;
};
