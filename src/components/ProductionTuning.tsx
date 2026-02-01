import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  estimateFinetuningCost, 
  submitFinetuningJob, 
  getFinetuningJobs,
  getTrainingSet,
  getJobLogs,
  getJobStatus,
  FinetuningJob,
  Annotation
} from '../services/api';
import { getAIConfig } from '../utils/aiConfig';

const ProductionTuning: React.FC = () => {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<FinetuningJob[]>([]);
  const [savedAnnotations, setSavedAnnotations] = useState<Annotation[]>([]);
  const [datasetSize, setDatasetSize] = useState(100);
  const [costEstimate, setCostEstimate] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobLogs, setJobLogs] = useState<any[]>([]);
  const [jobStatusDetail, setJobStatusDetail] = useState<any>(null);

  useEffect(() => {
    loadJobs();
    loadTrainingSet();
  }, []);

  useEffect(() => {
    if (datasetSize > 0) {
      estimateCost();
    }
  }, [datasetSize]);

  const loadTrainingSet = async () => {
    try {
      const { annotations, count } = await getTrainingSet();
      setSavedAnnotations(annotations);
      if (count > 0) setDatasetSize(count);
    } catch (error) {
      console.error('Failed to load training set:', error);
    }
  };

  const loadJobs = async () => {
    try {
      const jobList = await getFinetuningJobs();
      setJobs(jobList);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  };

  const handleExpandJob = async (jobId: string) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      setJobLogs([]);
      setJobStatusDetail(null);
      return;
    }
    setExpandedJobId(jobId);
    try {
      const [logsResp, statusResp] = await Promise.all([
        getJobLogs(jobId, 50),
        getJobStatus(jobId)
      ]);
      setJobLogs(Array.isArray(logsResp) ? logsResp : []);
      setJobStatusDetail(statusResp);
    } catch (error) {
      console.error('Failed to load job details:', error);
      setJobLogs([]);
      setJobStatusDetail(null);
    }
  };

  const estimateCost = async () => {
    const cfg = getAIConfig();
    if (cfg.useLocalModel) return;
    try {
      const estimate = await estimateFinetuningCost(
        datasetSize,
        cfg.defaultCloudModel,
        cfg.defaultPlatform
      );
      setCostEstimate(estimate);
    } catch (error) {
      console.error('Failed to estimate cost:', error);
    }
  };

  const handleStartFinetuning = async () => {
    const cfg = getAIConfig();
    if (cfg.useLocalModel) {
      alert(t('productionTuning.useCloudForFinetuning'));
      return;
    }
    if (!cfg.defaultPlatform) {
      alert(t('trainingLab.configureInSettings'));
      return;
    }

    const annotationsToSubmit = savedAnnotations.length > 0
      ? savedAnnotations
      : Array.from({ length: Math.min(datasetSize, 100) }, (_, i) => ({
          instruction: `Instruction ${i + 1}`,
          response: `Response ${i + 1}`
        } as Annotation));

    if (annotationsToSubmit.length === 0) {
      alert(t('productionTuning.noTrainingData'));
      return;
    }

    setIsSubmitting(true);
    try {
      const job = await submitFinetuningJob(
        annotationsToSubmit,
        cfg.defaultPlatform,
        cfg.defaultCloudModel,
        '',
        'sft'
      );
      await loadJobs();
      alert(`${t('productionTuning.jobSubmitted')}: ${job.id ?? (job as any).job_id ?? '-'}`);
    } catch (error) {
      console.error('Fine-tuning error:', error);
      alert(`${t('productionTuning.jobSubmitFailed')}: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="production-tuning">
      <div className="job-configuration">
        <div className="form-group" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--vs-muted)' }}>{getAIConfig().defaultPlatform} / {getAIConfig().defaultCloudModel}</span>
          <label>{t('productionTuning.datasetSize')}:</label>
          <input
            type="number"
            min="1"
            value={datasetSize}
            onChange={(e) => setDatasetSize(parseInt(e.target.value) || 0)}
          />
          {savedAnnotations.length > 0 && (
            <span className="saved-count">({savedAnnotations.length})</span>
          )}
        </div>
        {!getAIConfig().useLocalModel && costEstimate && (
          <div className="cost-estimate">
            <p><strong>{t('productionTuning.estimatedCost')}:</strong> ${costEstimate.estimated_cost_usd?.toFixed(2) || 'N/A'}</p>
          </div>
        )}
        <button onClick={handleStartFinetuning} disabled={isSubmitting}>
          {isSubmitting ? t('productionTuning.submitting') : t('productionTuning.startFineTuning')}
        </button>
      </div>

      <div className="jobs-list">
        <h3>{t('productionTuning.jobs')}</h3>
        {jobs.length === 0 ? (
          <p>{t('productionTuning.noJobs')}</p>
        ) : (
          <div className="jobs">
            {jobs.map((job) => (
              <div key={job.id} className="job-item">
                <div className="job-item-header" onClick={() => handleExpandJob(job.id)}>
                  <span>{t('dashboard.jobId')}: {job.id}</span>
                  <span>{job.status} / {job.progress}%</span>
                </div>
                <div>{t('dashboard.platform')}: {job.platform}</div>
                <div>{t('dashboard.model')}: {job.model}</div>
                {job.costUsd != null && <div>{t('dashboard.cost')}: ${job.costUsd.toFixed(2)}</div>}
                {expandedJobId === job.id && (
                  <div className="job-detail">
                    {jobStatusDetail && (
                      <div className="job-status-detail">
                        <div>{t('dashboard.status')}: {jobStatusDetail.status}</div>
                        {jobStatusDetail.estimated_time_remaining != null && (
                          <div>{t('productionTuning.estimatedTime')}: {jobStatusDetail.estimated_time_remaining}</div>
                        )}
                        {jobStatusDetail.cost_tracking && (
                          <div>{t('dashboard.cost')}: {JSON.stringify(jobStatusDetail.cost_tracking)}</div>
                        )}
                      </div>
                    )}
                    <div className="job-logs">
                      <strong>{t('productionTuning.logs')}:</strong>
                      {jobLogs.length === 0 ? <p>{t('privacyCenter.noEntries')}</p> : (
                        <pre>{jobLogs.map((e: any) => typeof e === 'object' ? JSON.stringify(e) : String(e)).join('\n')}</pre>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductionTuning;
