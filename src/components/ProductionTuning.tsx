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

const ProductionTuning: React.FC = () => {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<FinetuningJob[]>([]);
  const [savedAnnotations, setSavedAnnotations] = useState<Annotation[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState('deepseek');
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [apiKey, setApiKey] = useState('');
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
  }, [datasetSize, selectedModel, selectedPlatform]);

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
    try {
      const estimate = await estimateFinetuningCost(
        datasetSize,
        selectedModel,
        selectedPlatform
      );
      setCostEstimate(estimate);
    } catch (error) {
      console.error('Failed to estimate cost:', error);
    }
  };

  const handleStartFinetuning = async () => {
    if (!apiKey) {
      alert(t('productionTuning.pleaseEnterApiKey'));
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
        selectedPlatform,
        selectedModel,
        apiKey,
        'sft'
      );
      await loadJobs();
      alert(`Fine-tuning job submitted: ${job.id ?? (job as any).job_id ?? '-'}`);
    } catch (error) {
      console.error('Fine-tuning error:', error);
      alert(`Failed to submit job: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const platforms = {
    deepseek: {
      name: 'DeepSeek (api.deepseek.com)',
      models: ['deepseek-chat', 'deepseek-r1']
    }
  };

  return (
    <div className="production-tuning">
      <h2>{t('productionTuning.title')}</h2>
      
      <div className="job-configuration">
        <h3>{t('productionTuning.configureJob')}</h3>
        <div className="form-group">
          <label>{t('productionTuning.platform')}:</label>
          <select value={selectedPlatform} onChange={(e) => setSelectedPlatform(e.target.value)}>
            {Object.entries(platforms).map(([key, platform]) => (
              <option key={key} value={key}>{platform.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{t('productionTuning.model')}:</label>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            {platforms[selectedPlatform as keyof typeof platforms].models.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{t('productionTuning.datasetSize')}:</label>
          <input
            type="number"
            min="1"
            value={datasetSize}
            onChange={(e) => setDatasetSize(parseInt(e.target.value) || 0)}
          />
          {savedAnnotations.length > 0 && (
            <span className="saved-count">({t('productionTuning.usingSaved')}: {savedAnnotations.length})</span>
          )}
        </div>
        <div className="form-group">
          <label>{t('productionTuning.apiKey')}:</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t('productionTuning.enterApiKey')}
          />
        </div>
        {costEstimate && (
          <div className="cost-estimate">
            <p><strong>{t('productionTuning.estimatedCost')}:</strong> ${costEstimate.estimated_cost_usd?.toFixed(2) || 'N/A'}</p>
          </div>
        )}
        <button onClick={handleStartFinetuning} disabled={isSubmitting || !apiKey}>
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
