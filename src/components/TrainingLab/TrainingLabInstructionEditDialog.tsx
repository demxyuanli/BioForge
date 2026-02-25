import React from 'react';
import { useTranslation } from 'react-i18next';
import type { InstructionEditState } from '../../hooks/useTrainingLabData';

export interface TrainingLabInstructionEditDialogProps {
  state: InstructionEditState | null;
  onClose: () => void;
  onDraftChange: (draft: string) => void;
  onResponseChange: (response: string) => void;
  onSave: () => void;
}

export const TrainingLabInstructionEditDialog: React.FC<
  TrainingLabInstructionEditDialogProps
> = ({ state, onClose, onDraftChange, onResponseChange, onSave }) => {
  const { t } = useTranslation();

  if (!state) return null;

  return (
    <div className="annotation-edit-overlay" onClick={onClose}>
      <div
        className="annotation-edit-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('trainingLab.editInstructionTitle')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="annotation-edit-header">
          <strong>{t('trainingLab.editInstructionTitle')}</strong>
          <button
            type="button"
            onClick={onClose}
            title={t('trainingLab.closeEditDialog')}
          >
            ×
          </button>
        </div>
        <div className="annotation-edit-body">
          <label>{t('trainingLab.instruction')}</label>
          <textarea
            value={state.draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder={t('trainingLab.instructionPlaceholder')}
          />
          <label>{t('trainingLab.response')}</label>
          <textarea
            value={state.response ?? ''}
            onChange={(e) => onResponseChange(e.target.value)}
            placeholder={t('trainingLab.responsePlaceholder')}
          />
        </div>
        <div className="annotation-edit-footer">
          <button type="button" onClick={onClose}>
            {t('trainingLab.cancelEdit')}
          </button>
          <button type="button" onClick={onSave}>
            {t('trainingLab.saveInstruction')}
          </button>
        </div>
      </div>
    </div>
  );
};
