import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  estimateFinetuningCost,
  submitFinetuningJob,
  getFinetuningJobs,
  getTrainingSet,
  saveTrainingSet,
  getJobLogs,
  getJobStatus,
  FinetuningJob,
  Annotation
} from '../services/api';
import { getAIConfig } from '../utils/aiConfig';
import './ProductionTuning.css';

interface ProductionTuningProps {
  activeSubItem?: string;
}

const SAVED_DATA_PAGE_SIZE = 10;
const AUTO_REFRESH_INTERVAL_MS = 8000;

type NoticeType = 'success' | 'error' | 'info';

interface NoticeState {
  type: NoticeType;
  message: string;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const formatDateTime = (value?: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const formatTimeOnly = (value: Date | null): string => {
  if (!value) return '-';
  return value.toLocaleTimeString();
};

const statusClassName = (status: string): string => {
  return (status || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');
};

const compactIdentifier = (value?: string, head: number = 12, tail: number = 12): string => {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
};

const buildLinkedJobsTooltip = (annotation: Annotation): string => {
  const links = Array.isArray(annotation.linked_jobs) ? annotation.linked_jobs : [];
  if (links.length === 0) return '-';
  return links.map((link, index) => {
    const parts: string[] = [`${index + 1}. ${link.job_id || '-'}`];
    if (link.job_status) parts.push(`[${link.job_status}]`);
    if (link.used_at) parts.push(`@ ${link.used_at}`);
    return parts.join(' ');
  }).join('\n');
};

const ProductionTuning: React.FC<ProductionTuningProps> = ({ activeSubItem }) => {
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
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(0);
  const [isSplitResizing, setIsSplitResizing] = useState(false);
  const [instructionEditState, setInstructionEditState] = useState<{
    annotationId: number | null;
    annotationRef: Annotation;
    draft: string;
    response: string;
  } | null>(null);

  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const datasetSectionRef = useRef<HTMLElement | null>(null);
  const jobsSectionRef = useRef<HTMLElement | null>(null);
  const expandedJobIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    void Promise.all([loadJobs(false), loadTrainingSet(false)]);
  }, []);

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

  const loadTrainingSet = useCallback(async (silent: boolean = true) => {
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
      setNotice({
        type: 'error',
        message: t('productionTuning.failedToLoadSavedData')
      });
    } finally {
      if (!silent) setIsLoadingSavedData(false);
    }
  }, [t]);

  const loadJobs = useCallback(async (silent: boolean = true) => {
    if (!silent) setIsLoadingJobs(true);
    try {
      const jobList = await getFinetuningJobs();
      setJobs(jobList);
    } catch (error) {
      console.error('Failed to load jobs:', error);
      setNotice({
        type: 'error',
        message: t('productionTuning.failedToLoadJobs')
      });
    } finally {
      if (!silent) setIsLoadingJobs(false);
    }
  }, [t]);

  const fetchJobDetail = useCallback(async (jobId: string, silent: boolean = false) => {
    if (!silent) setIsRefreshingJobDetail(true);
    try {
      const [logsResp, statusResp] = await Promise.all([
        getJobLogs(jobId, 100),
        getJobStatus(jobId)
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

  const openJobDetail = useCallback(async (jobId: string) => {
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
  }, [expandedJobId, fetchJobDetail, jobLogs.length, jobStatusDetail]);

  const handleExpandJob = useCallback(async (jobId: string) => {
    if (expandedJobId === jobId) {
      expandedJobIdRef.current = null;
      setExpandedJobId(null);
      setJobLogs([]);
      setJobStatusDetail(null);
      return;
    }
    await openJobDetail(jobId);
  }, [expandedJobId, openJobDetail]);

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
    if (!isSplitResizing) return;
    const onMouseMove = (e: MouseEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const minLeft = 560;
      const minRight = 360;
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

  const handleRefreshAll = async () => {
    setNotice(null);
    await Promise.all([loadTrainingSet(false), loadJobs(false)]);
    if (expandedJobIdRef.current) {
      await fetchJobDetail(expandedJobIdRef.current, false);
    }
  };

  const handleStartFinetuning = async () => {
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
        message: `${t('productionTuning.jobSubmitted')}: ${submittedJobId}`
      });
      if (submittedJobId !== '-') {
        await openJobDetail(submittedJobId);
      }
    } catch (error) {
      console.error('Fine-tuning error:', error);
      setNotice({
        type: 'error',
        message: `${t('productionTuning.jobSubmitFailed')}: ${String(error)}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJumpToJob = useCallback(async (jobId: string) => {
    if (!jobId) return;
    jobsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await openJobDetail(jobId);
  }, [openJobDetail]);

  const handleJumpToFirstLinkedJob = useCallback(async (annotation: Annotation) => {
    const firstJobId = annotation.linked_jobs?.[0]?.job_id;
    if (!firstJobId) return;
    await handleJumpToJob(firstJobId);
  }, [handleJumpToJob]);

  const openInstructionEditor = useCallback((annotation: Annotation) => {
    setInstructionEditState({
      annotationId: typeof annotation.id === 'number' ? annotation.id : null,
      annotationRef: annotation,
      draft: annotation.instruction ?? '',
      response: annotation.response ?? ''
    });
  }, []);

  const closeInstructionEditor = useCallback(() => {
    setInstructionEditState(null);
  }, []);

  const handleSaveInstructionEdit = useCallback(async () => {
    if (!instructionEditState) return;
    const nextInstruction = instructionEditState.draft.trim();
    if (!nextInstruction) {
      setNotice({
        type: 'info',
        message: t('trainingLab.instructionCannotBeEmpty')
      });
      return;
    }
    const nextResponse = (instructionEditState.response ?? '').trim();
    const next = savedAnnotations.map((item) => {
      const idMatched = instructionEditState.annotationId != null && item.id === instructionEditState.annotationId;
      const refMatched = instructionEditState.annotationId == null && item === instructionEditState.annotationRef;
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

  const handleSplitResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsSplitResizing(true);
  };

  const handleUseAllData = () => {
    if (submittableCount > 0) {
      setDatasetSize(submittableCount);
    }
  };

  const canStartFinetuning = !isSubmitting && !useLocalModel && !!defaultPlatform && !!defaultCloudModel && submittableCount > 0;
  const splitTemplate = leftPaneWidth > 0
    ? `${leftPaneWidth}px 4px minmax(0, 1fr)`
    : 'minmax(620px, 64%) 4px minmax(360px, 1fr)';
  const dataRangeStart = filteredSavedAnnotations.length === 0 ? 0 : ((savedDataPage - 1) * SAVED_DATA_PAGE_SIZE + 1);
  const dataRangeEnd = Math.min(savedDataPage * SAVED_DATA_PAGE_SIZE, filteredSavedAnnotations.length);

  return (
    <div
      ref={splitContainerRef}
      className={`production-tuning production-tuning-split ${isSplitResizing ? 'split-resizing' : ''}`}
      style={{ gridTemplateColumns: splitTemplate }}
    >
      <div className="production-pane production-left-pane">
        <section ref={datasetSectionRef} className="jobs-list production-section">
          <div className="production-section-header">
            <div className="production-title-group">
              <h3>{t('productionTuning.title')}</h3>
              <div className="production-title-meta-grid">
                <span className="production-meta-item">
                  <span className="production-meta-label">{t('dashboard.platform')}</span>
                  <strong>{defaultPlatform || '-'}</strong>
                </span>
                <span className="production-meta-item">
                  <span className="production-meta-label">{t('dashboard.model')}</span>
                  <strong>{defaultCloudModel || '-'}</strong>
                </span>
                <span className="production-meta-item">
                  <span className="production-meta-label">{t('productionTuning.untunedCount')}</span>
                  <strong>{untunedSavedCount}</strong>
                </span>
                <span className="production-meta-item">
                  <span className="production-meta-label">{t('productionTuning.tunedCount')}</span>
                  <strong>{tunedSavedCount}</strong>
                </span>
              </div>
            </div>
            <div className="production-inline-actions">
              <button onClick={() => void loadTrainingSet(false)} disabled={isLoadingSavedData}>
                {isLoadingSavedData ? t('status.loading') : t('trainingLab.refreshKnowledgePoints')}
              </button>
              <button onClick={handleRefreshAll} disabled={isLoadingSavedData || isLoadingJobs}>
                {t('productionTuning.refreshAll')}
              </button>
            </div>
          </div>

          <div className="production-config-row">
            <label className="production-inline-field">
              <span>{t('productionTuning.datasetSize')}</span>
              <input
                type="number"
                min={1}
                max={Math.max(1, submittableCount)}
                value={effectiveDatasetSize}
                disabled={submittableCount <= 0}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  if (!Number.isFinite(parsed)) return;
                  const upper = submittableCount > 0 ? submittableCount : Number.MAX_SAFE_INTEGER;
                  setDatasetSize(clamp(Math.round(parsed), 1, upper));
                }}
              />
            </label>
            <button type="button" onClick={handleUseAllData} disabled={submittableCount <= 0}>
              {t('productionTuning.useAllData')}
            </button>
            <span className="saved-count">
              {t('productionTuning.pendingSubmit')}: {submittableCount}
            </span>
            {!useLocalModel && (
              <div className="cost-estimate">
                <strong>{t('productionTuning.estimatedCost')}:</strong>{' '}
                {costEstimate?.estimated_cost_usd != null
                  ? `$${Number(costEstimate.estimated_cost_usd).toFixed(2)}`
                  : '-'}
              </div>
            )}
            <button onClick={handleStartFinetuning} disabled={!canStartFinetuning}>
              {isSubmitting ? t('productionTuning.submitting') : t('productionTuning.startFineTuning')}
            </button>
          </div>

          {notice && <div className={`production-notice ${notice.type}`}>{notice.message}</div>}
        </section>

        <section className="jobs-list production-section production-saved-data-section">
          <div className="production-section-header">
            <h3>{t('productionTuning.savedDataPanel')}</h3>
            <span className="saved-count">
              {t('productionTuning.showingRange', {
                start: dataRangeStart,
                end: dataRangeEnd,
                total: filteredSavedAnnotations.length
              })}
            </span>
          </div>

          <div className="production-filter-row">
            <input
              type="text"
              value={savedDataSearch}
              onChange={(e) => setSavedDataSearch(e.target.value)}
              placeholder={t('productionTuning.searchPlaceholder')}
            />
            <label className="production-filter-field">
              <span>{t('productionTuning.tuneStateFilter')}</span>
              <select
                value={savedDataTuneFilter}
                onChange={(e) => setSavedDataTuneFilter(e.target.value as 'all' | 'untuned' | 'tuned')}
              >
                <option value="all">{t('productionTuning.allTuneStates')}</option>
                <option value="untuned">{t('productionTuning.stateUntuned')}</option>
                <option value="tuned">{t('productionTuning.stateTuned')}</option>
              </select>
            </label>
            <label className="production-filter-field">
              <span>{t('productionTuning.scoreFilter')}</span>
              <select value={savedDataScoreFilter} onChange={(e) => setSavedDataScoreFilter(e.target.value)}>
                <option value="all">{t('productionTuning.allScores')}</option>
                {[5, 4, 3, 2, 1].map((score) => (
                  <option key={score} value={String(score)}>{score}</option>
                ))}
                <option value="unrated">{t('productionTuning.unrated')}</option>
              </select>
            </label>
            <span className="saved-count">({filteredSavedAnnotations.length}/{totalSavedCount})</span>
          </div>

          {filteredSavedAnnotations.length === 0 ? (
            <p>{t('productionTuning.noSavedDataMatch')}</p>
          ) : (
            <>
              <div className="production-table-wrap">
                <table>
                  <colgroup>
                    <col className="production-col-index" />
                    <col className="production-col-instruction" />
                    <col className="production-col-response" />
                    <col className="production-col-score" />
                    <col className="production-col-state" />
                    <col className="production-col-jobs" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t('trainingLab.instruction')}</th>
                      <th>{t('trainingLab.response')}</th>
                      <th>{t('trainingLab.score')}</th>
                      <th>{t('productionTuning.tuneState')}</th>
                      <th>{t('productionTuning.relatedJobs')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSavedAnnotations.map((ann, idx) => (
                      <tr key={ann.id ?? `${savedDataPage}-${idx}`}>
                        <td>{(savedDataPage - 1) * SAVED_DATA_PAGE_SIZE + idx + 1}</td>
                        <td className="production-cell-text" title={ann.instruction ?? ''}>
                          <div
                            className="production-cell-edit-trigger"
                            role="button"
                            tabIndex={0}
                            title={t('trainingLab.clickToEditInstruction')}
                            onClick={() => openInstructionEditor(ann)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openInstructionEditor(ann);
                              }
                            }}
                          >
                            <div className="production-cell-text-content">{ann.instruction}</div>
                          </div>
                        </td>
                        <td className="production-cell-text" title={ann.response ?? ''}>
                          <div
                            className="production-cell-edit-trigger"
                            role="button"
                            tabIndex={0}
                            title={t('trainingLab.clickToEditInstruction')}
                            onClick={() => openInstructionEditor(ann)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openInstructionEditor(ann);
                              }
                            }}
                          >
                            <div className="production-cell-text-content">{ann.response}</div>
                          </div>
                        </td>
                        <td>{ann.score ?? '-'}</td>
                        <td className="production-state-cell">
                          <span
                            className={`production-data-state ${ann.finetuned ? 'tuned' : 'untuned'}`}
                            title={
                              ann.finetuned
                                ? `${t('productionTuning.stateTuned')} (${ann.finetuned_count ?? 0})`
                                : t('productionTuning.stateUntuned')
                            }
                          >
                            {ann.finetuned ? 'T' : 'U'}
                          </span>
                        </td>
                        <td className="production-jobs-cell">
                          {Array.isArray(ann.linked_jobs) && ann.linked_jobs.length > 0 ? (
                            <button
                              type="button"
                              className="production-job-link-btn production-job-link-btn-compact"
                              onClick={() => void handleJumpToFirstLinkedJob(ann)}
                              title={buildLinkedJobsTooltip(ann)}
                            >
                              {`J${ann.linked_jobs.length}`}
                            </button>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="actions production-pagination-actions">
                <button onClick={() => setSavedDataPage((p) => Math.max(1, p - 1))} disabled={savedDataPage <= 1}>
                  {t('productionTuning.prevPage')}
                </button>
                <span>{t('productionTuning.pageInfo', { page: savedDataPage, total: savedDataTotalPages })}</span>
                <button
                  onClick={() => setSavedDataPage((p) => Math.min(savedDataTotalPages, p + 1))}
                  disabled={savedDataPage >= savedDataTotalPages}
                >
                  {t('productionTuning.nextPage')}
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="production-divider" onMouseDown={handleSplitResizeStart} />

      <div className="production-pane production-right-pane">
        <section ref={jobsSectionRef} className="jobs-list production-section">
          <div className="production-section-header">
            <h3>{t('productionTuning.jobs')}</h3>
            <div className="production-inline-actions">
              <label className="production-checkbox">
                <input
                  type="checkbox"
                  checked={autoRefreshJobs}
                  onChange={(e) => setAutoRefreshJobs(e.target.checked)}
                />
                <span>{t('productionTuning.autoRefreshJobs')}</span>
              </label>
              <button onClick={() => void loadJobs(false)} disabled={isLoadingJobs}>
                {isLoadingJobs ? t('status.loading') : t('trainingLab.refreshKnowledgePoints')}
              </button>
            </div>
          </div>

          {jobs.length === 0 ? (
            <p>{t('productionTuning.noJobs')}</p>
          ) : (
            <div className="production-jobs">
              {jobs.map((job) => {
                const progress = clamp(Number(job.progress ?? 0), 0, 100);
                const statusCls = statusClassName(job.status);
                const expanded = expandedJobId === job.id;
                return (
                  <article key={job.id} className="job-item production-job-item">
                    <div className="production-job-head">
                      <strong className="production-job-id" title={job.id}>
                        {t('dashboard.jobId')}: {compactIdentifier(job.id, 12, 12)}
                      </strong>
                      <span className={`production-status-badge status-${statusCls}`}>{job.status}</span>
                    </div>
                    <div className="production-job-meta">
                      <span>{t('dashboard.platform')}: {job.platform || '-'}</span>
                      <span>{t('dashboard.model')}: {job.model || '-'}</span>
                      <span>{t('productionTuning.createdAt')}: {formatDateTime(job.createdAt)}</span>
                      {job.costUsd != null && <span>{t('dashboard.cost')}: ${job.costUsd.toFixed(2)}</span>}
                    </div>
                    <div className="production-progress-row">
                      <div className="production-progress-track" aria-label={t('dashboard.progress')}>
                        <div className={`production-progress-fill status-${statusCls}`} style={{ width: `${progress}%` }} />
                      </div>
                      <span className="production-progress-text">{progress}%</span>
                      <button onClick={() => void handleExpandJob(job.id)}>
                        {expanded
                          ? t('productionTuning.hideDetails')
                          : t('productionTuning.viewDetails')}
                      </button>
                    </div>

                    {expanded && (
                      <div className="job-detail production-job-detail">
                        <div className="production-inline-actions">
                          <button
                            onClick={() => void fetchJobDetail(job.id, false)}
                            disabled={isRefreshingJobDetail}
                          >
                            {isRefreshingJobDetail ? t('status.loading') : t('productionTuning.refreshDetails')}
                          </button>
                          <span>
                            {t('productionTuning.lastDetailSync')}: {formatTimeOnly(lastDetailRefreshAt)}
                          </span>
                        </div>

                        {jobStatusDetail && (
                          <div className="job-status-detail production-job-status-detail">
                            <div>{t('dashboard.status')}: {jobStatusDetail.status ?? '-'}</div>
                            {jobStatusDetail.estimated_time_remaining != null && (
                              <div>{t('productionTuning.estimatedTime')}: {String(jobStatusDetail.estimated_time_remaining)}</div>
                            )}
                            {jobStatusDetail.cost_tracking && (
                              <div className="production-job-cost">
                                <span className="production-job-cost-label">{t('dashboard.cost')}:</span>
                                <pre className="production-job-cost-json">{JSON.stringify(jobStatusDetail.cost_tracking, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="job-logs production-job-logs">
                          <strong>{t('productionTuning.logs')}</strong>
                          {jobLogs.length === 0 ? (
                            <p>{t('privacyCenter.noEntries')}</p>
                          ) : (
                            <pre>
                              {jobLogs.map((entry: any) => (
                                typeof entry === 'object' ? JSON.stringify(entry) : String(entry)
                              )).join('\n')}
                            </pre>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
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

export default ProductionTuning;
