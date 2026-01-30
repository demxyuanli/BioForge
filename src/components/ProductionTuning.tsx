import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  estimateFinetuningCost, 
  submitFinetuningJob, 
  getFinetuningJobs,
  FinetuningJob,
  Annotation
} from '../services/api';

const ProductionTuning: React.FC = () => {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<FinetuningJob[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState('qwen3');
  const [selectedModel, setSelectedModel] = useState('qwen-plus');
  const [apiKey, setApiKey] = useState('');
  const [datasetSize, setDatasetSize] = useState(100);
  const [costEstimate, setCostEstimate] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (datasetSize > 0) {
      estimateCost();
    }
  }, [datasetSize, selectedModel, selectedPlatform]);

  const loadJobs = async () => {
    try {
      const jobList = await getFinetuningJobs();
      setJobs(jobList);
    } catch (error) {
      console.error('Failed to load jobs:', error);
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

    setIsSubmitting(true);
    try {
      const mockAnnotations: Annotation[] = Array.from({ length: datasetSize }, (_, i) => ({
        instruction: `Instruction ${i + 1}`,
        response: `Response ${i + 1}`
      }));

      const job = await submitFinetuningJob(
        mockAnnotations,
        selectedPlatform,
        selectedModel,
        apiKey,
        'sft'
      );
      
      await loadJobs();
      alert(`Fine-tuning job submitted: ${job.id}`);
    } catch (error) {
      console.error('Fine-tuning error:', error);
      alert(`Failed to submit job: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const platforms = {
    qwen3: {
      name: 'Alibaba Cloud DashScope',
      models: ['qwen-plus', 'qwen-max']
    },
    deepseek: {
      name: 'Fireworks.ai / Together AI',
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
                <div>{t('dashboard.jobId')}: {job.id}</div>
                <div>{t('dashboard.platform')}: {job.platform}</div>
                <div>{t('dashboard.model')}: {job.model}</div>
                <div>{t('dashboard.status')}: {job.status}</div>
                <div>{t('dashboard.progress')}: {job.progress}%</div>
                {job.costUsd && <div>{t('dashboard.cost')}: ${job.costUsd.toFixed(2)}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductionTuning;
