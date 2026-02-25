import React from 'react';
import { useTranslation } from 'react-i18next';
import { CircleHelp, Star } from 'lucide-react';
import Tooltip from '../Tooltip';
import type { Annotation } from '../../services/api';
import type { GenerationSource } from '../../hooks/useTrainingLabData';

export interface TrainingLabRightPaneProps {
  useLocalModel: boolean;
  localModelName: string;
  availableLocalModels: string[];
  isFetchingModels: boolean;
  onFetchLocalModels: () => void;
  knowledgePointsLength: number;
  filteredKnowledgePointsLength: number;
  selectedKnowledgePointsSize: number;
  generationSource: GenerationSource;
  generationPointCount: number;
  annotations: Annotation[];
  isGenerating: boolean;
  savingForFinetuning: boolean;
  candidateCount: number;
  setCandidateCount: React.Dispatch<React.SetStateAction<number>>;
  onLoadKnowledgePoints: () => void;
  onGenerateAnnotations: () => void;
  onSaveForFinetuning: () => void;
  onExportJSONL: () => void;
  onScoreChange: (index: number, score: number) => void;
  onScoreMouseDown: (index: number, score: number) => void;
  onScoreMouseEnter: (index: number, score: number) => void;
  onSetIsScoringDrag: (value: boolean) => void;
  onOpenInstructionEditor: (index: number) => void;
}

export const TrainingLabRightPane: React.FC<TrainingLabRightPaneProps> = ({
  useLocalModel,
  localModelName,
  availableLocalModels,
  isFetchingModels,
  onFetchLocalModels,
  knowledgePointsLength,
  filteredKnowledgePointsLength,
  selectedKnowledgePointsSize,
  generationSource,
  generationPointCount,
  annotations,
  isGenerating,
  savingForFinetuning,
  candidateCount,
  setCandidateCount,
  onLoadKnowledgePoints,
  onGenerateAnnotations,
  onSaveForFinetuning,
  onExportJSONL,
  onScoreChange,
  onScoreMouseDown,
  onScoreMouseEnter,
  onSetIsScoringDrag,
  onOpenInstructionEditor,
}) => {
  const { t } = useTranslation();

  return (
    <div className="training-lab-pane training-lab-right-pane">
      {useLocalModel && (
        <div className="config-section">
          <div className="form-group">
            <label>{t('trainingLab.localModelName')}:</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                list="local-models-list"
                type="text"
                value={localModelName}
                readOnly
                style={{
                  flex: 1,
                  backgroundColor: 'var(--vs-input-bg)',
                  color: 'var(--vs-muted)',
                }}
              />
              <datalist id="local-models-list">
                {availableLocalModels.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <Tooltip title={t('trainingLab.refreshModels')}>
                <button
                  onClick={onFetchLocalModels}
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
        <p>{t('trainingLab.availableKnowledgePoints')}: {knowledgePointsLength}</p>
        <p>{t('trainingLab.filteredKnowledgePoints')}: {filteredKnowledgePointsLength}</p>
        <p>{t('trainingLab.selectedKnowledgePoints')}: {selectedKnowledgePointsSize}</p>
        <p>{t('trainingLab.generationSource')}: {generationSource.sourceLabel}</p>
        <p>{t('trainingLab.knowledgePointSelection')}: {generationPointCount}</p>
      </div>

      <div className="actions">
        <button onClick={onLoadKnowledgePoints}>{t('trainingLab.refreshKnowledgePoints')}</button>
        <button onClick={onGenerateAnnotations} disabled={isGenerating}>
          {isGenerating ? t('trainingLab.generating') : t('trainingLab.generateInstructionPairs')}
        </button>
        <button
          onClick={onSaveForFinetuning}
          disabled={annotations.length === 0 || savingForFinetuning}
        >
          {savingForFinetuning ? t('trainingLab.saving') : t('trainingLab.saveForFinetuning')}
        </button>
        <button onClick={onExportJSONL} disabled={annotations.length === 0}>
          {t('trainingLab.exportJSONL')} ({annotations.length} {t('trainingLab.items')})
        </button>
        <div className="training-actions-inline-field">
          <label className="training-label-with-tip">
            <span>{t('trainingLab.candidatesPerKnowledgePoint')}</span>
            <Tooltip title={t('trainingLab.candidatesPerKnowledgePointDesc')}>
              <span
                className="training-inline-tip-icon"
                aria-label={t('trainingLab.candidatesPerKnowledgePointDesc')}
              >
                <CircleHelp size={14} strokeWidth={1.5} />
              </span>
            </Tooltip>
          </label>
          <input
            type="number"
            min={1}
            max={10}
            step={1}
            value={candidateCount}
            onChange={(e) =>
              setCandidateCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
            }
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
                  onClick={() => onOpenInstructionEditor(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenInstructionEditor(index);
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
                  onClick={() => onOpenInstructionEditor(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenInstructionEditor(index);
                    }
                  }}
                >
                  <strong>{t('trainingLab.response')}:</strong> {ann.response}
                </div>
                <div className="scoring">
                  <label>{t('trainingLab.score')}:</label>
                  <div
                    className="training-star-rating"
                    onMouseUp={() => onSetIsScoringDrag(false)}
                  >
                    {[1, 2, 3, 4, 5].map((starValue) => {
                      const isActive = (ann.score ?? 0) >= starValue;
                      return (
                        <button
                          type="button"
                          key={starValue}
                          className={`training-star-button ${isActive ? 'active' : ''}`}
                          onMouseDown={() => onScoreMouseDown(index, starValue)}
                          onMouseEnter={() => onScoreMouseEnter(index, starValue)}
                          onClick={() => onScoreChange(index, starValue)}
                          aria-label={`${t('trainingLab.score')} ${starValue}`}
                        >
                          <Star
                            size={14}
                            strokeWidth={1.5}
                            fill={isActive ? 'currentColor' : 'none'}
                          />
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
  );
};
