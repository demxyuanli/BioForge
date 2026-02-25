import React from 'react';
import { useTranslation } from 'react-i18next';

export interface ProductionTuningDatasetSectionProps {
  defaultPlatform: string;
  defaultCloudModel: string;
  untunedSavedCount: number;
  tunedSavedCount: number;
  effectiveDatasetSize: number;
  submittableCount: number;
  setDatasetSize: React.Dispatch<React.SetStateAction<number>>;
  costEstimate: any;
  useLocalModel: boolean;
  isLoadingSavedData: boolean;
  isLoadingJobs: boolean;
  notice: { type: string; message: string } | null;
  canStartFinetuning: boolean;
  isSubmitting: boolean;
  onLoadTrainingSet: (silent: boolean) => void;
  onRefreshAll: () => void;
  onStartFinetuning: () => void;
  onUseAllData: () => void;
  sectionRef: React.RefObject<HTMLElement | null>;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const ProductionTuningDatasetSection: React.FC<
  ProductionTuningDatasetSectionProps
> = ({
  defaultPlatform,
  defaultCloudModel,
  untunedSavedCount,
  tunedSavedCount,
  effectiveDatasetSize,
  submittableCount,
  setDatasetSize,
  costEstimate,
  useLocalModel,
  isLoadingSavedData,
  isLoadingJobs,
  notice,
  canStartFinetuning,
  isSubmitting,
  onLoadTrainingSet,
  onRefreshAll,
  onStartFinetuning,
  onUseAllData,
  sectionRef,
}) => {
  const { t } = useTranslation();

  return (
    <section ref={sectionRef} className="jobs-list production-section">
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
              <span className="production-meta-label">
                {t('productionTuning.untunedCount')}
              </span>
              <strong>{untunedSavedCount}</strong>
            </span>
            <span className="production-meta-item">
              <span className="production-meta-label">
                {t('productionTuning.tunedCount')}
              </span>
              <strong>{tunedSavedCount}</strong>
            </span>
          </div>
        </div>
        <div className="production-inline-actions">
          <button
            onClick={() => onLoadTrainingSet(false)}
            disabled={isLoadingSavedData}
          >
            {isLoadingSavedData
              ? t('status.loading')
              : t('trainingLab.refreshKnowledgePoints')}
          </button>
          <button
            onClick={onRefreshAll}
            disabled={isLoadingSavedData || isLoadingJobs}
          >
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
              const upper =
                submittableCount > 0 ? submittableCount : Number.MAX_SAFE_INTEGER;
              setDatasetSize(clamp(Math.round(parsed), 1, upper));
            }}
          />
        </label>
        <button
          type="button"
          onClick={onUseAllData}
          disabled={submittableCount <= 0}
        >
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
        <button
          className="production-btn-primary"
          onClick={onStartFinetuning}
          disabled={!canStartFinetuning}
        >
          {isSubmitting
            ? t('productionTuning.submitting')
            : t('productionTuning.startFineTuning')}
        </button>
      </div>

      {notice && (
        <div className={`production-notice ${notice.type}`}>{notice.message}</div>
      )}
    </section>
  );
};
