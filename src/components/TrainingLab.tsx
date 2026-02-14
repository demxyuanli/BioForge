import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  generateAnnotations,
  Annotation,
  getKnowledgePoints,
  saveTrainingSet,
  getTrainingSet,
  getLocalModels,
  getTrainingItems as getTrainingItemsApi,
  saveTrainingItem as saveTrainingItemApi,
  deleteTrainingItem as deleteTrainingItemApi,
  type KnowledgePoint,
  type TrainingItem
} from '../services/api';
import { Check, CircleHelp, Star, Trash2 } from 'lucide-react';
import Tooltip from './Tooltip';
import { getAIConfig } from '../utils/aiConfig';

const DEFAULT_PROMPT_TEMPLATE_FALLBACK =
  'Create one high-quality instruction-response pair from the following knowledge point.\nKnowledge Point:\n{{knowledge_point}}';

const getKnowledgePointKey = (kp: KnowledgePoint): string => {
  if (kp.id != null) return `id:${kp.id}`;
  return `doc:${kp.document_id}:chunk:${kp.chunk_index}:${kp.content}`;
};

const replaceToken = (source: string, token: string, value: string): string => source.split(token).join(value);

const buildPromptFromTemplate = (template: string, kp: KnowledgePoint, defaultTemplate: string): string => {
  const cleanedTemplate = (template || '').trim() || (defaultTemplate || '').trim() || DEFAULT_PROMPT_TEMPLATE_FALLBACK;
  const keywordsText = (kp.keywords ?? []).join(', ');
  const hasKnowledgePointToken = cleanedTemplate.includes('{{knowledge_point}}');
  const hasDocumentNameToken = cleanedTemplate.includes('{{document_name}}');
  const hasWeightToken = cleanedTemplate.includes('{{weight}}');
  const hasKeywordsToken = cleanedTemplate.includes('{{keywords}}');

  const replaced = [
    ['{{knowledge_point}}', kp.content],
    ['{{document_name}}', kp.document_name ?? ''],
    ['{{weight}}', String(kp.weight ?? 1)],
    ['{{keywords}}', keywordsText]
  ].reduce((acc, [token, value]) => replaceToken(acc, token, value), cleanedTemplate);

  const metadataLines: string[] = [];
  if (!hasDocumentNameToken && kp.document_name) metadataLines.push(`Document: ${kp.document_name}`);
  if (!hasWeightToken) metadataLines.push(`Weight: ${String(kp.weight ?? 1)}`);
  if (!hasKeywordsToken && keywordsText) metadataLines.push(`Keywords: ${keywordsText}`);

  let withContext = replaced;
  if (metadataLines.length > 0) {
    withContext = `${withContext}\n\nContext:\n${metadataLines.join('\n')}`;
  }

  if (!hasKnowledgePointToken) {
    return `${withContext}\n\nKnowledge Point:\n${kp.content}`;
  }
  return withContext;
};

const TrainingLab: React.FC = () => {
  const { t } = useTranslation();
  const defaultPromptTemplate = t('trainingLab.defaultPromptTemplate');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [availableLocalModels, setAvailableLocalModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [minWeightFilter, setMinWeightFilter] = useState<number>(0);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [contentFilter, setContentFilter] = useState('');
  const [selectedKnowledgePointKeys, setSelectedKnowledgePointKeys] = useState<Set<string>>(new Set());
  const [trainingName, setTrainingName] = useState('');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [candidateCount, setCandidateCount] = useState<number>(3);
  const [trainingItems, setTrainingItems] = useState<TrainingItem[]>([]);
  const [activeTrainingItemId, setActiveTrainingItemId] = useState<number | null>(null);
  const [isScoringDrag, setIsScoringDrag] = useState(false);
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(0);
  const [isSplitResizing, setIsSplitResizing] = useState(false);
  const [savingForFinetuning, setSavingForFinetuning] = useState(false);
  const [instructionEditState, setInstructionEditState] = useState<{
    index: number;
    draft: string;
    response: string;
  } | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadKnowledgePoints();
    loadTrainingItems();
  }, []);

  useEffect(() => {
    const cfg = getAIConfig();
    if (cfg.useLocalModel) {
      fetchLocalModels();
    }
  }, []);

  useEffect(() => {
    setPromptTemplate((prev) => (prev.trim() ? prev : defaultPromptTemplate));
  }, [defaultPromptTemplate]);

  useEffect(() => {
    const handleMouseUp = () => setIsScoringDrag(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  useEffect(() => {
    if (!isSplitResizing) return;
    const onMouseMove = (e: MouseEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const minLeft = 360;
      const minRight = 420;
      const next = e.clientX - rect.left;
      const clamped = Math.max(minLeft, Math.min(rect.width - minRight, next));
      setLeftPaneWidth(clamped);
    };
    const onMouseUp = () => setIsSplitResizing(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isSplitResizing]);

  const fetchLocalModels = async () => {
    const cfg = getAIConfig();
    setIsFetchingModels(true);
    try {
      const models = await getLocalModels(cfg.localBaseUrl);
      setAvailableLocalModels(models);
    } catch (error) {
      console.error('Failed to fetch local models:', error);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const loadTrainingItems = async () => {
    try {
      const items = await getTrainingItemsApi();
      setTrainingItems(items);
      setActiveTrainingItemId((prev) => {
        if (prev == null) return prev;
        return items.some((item) => item.id === prev) ? prev : null;
      });
    } catch (error) {
      console.error('Failed to load training items:', error);
    }
  };

  const loadKnowledgePoints = async () => {
    try {
      const pageSize = 500;
      let page = 1;
      let total = 0;
      const allPoints: KnowledgePoint[] = [];

      do {
        const resp = await getKnowledgePoints(page, pageSize);
        const points = resp.knowledge_points || [];
        allPoints.push(...points);
        total = resp.total || 0;
        if (points.length === 0) {
          break;
        }
        page += 1;
      } while (allPoints.length < total);

      setKnowledgePoints(allPoints);
      const latestKeys = new Set(allPoints.map(getKnowledgePointKey));
      setSelectedKnowledgePointKeys(prev => new Set([...prev].filter((key) => latestKeys.has(key))));
    } catch (error) {
      console.error('Failed to load knowledge points:', error);
    }
  };

  const keywordTokens = useMemo(
    () => keywordFilter.toLowerCase().split(/[\s,]+/).map(token => token.trim()).filter(Boolean),
    [keywordFilter]
  );

  const lowerContentFilter = contentFilter.trim().toLowerCase();

  const filteredKnowledgePoints = useMemo(() => {
    return knowledgePoints.filter((kp) => {
      const kpWeight = Number(kp.weight ?? 1);
      if (minWeightFilter > 0 && kpWeight < minWeightFilter) return false;

      if (lowerContentFilter) {
        const docName = (kp.document_name ?? '').toLowerCase();
        const content = (kp.content ?? '').toLowerCase();
        if (!docName.includes(lowerContentFilter) && !content.includes(lowerContentFilter)) {
          return false;
        }
      }

      if (keywordTokens.length > 0) {
        const keywordText = (kp.keywords ?? []).join(' ').toLowerCase();
        const contentText = (kp.content ?? '').toLowerCase();
        const allMatched = keywordTokens.every((token) => keywordText.includes(token) || contentText.includes(token));
        if (!allMatched) return false;
      }

      return true;
    });
  }, [knowledgePoints, minWeightFilter, lowerContentFilter, keywordTokens]);

  const knowledgePointMap = useMemo(() => {
    const map = new Map<string, KnowledgePoint>();
    knowledgePoints.forEach((kp) => map.set(getKnowledgePointKey(kp), kp));
    return map;
  }, [knowledgePoints]);

  const activeTrainingItem = useMemo(
    () => trainingItems.find((item) => item.id === activeTrainingItemId) || null,
    [trainingItems, activeTrainingItemId]
  );

  const getGenerationKnowledgePoints = () => {
    if (activeTrainingItem) {
      const points = activeTrainingItem.knowledge_point_keys
        .map((key) => knowledgePointMap.get(key))
        .filter(Boolean) as KnowledgePoint[];
      return {
        points,
        sourceLabel: t('trainingLab.sourceTrainingItem', { name: activeTrainingItem.name })
      };
    }
    if (selectedKnowledgePointKeys.size > 0) {
      const points = [...selectedKnowledgePointKeys]
        .map((key) => knowledgePointMap.get(key))
        .filter(Boolean) as KnowledgePoint[];
      return {
        points,
        sourceLabel: t('trainingLab.sourceSelection')
      };
    }
    return {
      points: filteredKnowledgePoints,
      sourceLabel: t('trainingLab.sourceFiltered')
    };
  };

  const handleGenerateAnnotations = async () => {
    const cfg = getAIConfig();
    if (!cfg.useLocalModel && !cfg.defaultPlatform) {
      alert(t('trainingLab.configureInSettings'));
      return;
    }
    const { points } = getGenerationKnowledgePoints();
    if (points.length === 0) {
      alert(t('trainingLab.noKnowledgePoints'));
      return;
    }

    setIsGenerating(true);
    try {
      const template = activeTrainingItem?.prompt_template || promptTemplate;
      const promptInputs = points.map((kp) => buildPromptFromTemplate(template, kp, defaultPromptTemplate));
      const generated = await generateAnnotations(
        promptInputs,
        cfg.useLocalModel ? 'ollama' : '',
        cfg.useLocalModel ? cfg.localModelName : cfg.defaultCloudModel,
        cfg.useLocalModel ? cfg.localBaseUrl : undefined,
        cfg.useLocalModel ? undefined : cfg.defaultPlatform,
        candidateCount
      );
      setAnnotations(generated);
    } catch (error) {
      console.error('Generation error:', error);
      alert(`${t('trainingLab.failedToGenerate')}: ${error}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveForFinetuning = async () => {
    if (annotations.length === 0) {
      alert(t('trainingLab.noAnnotations'));
      return;
    }
    if (!activeTrainingItemId) {
      alert(t('trainingLab.selectTrainingItemBeforeSave'));
      return;
    }
    setSavingForFinetuning(true);
    try {
      await saveTrainingSet(annotations, activeTrainingItemId);
      alert(t('trainingLab.savedForFinetuning'));
    } catch (error) {
      console.error('Save for finetuning error:', error);
      alert(`${t('trainingLab.failedToGenerate')}: ${error}`);
    } finally {
      setSavingForFinetuning(false);
    }
  };

  const toggleKnowledgePointSelection = (key: string) => {
    setSelectedKnowledgePointKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const allKeys = filteredKnowledgePoints.map(getKnowledgePointKey);
    setSelectedKnowledgePointKeys(new Set(allKeys));
    setActiveTrainingItemId(null);
  };

  const handleClearSelection = () => {
    setSelectedKnowledgePointKeys(new Set());
    setActiveTrainingItemId(null);
  };

  const handleSaveTrainingItem = async () => {
    const name = trainingName.trim();
    if (!name) {
      alert(t('trainingLab.trainingNameRequired'));
      return;
    }

    const sourceKeys = selectedKnowledgePointKeys.size > 0
      ? [...selectedKnowledgePointKeys]
      : filteredKnowledgePoints.map(getKnowledgePointKey);

    if (sourceKeys.length === 0) {
      alert(t('trainingLab.noSelectionToSave'));
      return;
    }

    try {
      const saved = await saveTrainingItemApi({
        name,
        knowledgePointKeys: sourceKeys,
        promptTemplate: promptTemplate.trim() || defaultPromptTemplate
      });
      setTrainingItems(prev => [saved, ...prev.filter((existing) => existing.id !== saved.id)]);
      setActiveTrainingItemId(saved.id);
      alert(t('trainingLab.trainingItemSaved'));
    } catch (error) {
      console.error('Save training item error:', error);
      alert(`${t('trainingLab.failedToGenerate')}: ${error}`);
    }
  };

  const handleActivateTrainingItem = (item: TrainingItem) => {
    setActiveTrainingItemId(item.id);
    setTrainingName(item.name);
    setPromptTemplate(item.prompt_template || defaultPromptTemplate);
    setSelectedKnowledgePointKeys(new Set(item.knowledge_point_keys));
    loadSavedAnnotationsByTrainingItem(item.id);
  };

  const handleDeleteTrainingItem = async (id: number) => {
    try {
      await deleteTrainingItemApi(id);
      setTrainingItems(prev => prev.filter((item) => item.id !== id));
      if (activeTrainingItemId === id) {
        setActiveTrainingItemId(null);
      }
    } catch (error) {
      console.error('Delete training item error:', error);
      alert(`${t('trainingLab.failedToGenerate')}: ${error}`);
    }
  };

  const loadSavedAnnotationsByTrainingItem = async (trainingItemId: number) => {
    try {
      const { annotations: saved } = await getTrainingSet(trainingItemId);
      setAnnotations(saved);
    } catch (error) {
      console.error('Load saved annotations by training item error:', error);
    }
  };

  const handleExportJSONL = () => {
    const jsonl = annotations
      .map(ann => JSON.stringify(ann))
      .join('\n');
    
    const blob = new Blob([jsonl], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annotations.jsonl';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleScoreChange = (index: number, score: number) => {
    const nextScore = Math.max(1, Math.min(5, score));
    const updated = [...annotations];
    updated[index] = { ...updated[index], score: nextScore };
    setAnnotations(updated);
  };

  const handleScoreMouseDown = (index: number, score: number) => {
    setIsScoringDrag(true);
    handleScoreChange(index, score);
  };

  const handleScoreMouseEnter = (index: number, score: number) => {
    if (!isScoringDrag) return;
    handleScoreChange(index, score);
  };

  const handleSplitResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsSplitResizing(true);
  };

  const openInstructionEditor = (index: number) => {
    const target = annotations[index];
    if (!target) return;
    setInstructionEditState({
      index,
      draft: target.instruction ?? '',
      response: target.response ?? ''
    });
  };

  const closeInstructionEditor = () => {
    setInstructionEditState(null);
  };

  const handleSaveInstructionEdit = () => {
    if (!instructionEditState) return;
    const nextInstruction = instructionEditState.draft.trim();
    if (!nextInstruction) {
      alert(t('trainingLab.instructionCannotBeEmpty'));
      return;
    }
    const nextResponse = (instructionEditState.response ?? '').trim();
    setAnnotations((prev) => prev.map((item, idx) => (
      idx === instructionEditState.index
        ? { ...item, instruction: nextInstruction, response: nextResponse }
        : item
    )));
    setInstructionEditState(null);
  };

  const generationSource = getGenerationKnowledgePoints();
  const generationPointCount = generationSource.points.length;
  const splitTemplate = leftPaneWidth > 0
    ? `${leftPaneWidth}px 4px minmax(0, 1fr)`
    : 'minmax(0, 1fr) 4px minmax(0, 1fr)';

  return (
    <div
      ref={splitContainerRef}
      className={`training-lab training-lab-split ${isSplitResizing ? 'split-resizing' : ''}`}
      style={{ gridTemplateColumns: splitTemplate }}
    >
      <div className="training-lab-pane training-lab-left-pane">
        <div className="config-section training-items-top-section">
          <div className="training-item-list">
            {trainingItems.length === 0 ? (
              <p>{t('trainingLab.noTrainingItems')}</p>
            ) : (
              trainingItems.map((item) => (
                <div
                  key={item.id}
                  className={`training-item-row ${activeTrainingItemId === item.id ? 'active' : ''}`}
                >
                  <div className="training-item-main">
                    <strong>{item.name}</strong>
                    <span className="training-item-meta">
                      {item.knowledge_point_keys.length} {t('trainingLab.items')}
                    </span>
                  </div>
                  <div className="training-item-actions">
                    <button
                      className={activeTrainingItemId === item.id ? 'is-active' : ''}
                      onClick={() => handleActivateTrainingItem(item)}
                      aria-label={activeTrainingItemId === item.id ? t('trainingLab.active') : t('trainingLab.activate')}
                      title={activeTrainingItemId === item.id ? t('trainingLab.active') : t('trainingLab.activate')}
                    >
                      <Check size={16} strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => handleDeleteTrainingItem(item.id)}
                      aria-label={t('trainingLab.remove')}
                      title={t('trainingLab.remove')}
                    >
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="config-section training-compose-section">
          <div className="training-filters-grid">
            <div className="form-group">
              <label>{t('trainingLab.minWeight')}</label>
              <select value={minWeightFilter} onChange={(e) => setMinWeightFilter(Number(e.target.value))}>
                <option value={0}>{t('trainingLab.anyWeight')}</option>
                {[1, 2, 3, 4, 5].map((weight) => (
                  <option key={weight} value={weight}>{weight}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('trainingLab.keywordFilter')}</label>
              <input
                type="text"
                value={keywordFilter}
                onChange={(e) => setKeywordFilter(e.target.value)}
                placeholder={t('trainingLab.keywordFilterPlaceholder')}
              />
            </div>
            <div className="form-group">
              <label>{t('trainingLab.contentFilter')}</label>
              <input
                type="text"
                value={contentFilter}
                onChange={(e) => setContentFilter(e.target.value)}
                placeholder={t('trainingLab.contentFilterPlaceholder')}
              />
            </div>
          </div>
          <div className="actions training-filter-actions">
            <button onClick={handleSelectAllFiltered}>
              {t('trainingLab.selectAllFiltered')}
            </button>
            <button onClick={handleClearSelection}>
              {t('trainingLab.clearSelection')}
            </button>
          </div>

          <div className="knowledge-points-list">
            {filteredKnowledgePoints.length === 0 ? (
              <p>{t('trainingLab.noKnowledgePointsAfterFilter')}</p>
            ) : (
              <div className="training-kp-list">
                {filteredKnowledgePoints.map((kp) => {
                  const key = getKnowledgePointKey(kp);
                  const checked = selectedKnowledgePointKeys.has(key);
                  return (
                    <div key={key} className={`training-kp-item ${checked ? 'selected' : ''}`}>
                      <label className="training-kp-header">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleKnowledgePointSelection(key)}
                        />
                        <span>
                          {kp.document_name} / #{kp.chunk_index} / {t('trainingLab.minWeight')}: {kp.weight ?? 1}
                        </span>
                      </label>
                      <div className="training-kp-content">{kp.content}</div>
                      {(kp.keywords ?? []).length > 0 && (
                        <div className="training-kp-keywords">
                          {t('trainingLab.keywords')}: {(kp.keywords ?? []).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="form-group training-name-inline">
            <label>{t('trainingLab.trainingName')}</label>
            <input
              type="text"
              value={trainingName}
              onChange={(e) => setTrainingName(e.target.value)}
              placeholder={t('trainingLab.trainingNamePlaceholder')}
            />
          </div>
          <div className="form-group">
            <label>{t('trainingLab.promptTemplate')}</label>
            <textarea
              className="training-prompt-template"
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              placeholder={t('trainingLab.promptTemplatePlaceholder')}
            />
          </div>
          <div className="actions">
            <button onClick={handleSaveTrainingItem}>
              {t('trainingLab.saveTrainingItem')}
            </button>
          </div>
        </div>
      </div>

      <div className="training-lab-divider" onMouseDown={handleSplitResizeStart} />

      <div className="training-lab-pane training-lab-right-pane">
        {getAIConfig().useLocalModel && (
          <div className="config-section">
            <div className="form-group">
              <label>{t('trainingLab.localModelName')}:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  list="local-models-list"
                  type="text"
                  value={getAIConfig().localModelName}
                  readOnly
                  style={{ flex: 1, backgroundColor: 'var(--vs-input-bg)', color: 'var(--vs-muted)' }}
                />
                <datalist id="local-models-list">
                  {availableLocalModels.map(m => <option key={m} value={m} />)}
                </datalist>
                <Tooltip title={t('trainingLab.refreshModels')}>
                  <button
                    onClick={fetchLocalModels}
                    style={{ padding: '0 8px', minWidth: '32px' }}
                    disabled={isFetchingModels}
                  >
                    {isFetchingModels ? '...' : '\u21bb'}
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        )}

        <div className="info-section training-summary-grid">
          <p>{t('trainingLab.availableKnowledgePoints')}: {knowledgePoints.length}</p>
          <p>{t('trainingLab.filteredKnowledgePoints')}: {filteredKnowledgePoints.length}</p>
          <p>{t('trainingLab.selectedKnowledgePoints')}: {selectedKnowledgePointKeys.size}</p>
          <p>{t('trainingLab.generationSource')}: {generationSource.sourceLabel}</p>
          <p>{t('trainingLab.knowledgePointSelection')}: {generationPointCount}</p>
        </div>

        <div className="actions">
          <button onClick={loadKnowledgePoints}>
            {t('trainingLab.refreshKnowledgePoints')}
          </button>
          <button onClick={handleGenerateAnnotations} disabled={isGenerating}>
            {isGenerating ? t('trainingLab.generating') : t('trainingLab.generateInstructionPairs')}
          </button>
          <button onClick={handleSaveForFinetuning} disabled={annotations.length === 0 || savingForFinetuning}>
            {savingForFinetuning ? t('trainingLab.saving') : t('trainingLab.saveForFinetuning')}
          </button>
          <button onClick={handleExportJSONL} disabled={annotations.length === 0}>
            {t('trainingLab.exportJSONL')} ({annotations.length} {t('trainingLab.items')})
          </button>
          <div className="training-actions-inline-field">
            <label className="training-label-with-tip">
              <span>{t('trainingLab.candidatesPerKnowledgePoint')}</span>
              <Tooltip title={t('trainingLab.candidatesPerKnowledgePointDesc')}>
                <span className="training-inline-tip-icon" aria-label={t('trainingLab.candidatesPerKnowledgePointDesc')}>
                  <CircleHelp size={14} strokeWidth={1.8} />
                </span>
              </Tooltip>
            </label>
            <input
              type="number"
              min={1}
              max={10}
              step={1}
              value={candidateCount}
              onChange={(e) => setCandidateCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            />
          </div>
        </div>

        <div className="annotations-list">
          <h3>{t('trainingLab.annotations')}</h3>
          {annotations.length === 0 ? (
            <p>{t('trainingLab.noAnnotations')}</p>
          ) : (
            <div className="annotation-items">
              {annotations.map((ann, index) => (
                <div key={index} className="annotation-item">
                  <div
                    className="instruction training-editable-pair"
                    role="button"
                    tabIndex={0}
                    title={t('trainingLab.clickToEditInstruction')}
                    onClick={() => openInstructionEditor(index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openInstructionEditor(index);
                      }
                    }}
                  >
                    <strong>{t('trainingLab.instruction')}:</strong> {ann.instruction}
                  </div>
                  <div
                    className="response training-editable-pair"
                    role="button"
                    tabIndex={0}
                    title={t('trainingLab.clickToEditInstruction')}
                    onClick={() => openInstructionEditor(index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openInstructionEditor(index);
                      }
                    }}
                  >
                    <strong>{t('trainingLab.response')}:</strong> {ann.response}
                  </div>
                  <div className="scoring">
                    <label>{t('trainingLab.score')}:</label>
                    <div className="training-star-rating" onMouseUp={() => setIsScoringDrag(false)}>
                      {[1, 2, 3, 4, 5].map((starValue) => {
                        const isActive = (ann.score ?? 0) >= starValue;
                        return (
                          <button
                            type="button"
                            key={starValue}
                            className={`training-star-button ${isActive ? 'active' : ''}`}
                            onMouseDown={() => handleScoreMouseDown(index, starValue)}
                            onMouseEnter={() => handleScoreMouseEnter(index, starValue)}
                            onClick={() => handleScoreChange(index, starValue)}
                            aria-label={`${t('trainingLab.score')} ${starValue}`}
                          >
                            <Star size={16} strokeWidth={1.8} fill={isActive ? 'currentColor' : 'none'} />
                          </button>
                        );
                      })}
                      <span className="training-star-value">{ann.score ?? 0}/5</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {instructionEditState && (
        <div className="annotation-edit-overlay" onClick={closeInstructionEditor}>
          <div
            className="annotation-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t('trainingLab.editInstructionTitle')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="annotation-edit-header">
              <strong>{t('trainingLab.editInstructionTitle')}</strong>
              <button type="button" onClick={closeInstructionEditor} title={t('trainingLab.closeEditDialog')}>
                ×
              </button>
            </div>
            <div className="annotation-edit-body">
              <label>{t('trainingLab.instruction')}</label>
              <textarea
                value={instructionEditState.draft}
                onChange={(e) => setInstructionEditState((prev) => (
                  prev ? { ...prev, draft: e.target.value } : prev
                ))}
                placeholder={t('trainingLab.instructionPlaceholder')}
              />
              <label>{t('trainingLab.response')}</label>
              <textarea
                value={instructionEditState.response ?? ''}
                onChange={(e) => setInstructionEditState((prev) => (
                  prev ? { ...prev, response: e.target.value } : prev
                ))}
                placeholder={t('trainingLab.responsePlaceholder')}
              />
            </div>
            <div className="annotation-edit-footer">
              <button type="button" onClick={closeInstructionEditor}>
                {t('trainingLab.cancelEdit')}
              </button>
              <button type="button" onClick={handleSaveInstructionEdit}>
                {t('trainingLab.saveInstruction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingLab;
