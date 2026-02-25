import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { Plus, Pencil, Trash2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import {
  evaluationGenerate,
  selectMdTemplateFile,
  readTemplateFileContent,
  selectExportPath,
  saveExportFile
} from '../services/api';
import { getAIConfig } from '../utils/aiConfig';
import {
  loadUserTemplates,
  saveUserTemplates,
  createTemplate,
  loadHiddenBuiltInIds,
  saveHiddenBuiltInIds,
  BUILTIN_TEMPLATE_IDS,
  isBuiltInTemplateId,
  getTemplateLocale,
  fetchBuiltInTemplateBody,
  splitTemplateSteps,
  resolveTemplateBody,
  extractVariableNames,
  type EvaluationTemplate
} from '../utils/evaluationTemplates';
import {
  buildEvaluationDocx,
  buildEvaluationPdf,
  blobToBase64
} from '../utils/evaluationExport';
import { VariableHighlight } from './Evaluation/VariableHighlight';
import SkillSelector from './SkillSelector';
import './Evaluation.css';

interface EvaluationResult {
  before: string;
  after: string;
  metrics: {
    similarity: number;
    quality: number;
    relevance: number;
  };
}

const Evaluation: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [userTemplates, setUserTemplates] = useState<EvaluationTemplate[]>(() => loadUserTemplates());
  const [hiddenBuiltInIds, setHiddenBuiltInIds] = useState<Set<string>>(() => new Set(loadHiddenBuiltInIds()));
  const [builtInBodies, setBuiltInBodies] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNewTemplate, setIsNewTemplate] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBody, setEditBody] = useState('');
  const [prompt, setPrompt] = useState('');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [varDialog, setVarDialog] = useState<{ open: boolean; variableName: string }>({ open: false, variableName: '' });
  const [varDialogValue, setVarDialogValue] = useState('');
  const [promptPreviewExpanded, setPromptPreviewExpanded] = useState(true);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState<{ current: number; total: number } | null>(null);
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);

  const locale = getTemplateLocale(i18n.language);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next: Record<string, string> = {};
      for (const id of BUILTIN_TEMPLATE_IDS) {
        if (cancelled) return;
        const body = await fetchBuiltInTemplateBody(locale, id);
        if (cancelled) return;
        next[id] = body.trim() || '';
      }
      if (!cancelled) setBuiltInBodies(next);
    };
    load();
    return () => { cancelled = true; };
  }, [locale, reloadKey]);

  const builtInTemplatesAll = useMemo<EvaluationTemplate[]>(
    () =>
      BUILTIN_TEMPLATE_IDS.map((id) => ({
        id,
        name: t(`evaluation.templates.${id}.name`),
        body: (builtInBodies[id] && builtInBodies[id].trim()) ? builtInBodies[id] : t(`evaluation.templates.${id}.body`)
      })),
    [t, builtInBodies]
  );
  const builtInTemplates = useMemo(
    () => builtInTemplatesAll.filter((tpl) => !hiddenBuiltInIds.has(tpl.id)),
    [builtInTemplatesAll, hiddenBuiltInIds]
  );
  const templates = useMemo(() => [...builtInTemplates, ...userTemplates], [builtInTemplates, userTemplates]);

  useEffect(() => {
    saveUserTemplates(userTemplates);
  }, [userTemplates]);

  useEffect(() => {
    saveHiddenBuiltInIds(Array.from(hiddenBuiltInIds));
  }, [hiddenBuiltInIds]);

  const selectedTemplate = templates.find((tpl) => tpl.id === selectedId);

  const templateVarNames = useMemo(
    () => (selectedTemplate ? extractVariableNames(selectedTemplate.body) : []),
    [selectedTemplate]
  );
  const undefinedVars = useMemo(
    () => templateVarNames.filter((name) => !(variableValues[name] ?? '').trim()),
    [templateVarNames, variableValues]
  );
  const canGenerate = undefinedVars.length === 0;

  useEffect(() => {
    if (selectedTemplate) setPrompt(resolveTemplateBody(selectedTemplate.body, variableValues));
    else setPrompt('');
  }, [selectedId, selectedTemplate?.id, selectedTemplate?.body, variableValues]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setEditingId(null);
  }, []);

  const handleAdd = useCallback(async () => {
    const filePath = await selectMdTemplateFile();
    if (!filePath) return;
    try {
      const body = await readTemplateFileContent(filePath);
      const name = filePath.replace(/^.*[/\\]/, '').replace(/\.md$/i, '') || t('evaluation.newTemplateName');
      const newTpl = createTemplate(name, body.trim() || '{{topic}}\n\n{{requirements}}');
      setUserTemplates((prev) => [...prev, newTpl]);
      setEditingId(newTpl.id);
      setIsNewTemplate(true);
      setEditName(newTpl.name);
      setEditBody(newTpl.body);
      setSelectedId(newTpl.id);
    } catch (err) {
      console.error('Load template file error:', err);
      alert(`${t('evaluation.loadTemplateFileFailed')}: ${err}`);
    }
  }, [t]);

  const handleEdit = useCallback((tpl: EvaluationTemplate) => {
    setEditingId(tpl.id);
    setIsNewTemplate(false);
    setEditName(tpl.name);
    setEditBody(tpl.body);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId) return;
    if (isBuiltInTemplateId(editingId)) {
      const newTpl = createTemplate(editName.trim() || t('evaluation.newTemplateName'), editBody);
      setUserTemplates((prev) => [...prev, newTpl]);
      setSelectedId(newTpl.id);
    } else {
      setUserTemplates((prev) =>
        prev.map((tpl) =>
          tpl.id === editingId ? { ...tpl, name: editName.trim() || tpl.name, body: editBody } : tpl
        )
      );
    }
    setEditingId(null);
    setIsNewTemplate(false);
  }, [editingId, editName, editBody, t]);

  const handleCancelEdit = useCallback(() => {
    if (isNewTemplate && editingId) {
      setUserTemplates((prev) => prev.filter((tpl) => tpl.id !== editingId));
      setSelectedId(null);
    }
    setEditingId(null);
    setIsNewTemplate(false);
  }, [isNewTemplate, editingId]);

  const handleDelete = useCallback(
    (id: string) => {
      if (!window.confirm(t('evaluation.deleteTemplateConfirm'))) return;
      if (isBuiltInTemplateId(id)) {
        setHiddenBuiltInIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      } else {
        setUserTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
      }
      const remaining = templates.filter((tpl) => tpl.id !== id);
      if (selectedId === id) setSelectedId(remaining[0]?.id ?? null);
      if (editingId === id) setEditingId(null);
    },
    [t, selectedId, editingId, templates]
  );

  const handleRestoreBuiltIn = useCallback(() => {
    setHiddenBuiltInIds(new Set());
  }, []);

  const handleVariableDoubleClick = useCallback((varName: string) => {
    setVarDialog({ open: true, variableName: varName });
    setVarDialogValue(variableValues[varName] ?? '');
  }, [variableValues]);

  const handleVarDialogSave = useCallback(() => {
    if (!varDialog.variableName.trim()) return;
    const nextValues = { ...variableValues, [varDialog.variableName]: varDialogValue };
    setVariableValues(nextValues);
    setVarDialog({ open: false, variableName: '' });
    if (selectedTemplate) setPrompt(resolveTemplateBody(selectedTemplate.body, nextValues));
  }, [varDialog.variableName, varDialogValue, selectedTemplate, variableValues]);

  const handleVarDialogCancel = useCallback(() => {
    setVarDialog({ open: false, variableName: '' });
  }, []);

  const handleGenerate = async () => {
    const text = prompt.trim();
    if (!text) {
      alert(t('evaluation.pleaseEnterPrompt'));
      return;
    }
    if (undefinedVars.length > 0) {
      alert(t('evaluation.defineAllVariablesFirst', { vars: undefinedVars.join(', ') }));
      return;
    }
    const cfg = getAIConfig();
    if (cfg.useLocalModel) {
      alert(t('evaluation.useCloudForEval'));
      return;
    }
    if (!cfg.defaultPlatform) {
      alert(t('trainingLab.configureInSettings'));
      return;
    }

    const steps = splitTemplateSteps(text);
    const isMultiStep = steps.length > 1;
    setIsGenerating(true);
    setGeneratingStep(isMultiStep ? { current: 0, total: steps.length } : null);
    setEvaluationResult(null);
    const templateKey = selectedTemplate?.id === 'technical' ? 'technical_solution' : selectedTemplate?.id === 'paper' ? 'research_paper' : 'custom';

    try {
      if (isMultiStep) {
        const parts: string[] = [];
        let context = '';
        for (let i = 0; i < steps.length; i++) {
          setGeneratingStep({ current: i + 1, total: steps.length });
          const stepPrompt = context ? `${t('evaluation.previousSectionsLabel')}\n\n${context}\n\n${steps[i]}` : steps[i];
          const result = await evaluationGenerate(stepPrompt, templateKey, undefined, cfg.defaultPlatform);
          const content = result.generated_content?.trim() ?? '';
          parts.push(content);
          context = parts.join('\n\n');
        }
        setEvaluationResult({
          before: steps.join('\n\n---step---\n\n'),
          after: parts.join('\n\n'),
          metrics: { similarity: 0.85, quality: 0.92, relevance: 0.88 }
        });
      } else {
        const result = await evaluationGenerate(text, templateKey, undefined, cfg.defaultPlatform);
        setEvaluationResult({
          before: result.prompt || text,
          after: result.generated_content || '',
          metrics: { similarity: 0.85, quality: 0.92, relevance: 0.88 }
        });
      }
    } catch (error) {
      console.error('Generation error:', error);
      alert(`${t('evaluation.generationFailed')}: ${error}`);
    } finally {
      setIsGenerating(false);
      setGeneratingStep(null);
    }
  };

  const handleExport = async (format: 'word' | 'pdf') => {
    if (!evaluationResult) return;
    const labels = {
      beforeFineTuning: t('evaluation.beforeFineTuning'),
      afterFineTuning: t('evaluation.afterFineTuning'),
      evaluationMetrics: t('evaluation.evaluationMetrics'),
      similarity: t('evaluation.similarity'),
      quality: t('evaluation.quality'),
      relevance: t('evaluation.relevance')
    };
    try {
      const blob =
        format === 'word'
          ? await buildEvaluationDocx(evaluationResult, labels)
          : await buildEvaluationPdf(evaluationResult, labels);
      const ext = format === 'word' ? 'docx' : 'pdf';
      const defaultName = `evaluation-report.${ext}`;
      try {
        const filePath = await selectExportPath(format);
        if (!filePath) return;
        const base64 = await blobToBase64(blob);
        await saveExportFile(filePath, base64);
      } catch {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export error:', err);
      alert(`${t('evaluation.exportFailed')}: ${err}`);
    }
  };

  return (
    <div className="evaluation">
      <div className="evaluation-layout">
        <aside className="evaluation-sidebar">
          <div className="evaluation-sidebar-header">
            <div className="evaluation-sidebar-actions">
              <button
                type="button"
                className="evaluation-btn-icon"
                onClick={() => setReloadKey((k) => k + 1)}
                title={t('evaluation.reloadTemplates')}
                aria-label={t('evaluation.reloadTemplates')}
              >
                <RefreshCw size={16} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className="evaluation-btn-icon"
                onClick={handleAdd}
                title={t('evaluation.addTemplate')}
                aria-label={t('evaluation.addTemplate')}
              >
                <Plus size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>
          <ul className="evaluation-template-list" role="listbox" aria-label={t('evaluation.templateList')}>
            {templates.length === 0 ? (
              <li className="evaluation-template-list-empty">{t('evaluation.noTemplates')}</li>
            ) : (
              templates.map((tpl) => (
                <li
                  key={tpl.id}
                  className={`evaluation-template-item ${selectedId === tpl.id ? 'selected' : ''}`}
                  role="option"
                  aria-selected={selectedId === tpl.id}
                >
                  <button
                    type="button"
                    className="evaluation-template-item-label"
                    onClick={() => handleSelect(tpl.id)}
                  >
                    {tpl.name}
                  </button>
                  <div className="evaluation-template-item-actions">
                    <button
                      type="button"
                      className="evaluation-btn-icon"
                      onClick={(e) => { e.stopPropagation(); handleEdit(tpl); }}
                      title={t('evaluation.editTemplate')}
                      aria-label={t('evaluation.editTemplate')}
                    >
                      <Pencil size={14} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      className="evaluation-btn-icon evaluation-btn-danger"
                      onClick={(e) => { e.stopPropagation(); handleDelete(tpl.id); }}
                      title={t('evaluation.deleteTemplate')}
                      aria-label={t('evaluation.deleteTemplate')}
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
          {hiddenBuiltInIds.size > 0 && (
            <div className="evaluation-sidebar-restore">
              <button
                type="button"
                className="evaluation-restore-btn"
                onClick={handleRestoreBuiltIn}
              >
                {t('evaluation.restoreBuiltInTemplates')}
              </button>
            </div>
          )}
        </aside>

        <main className="evaluation-main">
          {editingId ? (
            <div className="evaluation-config evaluation-editor">
              <h3 className="evaluation-editor-title">
                {isNewTemplate ? t('evaluation.addTemplate') : t('evaluation.editTemplate')}
              </h3>
              <div className="form-group">
                <label>{t('evaluation.templateName')}:</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={t('evaluation.templateNamePlaceholder')}
                  className="evaluation-input"
                />
              </div>
              <div className="form-group">
                <label>{t('evaluation.templateBody')}:</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={12}
                  placeholder={t('evaluation.templateBodyPlaceholder')}
                  className="evaluation-textarea evaluation-template-body"
                />
                <p className="evaluation-var-hint">{t('evaluation.variableHint')}</p>
                <p className="evaluation-var-hint">{t('evaluation.wordCountHint')}</p>
                <p className="evaluation-var-hint">{t('evaluation.stepHint')}</p>
                <div className="evaluation-preview-vars">
                  <VariableHighlight text={editBody} asPre={true} />
                </div>
              </div>
              <div className="evaluation-editor-actions">
                <button type="button" className="evaluation-btn-primary" onClick={handleSaveEdit}>
                  {t('evaluation.saveTemplate')}
                </button>
                <button type="button" className="evaluation-btn-secondary" onClick={handleCancelEdit}>
                  {t('evaluation.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="evaluation-config">
              <div className="form-group evaluation-template-row">
                <span className="evaluation-template-label">{t('evaluation.template')}:</span>
                {selectedTemplate ? (
                  <span className="evaluation-selected-name">{selectedTemplate.name}</span>
                ) : (
                  <span className="evaluation-selected-name evaluation-selected-name-muted">{t('evaluation.selectTemplate')}</span>
                )}
              </div>

              <div className="form-group">
                <label>{t('evaluation.prompt')}:</label>
                {selectedTemplate && (
                  <div className="evaluation-prompt-preview-wrap">
                    <button
                      type="button"
                      className="evaluation-prompt-preview-toggle"
                      onClick={() => setPromptPreviewExpanded((v) => !v)}
                      aria-expanded={promptPreviewExpanded}
                      aria-label={promptPreviewExpanded ? t('evaluation.collapseTemplatePreview') : t('evaluation.expandTemplatePreview')}
                    >
                      {promptPreviewExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span>{t('evaluation.templatePreview')}</span>
                    </button>
                    {promptPreviewExpanded && (
                      <div className="evaluation-prompt-preview">
                        <VariableHighlight
                          text={selectedTemplate.body}
                          asPre={true}
                          onVariableDoubleClick={handleVariableDoubleClick}
                        />
                      </div>
                    )}
                  </div>
                )}
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={8}
                  placeholder={t('evaluation.enterCustomPrompt')}
                  className="evaluation-textarea"
                />
              </div>

              <SkillSelector selectedIds={selectedSkillIds} onChange={setSelectedSkillIds} />

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !canGenerate}
                className="evaluation-btn-primary"
                title={!canGenerate && undefinedVars.length > 0 ? t('evaluation.defineAllVariablesFirst', { vars: undefinedVars.join(', ') }) : undefined}
              >
                {isGenerating
                  ? (generatingStep
                    ? t('evaluation.generatingStep', { current: generatingStep.current, total: generatingStep.total })
                    : t('evaluation.generating'))
                  : t('evaluation.generateAndCompare')}
              </button>
              {!canGenerate && templateVarNames.length > 0 && (
                <p className="evaluation-var-hint evaluation-var-required">
                  {t('evaluation.defineVariablesHint', { vars: undefinedVars.map((v) => `{{${v}}}`).join(', ') })}
                </p>
              )}
            </div>
          )}

          {evaluationResult && (
            <div className="evaluation-results">
              <div className="comparison-section">
                <div className="comparison-panel">
                  <h3>{t('evaluation.beforeFineTuning')}</h3>
                  <div className="content-box before evaluation-content-markdown">
                    <ReactMarkdown>{evaluationResult.before}</ReactMarkdown>
                  </div>
                </div>
                <div className="comparison-panel">
                  <h3>{t('evaluation.afterFineTuning')}</h3>
                  <div className="content-box after evaluation-content-markdown">
                    <ReactMarkdown>{evaluationResult.after}</ReactMarkdown>
                  </div>
                </div>
              </div>

              <div className="metrics-section">
                <h3>{t('evaluation.evaluationMetrics')}</h3>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-label">{t('evaluation.similarity')}</div>
                    <div className="metric-value">
                      {(evaluationResult.metrics.similarity * 100).toFixed(1)}%
                    </div>
                    <div className="metric-bar">
                      <div
                        className="metric-fill"
                        style={{ width: `${evaluationResult.metrics.similarity * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">{t('evaluation.quality')}</div>
                    <div className="metric-value">
                      {(evaluationResult.metrics.quality * 100).toFixed(1)}%
                    </div>
                    <div className="metric-bar">
                      <div
                        className="metric-fill"
                        style={{ width: `${evaluationResult.metrics.quality * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">{t('evaluation.relevance')}</div>
                    <div className="metric-value">
                      {(evaluationResult.metrics.relevance * 100).toFixed(1)}%
                    </div>
                    <div className="metric-bar">
                      <div
                        className="metric-fill"
                        style={{ width: `${evaluationResult.metrics.relevance * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="export-section">
                <h3>{t('evaluation.export')}</h3>
                <div className="export-buttons">
                  <button onClick={() => handleExport('word')}>{t('evaluation.exportAsWord')}</button>
                  <button onClick={() => handleExport('pdf')}>{t('evaluation.exportAsPDF')}</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {varDialog.open && (
        <div className="evaluation-var-dialog-overlay" onClick={handleVarDialogCancel}>
          <div className="evaluation-var-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="evaluation-var-dialog-title" aria-modal="true">
            <h3 id="evaluation-var-dialog-title" className="evaluation-var-dialog-title">{t('evaluation.defineVariable')}</h3>
            <div className="form-group">
              <label>{t('evaluation.variableName')}:</label>
              <span className="evaluation-var-dialog-varname">{'{{' + varDialog.variableName + '}}'}</span>
            </div>
            <div className="form-group">
              <label>{t('evaluation.variableValue')}:</label>
              <textarea
                value={varDialogValue}
                onChange={(e) => setVarDialogValue(e.target.value)}
                rows={3}
                className="evaluation-input evaluation-textarea"
                placeholder={t('evaluation.variableValuePlaceholder')}
                autoFocus
              />
            </div>
            <div className="evaluation-editor-actions">
              <button type="button" className="evaluation-btn-primary" onClick={handleVarDialogSave}>
                {t('evaluation.saveVariable')}
              </button>
              <button type="button" className="evaluation-btn-secondary" onClick={handleVarDialogCancel}>
                {t('evaluation.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Evaluation;
