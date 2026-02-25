import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Annotation } from '../../services/api';
import { buildLinkedJobsTooltip } from '../../utils/productionTuningUtils';

export interface ProductionTuningSavedDataSectionProps {
  savedDataSearch: string;
  setSavedDataSearch: React.Dispatch<React.SetStateAction<string>>;
  savedDataTuneFilter: 'all' | 'untuned' | 'tuned';
  setSavedDataTuneFilter: React.Dispatch<
    React.SetStateAction<'all' | 'untuned' | 'tuned'>
  >;
  savedDataScoreFilter: string;
  setSavedDataScoreFilter: React.Dispatch<React.SetStateAction<string>>;
  filteredSavedAnnotations: Annotation[];
  totalSavedCount: number;
  pagedSavedAnnotations: Annotation[];
  savedDataPage: number;
  setSavedDataPage: React.Dispatch<React.SetStateAction<number>>;
  savedDataTotalPages: number;
  dataRangeStart: number;
  dataRangeEnd: number;
  onOpenInstructionEditor: (annotation: Annotation) => void;
  onJumpToFirstLinkedJob: (annotation: Annotation) => void;
}

const SAVED_DATA_PAGE_SIZE = 10;

export const ProductionTuningSavedDataSection: React.FC<
  ProductionTuningSavedDataSectionProps
> = ({
  savedDataSearch,
  setSavedDataSearch,
  savedDataTuneFilter,
  setSavedDataTuneFilter,
  savedDataScoreFilter,
  setSavedDataScoreFilter,
  filteredSavedAnnotations,
  totalSavedCount,
  pagedSavedAnnotations,
  savedDataPage,
  setSavedDataPage,
  savedDataTotalPages,
  dataRangeStart,
  dataRangeEnd,
  onOpenInstructionEditor,
  onJumpToFirstLinkedJob,
}) => {
  const { t } = useTranslation();

  return (
    <section className="jobs-list production-section production-saved-data-section">
      <div className="production-section-header">
        <h3>{t('productionTuning.savedDataPanel')}</h3>
        <span className="saved-count">
          {t('productionTuning.showingRange', {
            start: dataRangeStart,
            end: dataRangeEnd,
            total: filteredSavedAnnotations.length,
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
            onChange={(e) =>
              setSavedDataTuneFilter(e.target.value as 'all' | 'untuned' | 'tuned')
            }
          >
            <option value="all">{t('productionTuning.allTuneStates')}</option>
            <option value="untuned">{t('productionTuning.stateUntuned')}</option>
            <option value="tuned">{t('productionTuning.stateTuned')}</option>
          </select>
        </label>
        <label className="production-filter-field">
          <span>{t('productionTuning.scoreFilter')}</span>
          <select
            value={savedDataScoreFilter}
            onChange={(e) => setSavedDataScoreFilter(e.target.value)}
          >
            <option value="all">{t('productionTuning.allScores')}</option>
            {[5, 4, 3, 2, 1].map((score) => (
              <option key={score} value={String(score)}>
                {score}
              </option>
            ))}
            <option value="unrated">{t('productionTuning.unrated')}</option>
          </select>
        </label>
        <span className="saved-count">
          ({filteredSavedAnnotations.length}/{totalSavedCount})
        </span>
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
                    <td>
                      {(savedDataPage - 1) * SAVED_DATA_PAGE_SIZE + idx + 1}
                    </td>
                    <td className="production-cell-text" title={ann.instruction ?? ''}>
                      <div
                        className="production-cell-edit-trigger"
                        role="button"
                        tabIndex={0}
                        title={t('trainingLab.clickToEditInstruction')}
                        onClick={() => onOpenInstructionEditor(ann)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOpenInstructionEditor(ann);
                          }
                        }}
                      >
                        <div className="production-cell-text-content">
                          {ann.instruction}
                        </div>
                      </div>
                    </td>
                    <td className="production-cell-text" title={ann.response ?? ''}>
                      <div
                        className="production-cell-edit-trigger"
                        role="button"
                        tabIndex={0}
                        title={t('trainingLab.clickToEditInstruction')}
                        onClick={() => onOpenInstructionEditor(ann)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOpenInstructionEditor(ann);
                          }
                        }}
                      >
                        <div className="production-cell-text-content">
                          {ann.response}
                        </div>
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
                          onClick={() => void onJumpToFirstLinkedJob(ann)}
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
            <button
              onClick={() => setSavedDataPage((p) => Math.max(1, p - 1))}
              disabled={savedDataPage <= 1}
            >
              {t('productionTuning.prevPage')}
            </button>
            <span>
              {t('productionTuning.pageInfo', {
                page: savedDataPage,
                total: savedDataTotalPages,
              })}
            </span>
            <button
              onClick={() =>
                setSavedDataPage((p) => Math.min(savedDataTotalPages, p + 1))
              }
              disabled={savedDataPage >= savedDataTotalPages}
            >
              {t('productionTuning.nextPage')}
            </button>
          </div>
        </>
      )}
    </section>
  );
};
