import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getKnowledgePoints,
  saveTrainingSet,
  getTrainingSet,
  getLocalModels,
  getTrainingItems as getTrainingItemsApi,
  saveTrainingItem as saveTrainingItemApi,
  deleteTrainingItem as deleteTrainingItemApi,
  submitAnnotationGenerationJob,
  getAnnotationGenerationJobs,
  getAnnotationGenerationJobStatus,
  type Annotation,
  type KnowledgePoint,
  type TrainingItem,
} from '../services/api';
import { getAIConfig } from '../utils/aiConfig';
import {
  getKnowledgePointKey,
  buildPromptFromTemplate,
} from '../utils/trainingLabUtils';

export interface InstructionEditState {
  index: number;
  draft: string;
  response: string;
}

export interface GenerationSource {
  points: KnowledgePoint[];
  sourceLabel: string;
}

export interface UseTrainingLabDataReturn {
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  isGenerating: boolean;
  availableLocalModels: string[];
  isFetchingModels: boolean;
  knowledgePoints: KnowledgePoint[];
  minWeightFilter: number;
  setMinWeightFilter: React.Dispatch<React.SetStateAction<number>>;
  keywordFilter: string;
  setKeywordFilter: React.Dispatch<React.SetStateAction<string>>;
  contentFilter: string;
  setContentFilter: React.Dispatch<React.SetStateAction<string>>;
  selectedKnowledgePointKeys: Set<string>;
  setSelectedKnowledgePointKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  trainingName: string;
  setTrainingName: React.Dispatch<React.SetStateAction<string>>;
  promptTemplate: string;
  setPromptTemplate: React.Dispatch<React.SetStateAction<string>>;
  candidateCount: number;
  setCandidateCount: React.Dispatch<React.SetStateAction<number>>;
  trainingItems: TrainingItem[];
  setTrainingItems: React.Dispatch<React.SetStateAction<TrainingItem[]>>;
  activeTrainingItemId: number | null;
  setActiveTrainingItemId: React.Dispatch<React.SetStateAction<number | null>>;
  isScoringDrag: boolean;
  setIsScoringDrag: React.Dispatch<React.SetStateAction<boolean>>;
  savingForFinetuning: boolean;
  instructionEditState: InstructionEditState | null;
  setInstructionEditState: React.Dispatch<React.SetStateAction<InstructionEditState | null>>;
  selectedSkillIds: number[];
  setSelectedSkillIds: React.Dispatch<React.SetStateAction<number[]>>;
  aiConfig: ReturnType<typeof getAIConfig>;
  defaultPromptTemplate: string;
  filteredKnowledgePoints: KnowledgePoint[];
  knowledgePointMap: Map<string, KnowledgePoint>;
  activeTrainingItem: TrainingItem | null;
  generationSource: GenerationSource;
  generationPointCount: number;
  generationJobId: string | null;
  generationProgress: number;
  loadKnowledgePoints: () => Promise<void>;
  loadTrainingItems: () => Promise<void>;
  fetchLocalModels: () => Promise<void>;
  handleGenerateAnnotations: () => Promise<void>;
  handleSaveForFinetuning: () => Promise<void>;
  toggleKnowledgePointSelection: (key: string) => void;
  handleSelectAllFiltered: () => void;
  handleClearSelection: () => void;
  handleSaveTrainingItem: () => Promise<void>;
  handleActivateTrainingItem: (item: TrainingItem) => void;
  handleDeleteTrainingItem: (id: number) => Promise<void>;
  loadSavedAnnotationsByTrainingItem: (trainingItemId: number) => Promise<void>;
  handleExportJSONL: () => void;
  handleScoreChange: (index: number, score: number) => void;
  handleScoreMouseDown: (index: number, score: number) => void;
  handleScoreMouseEnter: (index: number, score: number) => void;
  openInstructionEditor: (index: number) => void;
  closeInstructionEditor: () => void;
  handleSaveInstructionEdit: () => void;
}

export function useTrainingLabData(): UseTrainingLabDataReturn {
  const { t } = useTranslation();
  const defaultPromptTemplate = t('trainingLab.defaultPromptTemplate');
  const aiConfig = useMemo(() => getAIConfig(), []);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
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
  const [savingForFinetuning, setSavingForFinetuning] = useState(false);
  const [instructionEditState, setInstructionEditState] = useState<InstructionEditState | null>(null);
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);

  useEffect(() => {
    if (aiConfig.useLocalModel) {
      fetchLocalModels();
    }
  }, [aiConfig.useLocalModel]);

  useEffect(() => {
    setPromptTemplate((prev) => (prev.trim() ? prev : defaultPromptTemplate));
  }, [defaultPromptTemplate]);

  useEffect(() => {
    const handleMouseUp = () => setIsScoringDrag(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const fetchLocalModels = useCallback(async () => {
    setIsFetchingModels(true);
    try {
      const models = await getLocalModels(aiConfig.localBaseUrl);
      setAvailableLocalModels(models);
    } catch (error) {
      console.error('Failed to fetch local models:', error);
    } finally {
      setIsFetchingModels(false);
    }
  }, [aiConfig.localBaseUrl]);

  const loadTrainingItems = useCallback(async () => {
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
  }, []);

  const loadKnowledgePoints = useCallback(async () => {
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
        if (points.length === 0) break;
        page += 1;
      } while (allPoints.length < total);
      setKnowledgePoints(allPoints);
      const latestKeys = new Set(allPoints.map(getKnowledgePointKey));
      setSelectedKnowledgePointKeys((prev) => new Set([...prev].filter((key) => latestKeys.has(key))));
    } catch (error) {
      console.error('Failed to load knowledge points:', error);
    }
  }, []);

  useEffect(() => {
    loadKnowledgePoints();
    loadTrainingItems();
  }, [loadKnowledgePoints, loadTrainingItems]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const jobs = await getAnnotationGenerationJobs(20);
      const running = jobs.find((j) => j.status === 'running' || j.status === 'pending');
      if (!cancelled && running) {
        setGenerationJobId(running.job_id);
        setIsGenerating(true);
        setGenerationProgress(running.progress ?? 0);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!generationJobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await getAnnotationGenerationJobStatus(generationJobId!);
        if (cancelled) return;
        setGenerationProgress(status.progress ?? 0);
        if (status.status === 'completed' && Array.isArray(status.annotations)) {
          setAnnotations(status.annotations);
          setGenerationJobId(null);
          setIsGenerating(false);
          return;
        }
        if (status.status === 'failed') {
          alert(`${t('trainingLab.failedToGenerate')}: ${status.error_message || 'Unknown error'}`);
          setGenerationJobId(null);
          setIsGenerating(false);
          return;
        }
        setTimeout(() => {
          if (!cancelled) void poll();
        }, 2000);
      } catch (err) {
        if (!cancelled) {
          console.error('Poll generation job error:', err);
          setTimeout(() => void poll(), 2000);
        }
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [generationJobId, t]);

  const keywordTokens = useMemo(
    () =>
      keywordFilter
        .toLowerCase()
        .split(/[\s,]+/)
        .map((token) => token.trim())
        .filter(Boolean),
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
        const allMatched = keywordTokens.every(
          (token) => keywordText.includes(token) || contentText.includes(token)
        );
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

  const getGenerationKnowledgePoints = useCallback((): GenerationSource => {
    if (activeTrainingItem) {
      const points = activeTrainingItem.knowledge_point_keys
        .map((key) => knowledgePointMap.get(key))
        .filter(Boolean) as KnowledgePoint[];
      return {
        points,
        sourceLabel: t('trainingLab.sourceTrainingItem', { name: activeTrainingItem.name }),
      };
    }
    if (selectedKnowledgePointKeys.size > 0) {
      const points = [...selectedKnowledgePointKeys]
        .map((key) => knowledgePointMap.get(key))
        .filter(Boolean) as KnowledgePoint[];
      return { points, sourceLabel: t('trainingLab.sourceSelection') };
    }
    return {
      points: filteredKnowledgePoints,
      sourceLabel: t('trainingLab.sourceFiltered'),
    };
  }, [
    activeTrainingItem,
    selectedKnowledgePointKeys,
    knowledgePointMap,
    filteredKnowledgePoints,
    t,
  ]);

  const generationSource = getGenerationKnowledgePoints();
  const generationPointCount = generationSource.points.length;

  const handleGenerateAnnotations = useCallback(async () => {
    const cfg = aiConfig;
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
    setGenerationProgress(0);
    try {
      const template = activeTrainingItem?.prompt_template || promptTemplate;
      const promptInputs = points.map((kp) =>
        buildPromptFromTemplate(template, kp, defaultPromptTemplate)
      );
      const payload: Record<string, unknown> = {
        knowledge_points: promptInputs,
        api_key: cfg.useLocalModel ? 'ollama' : '',
        model: cfg.useLocalModel ? cfg.localModelName : cfg.defaultCloudModel,
        candidate_count: candidateCount,
      };
      if (cfg.useLocalModel && cfg.localBaseUrl) {
        payload.base_url = cfg.localBaseUrl;
      }
      if (!cfg.useLocalModel && cfg.defaultPlatform) {
        payload.platform = cfg.defaultPlatform;
      }
      if (selectedSkillIds.length > 0) {
        payload.skill_ids = selectedSkillIds;
      }
      const { job_id } = await submitAnnotationGenerationJob(payload);
      setGenerationJobId(job_id);
    } catch (error) {
      console.error('Generation error:', error);
      alert(`${t('trainingLab.failedToGenerate')}: ${error}`);
      setIsGenerating(false);
    }
  }, [
    aiConfig,
    getGenerationKnowledgePoints,
    activeTrainingItem,
    promptTemplate,
    defaultPromptTemplate,
    candidateCount,
    selectedSkillIds,
    t,
  ]);

  const handleSaveForFinetuning = useCallback(async () => {
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
  }, [annotations, activeTrainingItemId, t]);

  const toggleKnowledgePointSelection = useCallback((key: string) => {
    setSelectedKnowledgePointKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    const allKeys = filteredKnowledgePoints.map(getKnowledgePointKey);
    setSelectedKnowledgePointKeys(new Set(allKeys));
    setActiveTrainingItemId(null);
  }, [filteredKnowledgePoints]);

  const handleClearSelection = useCallback(() => {
    setSelectedKnowledgePointKeys(new Set());
    setActiveTrainingItemId(null);
  }, []);

  const loadSavedAnnotationsByTrainingItem = useCallback(async (trainingItemId: number) => {
    try {
      const { annotations: saved } = await getTrainingSet(trainingItemId);
      setAnnotations(Array.isArray(saved) ? saved : []);
    } catch (error) {
      console.error('Load saved annotations by training item error:', error);
    }
  }, []);

  const handleSaveTrainingItem = useCallback(async () => {
    const name = trainingName.trim();
    if (!name) {
      alert(t('trainingLab.trainingNameRequired'));
      return;
    }
    const sourceKeys =
      selectedKnowledgePointKeys.size > 0
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
        promptTemplate: promptTemplate.trim() || defaultPromptTemplate,
      });
      setTrainingItems((prev) => [saved, ...prev.filter((existing) => existing.id !== saved.id)]);
      setActiveTrainingItemId(saved.id);
      alert(t('trainingLab.trainingItemSaved'));
    } catch (error) {
      console.error('Save training item error:', error);
      alert(`${t('trainingLab.failedToGenerate')}: ${error}`);
    }
  }, [
    trainingName,
    selectedKnowledgePointKeys,
    filteredKnowledgePoints,
    promptTemplate,
    defaultPromptTemplate,
    t,
  ]);

  const handleActivateTrainingItem = useCallback(
    (item: TrainingItem) => {
      setActiveTrainingItemId(item.id);
      setTrainingName(item.name);
      setPromptTemplate(item.prompt_template || defaultPromptTemplate);
      setSelectedKnowledgePointKeys(new Set(item.knowledge_point_keys));
      loadSavedAnnotationsByTrainingItem(item.id);
    },
    [defaultPromptTemplate, loadSavedAnnotationsByTrainingItem]
  );

  const handleDeleteTrainingItem = useCallback(async (id: number) => {
    try {
      await deleteTrainingItemApi(id);
      setTrainingItems((prev) => prev.filter((item) => item.id !== id));
      if (activeTrainingItemId === id) {
        setActiveTrainingItemId(null);
      }
    } catch (error) {
      console.error('Delete training item error:', error);
      alert(`${t('trainingLab.failedToGenerate')}: ${error}`);
    }
  }, [activeTrainingItemId, t]);

  const handleExportJSONL = useCallback(() => {
    const jsonl = annotations.map((ann) => JSON.stringify(ann)).join('\n');
    const blob = new Blob([jsonl], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annotations.jsonl';
    a.click();
    URL.revokeObjectURL(url);
  }, [annotations]);

  const handleScoreChange = useCallback((index: number, score: number) => {
    const nextScore = Math.max(1, Math.min(5, score));
    setAnnotations((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], score: nextScore };
      return updated;
    });
  }, []);

  const handleScoreMouseDown = useCallback((index: number, score: number) => {
    setIsScoringDrag(true);
    handleScoreChange(index, score);
  }, [handleScoreChange]);

  const handleScoreMouseEnter = useCallback(
    (index: number, score: number) => {
      if (!isScoringDrag) return;
      handleScoreChange(index, score);
    },
    [isScoringDrag, handleScoreChange]
  );

  const openInstructionEditor = useCallback((index: number) => {
    const target = annotations[index];
    if (!target) return;
    setInstructionEditState({
      index,
      draft: target.instruction ?? '',
      response: target.response ?? '',
    });
  }, [annotations]);

  const closeInstructionEditor = useCallback(() => {
    setInstructionEditState(null);
  }, []);

  const handleSaveInstructionEdit = useCallback(() => {
    if (!instructionEditState) return;
    const nextInstruction = instructionEditState.draft.trim();
    if (!nextInstruction) {
      alert(t('trainingLab.instructionCannotBeEmpty'));
      return;
    }
    const nextResponse = (instructionEditState.response ?? '').trim();
    setAnnotations((prev) =>
      prev.map((item, idx) =>
        idx === instructionEditState.index
          ? { ...item, instruction: nextInstruction, response: nextResponse }
          : item
      )
    );
    setInstructionEditState(null);
  }, [instructionEditState, t]);

  return {
    annotations,
    setAnnotations,
    isGenerating,
    generationJobId,
    generationProgress,
    availableLocalModels,
    isFetchingModels,
    knowledgePoints,
    minWeightFilter,
    setMinWeightFilter,
    keywordFilter,
    setKeywordFilter,
    contentFilter,
    setContentFilter,
    selectedKnowledgePointKeys,
    setSelectedKnowledgePointKeys,
    trainingName,
    setTrainingName,
    promptTemplate,
    setPromptTemplate,
    candidateCount,
    setCandidateCount,
    trainingItems,
    setTrainingItems,
    activeTrainingItemId,
    setActiveTrainingItemId,
    isScoringDrag,
    setIsScoringDrag,
    savingForFinetuning,
    instructionEditState,
    setInstructionEditState,
    selectedSkillIds,
    setSelectedSkillIds,
    aiConfig,
    defaultPromptTemplate,
    filteredKnowledgePoints,
    knowledgePointMap,
    activeTrainingItem,
    generationSource,
    generationPointCount,
    loadKnowledgePoints,
    loadTrainingItems,
    fetchLocalModels,
    handleGenerateAnnotations,
    handleSaveForFinetuning,
    toggleKnowledgePointSelection,
    handleSelectAllFiltered,
    handleClearSelection,
    handleSaveTrainingItem,
    handleActivateTrainingItem,
    handleDeleteTrainingItem,
    loadSavedAnnotationsByTrainingItem,
    handleExportJSONL,
    handleScoreChange,
    handleScoreMouseDown,
    handleScoreMouseEnter,
    openInstructionEditor,
    closeInstructionEditor,
    handleSaveInstructionEdit,
  };
}
