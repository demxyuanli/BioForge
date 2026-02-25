import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  estimateFinetuningCost,
  submitFinetuningJob,
  getFinetuningJobs,
  getTrainingSet,
  saveTrainingSet,
  getJobLogs,
  getJobStatus,
  type FinetuningJob,
  type Annotation,
} from '../services/api';
import { getAIConfig } from '../utils/aiConfig';
import {
  SAVED_DATA_PAGE_SIZE,
  AUTO_REFRESH_INTERVAL_MS,
  clamp,
} from '../utils/productionTuningUtils';

export type NoticeType = 'success' | 'error' | 'info';
export interface NoticeState {
  type: NoticeType;
  message: string;
}

export interface InstructionEditState {
  annotationId: number | null;
  annotationRef: Annotation;
  draft: string;
  response: string;
}

export interface UseProductionTuningDataReturn {
  jobs: FinetuningJob[];
  savedAnnotations: Annotation[];
  setSavedAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  savedDataSearch: string;
  setSavedDataSearch: React.Dispatch<React.SetStateAction<string>>;
  savedDataScoreFilter: string;
  setSavedDataScoreFilter: React.Dispatch<React.SetStateAction<string>>;
  savedDataTuneFilter: 'all' | 'untuned' | 'tuned';
  setSavedDataTuneFilter: React.Dispatch<React.SetStateAction<'all' | 'untuned' | 'tuned'>>;
  savedDataPage: number;
  setSavedDataPage: React.Dispatch<React.SetStateAction<number>>;
  datasetSize: number;
  setDatasetSize: React.Dispatch<React.SetStateAction<number>>;
  costEstimate: any;
  isSubmitting: boolean;
  expandedJobId: string | null;
  setExpandedJobId: React.Dispatch<React.SetStateAction<string | null>>;
  jobLogs: any[];
  jobStatusDetail: any;
  isLoadingJobs: boolean;
  isLoadingSavedData: boolean;
  isRefreshingJobDetail: boolean;
  autoRefreshJobs: boolean;
  setAutoRefreshJobs: React.Dispatch<React.SetStateAction<boolean>>;
  notice: NoticeState | null;
  setNotice: React.Dispatch<React.SetStateAction<NoticeState | null>>;
  lastDetailRefreshAt: Date | null;
  instructionEditState: InstructionEditState | null;
  setInstructionEditState: React.Dispatch<React.SetStateAction<InstructionEditState | null>>;
  useLocalModel: boolean;
  defaultPlatform: string;
  defaultCloudModel: string;
  totalSavedCount: number;
  untunedSavedCount: number;
  tunedSavedCount: number;
  submittableCount: number;
  effectiveDatasetSize: number;
  filteredSavedAnnotations: Annotation[];
  savedDataTotalPages: number;
  pagedSavedAnnotations: Annotation[];
  dataRangeStart: number;
  dataRangeEnd: number;
  canStartFinetuning: boolean;
  loadTrainingSet: (silent?: boolean) => Promise<void>;
  loadJobs: (silent?: boolean) => Promise<void>;
  fetchJobDetail: (jobId: string, silent?: boolean) => Promise<void>;
  openJobDetail: (jobId: string) => Promise<void>;
  handleExpandJob: (jobId: string) => Promise<void>;
  handleRefreshAll: () => Promise<void>;
  handleStartFinetuning: () => Promise<void>;
  handleJumpToJob: (jobId: string) => Promise<void>;
  handleJumpToFirstLinkedJob: (annotation: Annotation) => Promise<void>;
  openInstructionEditor: (annotation: Annotation) => void;
  closeInstructionEditor: () => void;
  handleSaveInstructionEdit: () => Promise<void>;
  handleUseAllData: () => void;
  datasetSectionRef: React.RefObject<HTMLElement | null>;
  jobsSectionRef: React.RefObject<HTMLElement | null>;
}

export function useProductionTuningData(activeSubItem?: string): UseProductionTuningDataReturn {
  const { t } = useTranslation();
  const aiConfig = getAIConfig();
  const { useLocalModel, defaultPlatform, defaultCloudModel } = aiConfig;

  const [jobs, setJobs] = useState<FinetuningJob[]>([]);
  const [savedAnnotations, setSavedAnnotations] = useState<Annotation[]>([]);
  const [savedDataSearch, setSavedDataSearch] = useState('');
  const [savedDataScoreFilter, setSavedDataScoreFilter] = useState<string>('all');
  const [savedDataTuneFilter, setSavedDataTuneFilter] = useState<'all' | 'untuned' | 'tuned'>('untuned');
  const [savedDataPage, setSavedDataPage] = useState(1);
  const [datasetSize, setDatasetSize] = useState(100);
  const [costEstimate, setCostEstimate] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobLogs, setJobLogs] = useState<any[]>([]);
  const [jobStatusDetail, setJobStatusDetail] = useState<any>(null);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [isLoadingSavedData, setIsLoadingSavedData] = useState(false);
  const [isRefreshingJobDetail, setIsRefreshingJobDetail] = useState(false);
  const [autoRefreshJobs, setAutoRefreshJobs] = useState(true);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [lastDetailRefreshAt, setLastDetailRefreshAt] = useState<Date | null>(null);
  const [instructionEditState, setInstructionEditState] = useState<InstructionEditState | null>(null);

  const expandedJobIdRef = useRef<string | null>(null);
  const datasetSectionRef = useRef<HTMLElement>(null);
  const jobsSectionRef = useRef<HTMLElement>(null);

  const totalSavedCount = savedAnnotations.length;
  const untunedSavedCount = useMemo(
    () => savedAnnotations.filter((ann) => !ann.finetuned).length,
    [savedAnnotations]
  );
  const tunedSavedCount = useMemo(
    () => savedAnnotations.filter((ann) => !!ann.finetuned).length,
    [savedAnnotations]
  );
  const submittableAnnotations = useMemo(
    () => savedAnnotations.filter((ann) => !ann.finetuned),
    [savedAnnotations]
  );
  const submittableCount = submittableAnnotations.length;
  const effectiveDatasetSize = useMemo(() => {
    if (submittableCount <= 0) return 1;
    return clamp(datasetSize, 1, submittableCount);
  }, [datasetSize, submittableCount]);

  useEffect(() => {
    expandedJobIdRef.current = expandedJobId;
  }, [expandedJobId]);

  const loadTrainingSet = useCallback(
    async (silent: boolean = true) => {
      if (!silent) setIsLoadingSavedData(true);
      try {
        const { annotations, count } = await getTrainingSet();
        const nextAnnotations = Array.isArray(annotations) ? annotations : [];
        const nextUntunedCount = nextAnnotations.filter((ann) => !ann.finetuned).length;
        const nextCount = Number(count ?? nextAnnotations.length) || nextAnnotations.length;
        setSavedAnnotations(nextAnnotations);
        setDatasetSize((prev) => {
          const previous = prev > 0 ? prev : 1;
          if (nextCount <= 0 || nextUntunedCount <= 0) return 1;
          if (previous > nextUntunedCount) return nextUntunedCount;
          if (previous <= 0) return nextUntunedCount;
          return previous;
        });
      } catch (error) {
        console.error('Failed to load training set:', error);
        setNotice({ type: 'error', message: t('productionTuning.failedToLoadSavedData') });
      } finally {
        if (!silent) setIsLoadingSavedData(false);
      }
    },
    [t]
  );

  const loadJobs = useCallback(
    async (silent: boolean = true) => {
      if (!silent) setIsLoadingJobs(true);
      try {
        const jobList = await getFinetuningJobs();
        setJobs(jobList);
      } catch (error) {
        console.error('Failed to load jobs:', error);
        setNotice({ type: 'error', message: t('productionTuning.failedToLoadJobs') });
      } finally {
        if (!silent) setIsLoadingJobs(false);
      }
    },
    [t]
  );

  const fetchJobDetail = useCallback(async (jobId: string, silent: boolean = false) => {
    if (!silent) setIsRefreshingJobDetail(true);
    try {
      const [logsResp, statusResp] = await Promise.all([
        getJobLogs(jobId, 100),
        getJobStatus(jobId),
      ]);
      if (expandedJobIdRef.current !== jobId) return;
      setJobLogs(Array.isArray(logsResp) ? logsResp : []);
      setJobStatusDetail(statusResp);
      setLastDetailRefreshAt(new Date());
    } catch (error) {
      console.error('Failed to load job details:', error);
      if (expandedJobIdRef.current === jobId) {
        setJobLogs([]);
        setJobStatusDetail(null);
      }
    } finally {
      if (!silent) setIsRefreshingJobDetail(false);
    }
  }, []);

  const openJobDetail = useCallback(
    async (jobId: string) => {
      if (!jobId) return;
      if (expandedJobId !== jobId) {
        expandedJobIdRef.current = jobId;
        setExpandedJobId(jobId);
        await fetchJobDetail(jobId);
        return;
      }
      if (!jobStatusDetail && jobLogs.length === 0) {
        await fetchJobDetail(jobId);
      }
    },
    [expandedJobId, fetchJobDetail, jobLogs.length, jobStatusDetail]
  );

  const handleExpandJob = useCallback(
    async (jobId: string) => {
      if (expandedJobId === jobId) {
        expandedJobIdRef.current = null;
        setExpandedJobId(null);
        setJobLogs([]);
        setJobStatusDetail(null);
        return;
      }
      await openJobDetail(jobId);
    },
    [expandedJobId, openJobDetail]
  );

  useEffect(() => {
    void Promise.all([loadJobs(false), loadTrainingSet(false)]);
  }, [loadJobs, loadTrainingSet]);

  useEffect(() => {
    if (
      useLocalModel ||
      !defaultPlatform ||
      !defaultCloudModel ||
      effectiveDatasetSize <= 0 ||
      submittableCount <= 0
    ) {
      setCostEstimate(null);
      return;
    }
    let disposed = false;
    (async () => {
      try {
        const estimate = await estimateFinetuningCost(
          effectiveDatasetSize,
          defaultCloudModel,
          defaultPlatform
        );
        if (!disposed) setCostEstimate(estimate);
      } catch (error) {
        if (!disposed) {
          console.error('Failed to estimate cost:', error);
          setCostEstimate(null);
        }
      }
    })();
    return () => {
      disposed = true;
    };
  }, [effectiveDatasetSize, useLocalModel, defaultPlatform, defaultCloudModel, submittableCount]);

  useEffect(() => {
    setSavedDataPage(1);
  }, [savedDataSearch, savedDataScoreFilter, savedDataTuneFilter, savedAnnotations.length]);

  const filteredSavedAnnotations = useMemo(() => {
    const keyword = savedDataSearch.trim().toLowerCase();
    return savedAnnotations.filter((ann) => {
      if (savedDataTuneFilter === 'tuned' && !ann.finetuned) return false;
      if (savedDataTuneFilter === 'untuned' && ann.finetuned) return false;
      if (savedDataScoreFilter !== 'all') {
        if (savedDataScoreFilter === 'unrated') {
          if ((ann.score ?? 0) > 0) return false;
        } else {
          const requiredScore = Number(savedDataScoreFilter);
          if ((ann.score ?? 0) !== requiredScore) return false;
        }
      }
      if (!keyword) return true;
      const instruction = (ann.instruction ?? '').toLowerCase();
      const response = (ann.response ?? '').toLowerCase();
      return instruction.includes(keyword) || response.includes(keyword);
    });
  }, [savedAnnotations, savedDataSearch, savedDataScoreFilter, savedDataTuneFilter]);

  const savedDataTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredSavedAnnotations.length / SAVED_DATA_PAGE_SIZE)),
    [filteredSavedAnnotations.length]
  );

  useEffect(() => {
    if (savedDataPage > savedDataTotalPages) {
      setSavedDataPage(savedDataTotalPages);
    }
  }, [savedDataPage, savedDataTotalPages]);

  const pagedSavedAnnotations = useMemo(() => {
    const start = (savedDataPage - 1) * SAVED_DATA_PAGE_SIZE;
    return filteredSavedAnnotations.slice(start, start + SAVED_DATA_PAGE_SIZE);
  }, [filteredSavedAnnotations, savedDataPage]);

  useEffect(() => {
    if (!autoRefreshJobs) return;
    const timer = window.setInterval(() => {
      void loadJobs(true);
      if (expandedJobIdRef.current) {
        void fetchJobDetail(expandedJobIdRef.current, true);
      }
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoRefreshJobs, fetchJobDetail, loadJobs]);

  useEffect(() => {
    if (!activeSubItem) return;
    if (activeSubItem === 'logs') {
      if (!expandedJobIdRef.current && jobs.length > 0) {
        void openJobDetail(jobs[0].id);
      }
      jobsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (activeSubItem === 'datasetAndCost') {
      datasetSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (activeSubItem === 'jobs') {
      jobsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeSubItem, jobs, openJobDetail]);

  const handleRefreshAll = useCallback(async () => {
    setNotice(null);
    await Promise.all([loadTrainingSet(false), loadJobs(false)]);
    if (expandedJobIdRef.current) {
      await fetchJobDetail(expandedJobIdRef.current, false);
    }
  }, [loadTrainingSet, loadJobs, fetchJobDetail]);

  const handleStartFinetuning = useCallback(async () => {
    if (useLocalModel) {
      setNotice({ type: 'info', message: t('productionTuning.useCloudForFinetuning') });
      return;
    }
    if (!defaultPlatform || !defaultCloudModel) {
      setNotice({ type: 'info', message: t('trainingLab.configureInSettings') });
      return;
    }
    if (savedAnnotations.length === 0) {
      setNotice({ type: 'info', message: t('productionTuning.noTrainingData') });
      return;
    }
    if (submittableCount === 0) {
      setNotice({ type: 'info', message: t('productionTuning.noUntunedData') });
      return;
    }
    const annotationsToSubmit = submittableAnnotations.slice(0, effectiveDatasetSize);
    setIsSubmitting(true);
    setNotice(null);
    try {
      const job = await submitFinetuningJob(
        annotationsToSubmit,
        defaultPlatform,
        defaultCloudModel,
        '',
        'sft'
      );
      await Promise.all([loadJobs(false), loadTrainingSet(false)]);
      const submittedJobId = job.id ?? (job as any).job_id ?? '-';
      setNotice({
        type: 'success',
        message: `${t('productionTuning.jobSubmitted')}: ${submittedJobId}`,
      });
      if (submittedJobId !== '-') {
        await openJobDetail(submittedJobId);
      }
    } catch (error) {
      console.error('Fine-tuning error:', error);
      setNotice({
        type: 'error',
        message: `${t('productionTuning.jobSubmitFailed')}: ${String(error)}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    useLocalModel,
    defaultPlatform,
    defaultCloudModel,
    savedAnnotations.length,
    submittableCount,
    submittableAnnotations,
    effectiveDatasetSize,
    loadJobs,
    loadTrainingSet,
    openJobDetail,
    t,
  ]);

  const handleJumpToJob = useCallback(
    async (jobId: string) => {
      if (!jobId) return;
      jobsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      await openJobDetail(jobId);
    },
    [openJobDetail]
  );

  const handleJumpToFirstLinkedJob = useCallback(
    async (annotation: Annotation) => {
      const firstJobId = annotation.linked_jobs?.[0]?.job_id;
      if (!firstJobId) return;
      await handleJumpToJob(firstJobId);
    },
    [handleJumpToJob]
  );

  const openInstructionEditor = useCallback((annotation: Annotation) => {
    setInstructionEditState({
      annotationId: typeof annotation.id === 'number' ? annotation.id : null,
      annotationRef: annotation,
      draft: annotation.instruction ?? '',
      response: annotation.response ?? '',
    });
  }, []);

  const closeInstructionEditor = useCallback(() => {
    setInstructionEditState(null);
  }, []);

  const handleSaveInstructionEdit = useCallback(async () => {
    if (!instructionEditState) return;
    const nextInstruction = instructionEditState.draft.trim();
    if (!nextInstruction) {
      setNotice({ type: 'info', message: t('trainingLab.instructionCannotBeEmpty') });
      return;
    }
    const nextResponse = (instructionEditState.response ?? '').trim();
    const next = savedAnnotations.map((item) => {
      const idMatched =
        instructionEditState.annotationId != null &&
        item.id === instructionEditState.annotationId;
      const refMatched =
        instructionEditState.annotationId == null &&
        item === instructionEditState.annotationRef;
      if (!idMatched && !refMatched) return item;
      return { ...item, instruction: nextInstruction, response: nextResponse };
    });
    setSavedAnnotations(next);
    setInstructionEditState(null);
    try {
      await saveTrainingSet(next);
      setNotice({ type: 'success', message: t('trainingLab.savedForFinetuning') });
    } catch (err) {
      console.error('Save training set error:', err);
      setNotice({ type: 'error', message: t('productionTuning.failedToLoadSavedData') });
    }
  }, [instructionEditState, savedAnnotations, t]);

  const handleUseAllData = useCallback(() => {
    if (submittableCount > 0) {
      setDatasetSize(submittableCount);
    }
  }, [submittableCount]);

  const canStartFinetuning =
    !isSubmitting &&
    !useLocalModel &&
    !!defaultPlatform &&
    !!defaultCloudModel &&
    submittableCount > 0;

  const dataRangeStart =
    filteredSavedAnnotations.length === 0
      ? 0
      : (savedDataPage - 1) * SAVED_DATA_PAGE_SIZE + 1;
  const dataRangeEnd = Math.min(
    savedDataPage * SAVED_DATA_PAGE_SIZE,
    filteredSavedAnnotations.length
  );

  return {
    jobs,
    savedAnnotations,
    setSavedAnnotations,
    savedDataSearch,
    setSavedDataSearch,
    savedDataScoreFilter,
    setSavedDataScoreFilter,
    savedDataTuneFilter,
    setSavedDataTuneFilter,
    savedDataPage,
    setSavedDataPage,
    datasetSize,
    setDatasetSize,
    costEstimate,
    isSubmitting,
    expandedJobId,
    setExpandedJobId,
    jobLogs,
    jobStatusDetail,
    isLoadingJobs,
    isLoadingSavedData,
    isRefreshingJobDetail,
    autoRefreshJobs,
    setAutoRefreshJobs,
    notice,
    setNotice,
    lastDetailRefreshAt,
    instructionEditState,
    setInstructionEditState,
    useLocalModel,
    defaultPlatform,
    defaultCloudModel,
    totalSavedCount,
    untunedSavedCount,
    tunedSavedCount,
    submittableCount,
    effectiveDatasetSize,
    filteredSavedAnnotations,
    savedDataTotalPages,
    pagedSavedAnnotations,
    dataRangeStart,
    dataRangeEnd,
    canStartFinetuning,
    loadTrainingSet,
    loadJobs,
    fetchJobDetail,
    openJobDetail,
    handleExpandJob,
    handleRefreshAll,
    handleStartFinetuning,
    handleJumpToJob,
    handleJumpToFirstLinkedJob,
    openInstructionEditor,
    closeInstructionEditor,
    handleSaveInstructionEdit,
    handleUseAllData,
    datasetSectionRef,
    jobsSectionRef,
  };
}
