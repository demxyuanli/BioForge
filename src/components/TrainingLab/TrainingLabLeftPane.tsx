import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Trash2 } from 'lucide-react';
import SkillSelector from '../SkillSelector';
import { getKnowledgePointKey } from '../../utils/trainingLabUtils';
import type { KnowledgePoint, TrainingItem } from '../../services/api';

export interface TrainingLabLeftPaneProps {
  trainingItems: TrainingItem[];
  activeTrainingItemId: number | null;
  minWeightFilter: number;
  setMinWeightFilter: React.Dispatch<React.SetStateAction<number>>;
  keywordFilter: string;
  setKeywordFilter: React.Dispatch<React.SetStateAction<string>>;
  contentFilter: string;
  setContentFilter: React.Dispatch<React.SetStateAction<string>>;
  filteredKnowledgePoints: KnowledgePoint[];
  selectedKnowledgePointKeys: Set<string>;
  trainingName: string;
  setTrainingName: React.Dispatch<React.SetStateAction<string>>;
  promptTemplate: string;
  setPromptTemplate: React.Dispatch<React.SetStateAction<string>>;
  selectedSkillIds: number[];
  setSelectedSkillIds: React.Dispatch<React.SetStateAction<number[]>>;
  onActivateTrainingItem: (item: TrainingItem) => void;
  onDeleteTrainingItem: (id: number) => void;
  onToggleKnowledgePointSelection: (key: string) => void;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onSaveTrainingItem: () => void;
}

export const TrainingLabLeftPane: React.FC<TrainingLabLeftPaneProps> = ({
  trainingItems,
  activeTrainingItemId,
  minWeightFilter,
  setMinWeightFilter,
  keywordFilter,
  setKeywordFilter,
  contentFilter,
  setContentFilter,
  filteredKnowledgePoints,
  selectedKnowledgePointKeys,
  trainingName,
  setTrainingName,
  promptTemplate,
  setPromptTemplate,
  selectedSkillIds,
  setSelectedSkillIds,
  onActivateTrainingItem,
  onDeleteTrainingItem,
  onToggleKnowledgePointSelection,
  onSelectAllFiltered,
  onClearSelection,
  onSaveTrainingItem,
}) => {
  const { t } = useTranslation();

  return (
    <div className="training-lab-pane training-lab-left-pane">
      <div className="config-section training-items-top-section">
        <div className="training-item-list">
          {trainingItems.length === 0 ? (
            <p>{t('trainingLab.noTrainingItems')}</p>
          ) : (
            trainingItems.map((item) => (
              <div
                key={item.id}
                className={`training-item-row ${activeTrainingItemId === item.id ? 'active' : ''}`}
              >
                <div className="training-item-main">
                  <strong>{item.name}</strong>
                  <span className="training-item-meta">
                    {item.knowledge_point_keys.length} {t('trainingLab.items')}
                  </span>
                </div>
                <div className="training-item-actions">
                  <button
                    className={activeTrainingItemId === item.id ? 'is-active' : ''}
                    onClick={() => onActivateTrainingItem(item)}
                    aria-label={
                      activeTrainingItemId === item.id
                        ? t('trainingLab.active')
                        : t('trainingLab.activate')
                    }
                    title={
                      activeTrainingItemId === item.id
                        ? t('trainingLab.active')
                        : t('trainingLab.activate')
                    }
                  >
                    <Check size={14} strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => onDeleteTrainingItem(item.id)}
                    aria-label={t('trainingLab.remove')}
                    title={t('trainingLab.remove')}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="config-section training-compose-section">
        <div className="training-filters-grid">
          <div className="form-group">
            <label>{t('trainingLab.minWeight')}</label>
            <select
              value={minWeightFilter}
              onChange={(e) => setMinWeightFilter(Number(e.target.value))}
            >
              <option value={0}>{t('trainingLab.anyWeight')}</option>
              {[1, 2, 3, 4, 5].map((weight) => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>{t('trainingLab.keywordFilter')}</label>
            <input
              type="text"
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              placeholder={t('trainingLab.keywordFilterPlaceholder')}
            />
          </div>
          <div className="form-group">
            <label>{t('trainingLab.contentFilter')}</label>
            <input
              type="text"
              value={contentFilter}
              onChange={(e) => setContentFilter(e.target.value)}
              placeholder={t('trainingLab.contentFilterPlaceholder')}
            />
          </div>
        </div>
        <div className="actions training-filter-actions">
          <button onClick={onSelectAllFiltered}>{t('trainingLab.selectAllFiltered')}</button>
          <button onClick={onClearSelection}>{t('trainingLab.clearSelection')}</button>
        </div>

        <div className="knowledge-points-list">
          {filteredKnowledgePoints.length === 0 ? (
            <p>{t('trainingLab.noKnowledgePointsAfterFilter')}</p>
          ) : (
            <div className="training-kp-list">
              {filteredKnowledgePoints.map((kp) => {
                const key = getKnowledgePointKey(kp);
                const checked = selectedKnowledgePointKeys.has(key);
                return (
                  <div key={key} className={`training-kp-item ${checked ? 'selected' : ''}`}>
                    <label className="training-kp-header">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleKnowledgePointSelection(key)}
                      />
                      <span>
                        {kp.document_name} / #{kp.chunk_index} / {t('trainingLab.minWeight')}:{' '}
                        {kp.weight ?? 1}
                      </span>
                    </label>
                    <div className="training-kp-content">{kp.content}</div>
                    {(kp.keywords ?? []).length > 0 && (
                      <div className="training-kp-keywords">
                        {t('trainingLab.keywords')}: {(kp.keywords ?? []).join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="form-group training-name-inline">
          <label>{t('trainingLab.trainingName')}</label>
          <input
            type="text"
            value={trainingName}
            onChange={(e) => setTrainingName(e.target.value)}
            placeholder={t('trainingLab.trainingNamePlaceholder')}
          />
        </div>
        <div className="form-group">
          <label>{t('trainingLab.promptTemplate')}</label>
          <textarea
            className="training-prompt-template"
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            placeholder={t('trainingLab.promptTemplatePlaceholder')}
          />
        </div>
        <div className="actions">
          <button onClick={onSaveTrainingItem}>{t('trainingLab.saveTrainingItem')}</button>
        </div>
        <SkillSelector selectedIds={selectedSkillIds} onChange={setSelectedSkillIds} />
      </div>
    </div>
  );
};
