import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FinetuningJob } from '../../services/api';
import {
  formatDateTime,
  formatTimeOnly,
  statusClassName,
  compactIdentifier,
} from '../../utils/productionTuningUtils';

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export interface ProductionTuningJobsSectionProps {
  jobs: FinetuningJob[];
  expandedJobId: string | null;
  jobLogs: any[];
  jobStatusDetail: any;
  isRefreshingJobDetail: boolean;
  lastDetailRefreshAt: Date | null;
  autoRefreshJobs: boolean;
  setAutoRefreshJobs: React.Dispatch<React.SetStateAction<boolean>>;
  isLoadingJobs: boolean;
  sectionRef: React.RefObject<HTMLElement | null>;
  onLoadJobs: (silent: boolean) => void;
  onExpandJob: (jobId: string) => void;
  onFetchJobDetail: (jobId: string, silent: boolean) => void;
}

export const ProductionTuningJobsSection: React.FC<
  ProductionTuningJobsSectionProps
> = ({
  jobs,
  expandedJobId,
  jobLogs,
  jobStatusDetail,
  isRefreshingJobDetail,
  lastDetailRefreshAt,
  autoRefreshJobs,
  setAutoRefreshJobs,
  isLoadingJobs,
  sectionRef,
  onLoadJobs,
  onExpandJob,
  onFetchJobDetail,
}) => {
  const { t } = useTranslation();

  return (
    <section ref={sectionRef} className="jobs-list production-section">
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
          <button
            onClick={() => void onLoadJobs(false)}
            disabled={isLoadingJobs}
          >
            {isLoadingJobs
              ? t('status.loading')
              : t('trainingLab.refreshKnowledgePoints')}
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
                  <span className={`production-status-badge status-${statusCls}`}>
                    {job.status}
                  </span>
                </div>
                <div className="production-job-meta">
                  <span>
                    {t('dashboard.platform')}: {job.platform || '-'}
                  </span>
                  <span>
                    {t('dashboard.model')}: {job.model || '-'}
                  </span>
                  <span>
                    {t('productionTuning.createdAt')}:{' '}
                    {formatDateTime(job.createdAt)}
                  </span>
                  {job.costUsd != null && (
                    <span>
                      {t('dashboard.cost')}: ${job.costUsd.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="production-progress-row">
                  <div
                    className="production-progress-track"
                    aria-label={t('dashboard.progress')}
                  >
                    <div
                      className={`production-progress-fill status-${statusCls}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="production-progress-text">{progress}%</span>
                  <button onClick={() => void onExpandJob(job.id)}>
                    {expanded
                      ? t('productionTuning.hideDetails')
                      : t('productionTuning.viewDetails')}
                  </button>
                </div>

                {expanded && (
                  <div className="job-detail production-job-detail">
                    <div className="production-inline-actions">
                      <button
                        onClick={() => void onFetchJobDetail(job.id, false)}
                        disabled={isRefreshingJobDetail}
                      >
                        {isRefreshingJobDetail
                          ? t('status.loading')
                          : t('productionTuning.refreshDetails')}
                      </button>
                      <span>
                        {t('productionTuning.lastDetailSync')}:{' '}
                        {formatTimeOnly(lastDetailRefreshAt)}
                      </span>
                    </div>

                    {jobStatusDetail && (
                      <div className="job-status-detail production-job-status-detail">
                        <div>
                          {t('dashboard.status')}:{' '}
                          {jobStatusDetail.status ?? '-'}
                        </div>
                        {jobStatusDetail.estimated_time_remaining != null && (
                          <div>
                            {t('productionTuning.estimatedTime')}:{' '}
                            {String(jobStatusDetail.estimated_time_remaining)}
                          </div>
                        )}
                        {jobStatusDetail.cost_tracking && (
                          <div className="production-job-cost">
                            <span className="production-job-cost-label">
                              {t('dashboard.cost')}:
                            </span>
                            <pre className="production-job-cost-json">
                              {JSON.stringify(
                                jobStatusDetail.cost_tracking,
                                null,
                                2
                              )}
                            </pre>
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
                          {jobLogs
                            .map((entry: any) =>
                              typeof entry === 'object'
                                ? JSON.stringify(entry)
                                : String(entry)
                            )
                            .join('\n')}
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
  );
};
