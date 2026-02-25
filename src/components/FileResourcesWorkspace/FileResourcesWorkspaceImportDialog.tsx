import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SelectedFile } from '../../hooks/useFileResourcesWorkspaceData';
import type { FlatDirItem } from '../../hooks/useFileResourcesWorkspaceData';

export interface FileResourcesWorkspaceImportDialogProps {
  open: boolean;
  onClose: () => void;
  selectedFile: SelectedFile | null;
  importTargetDirId: number | null;
  setImportTargetDirId: React.Dispatch<React.SetStateAction<number | null>>;
  flatDcDirs: FlatDirItem[];
  loadingDcDirs: boolean;
  importingFile: boolean;
  importMessage: { type: 'success' | 'error'; text: string } | null;
  onConfirmImport: () => Promise<void>;
}

export const FileResourcesWorkspaceImportDialog: React.FC<
  FileResourcesWorkspaceImportDialogProps
> = ({
  open,
  onClose,
  selectedFile,
  importTargetDirId,
  setImportTargetDirId,
  flatDcDirs,
  loadingDcDirs,
  importingFile,
  importMessage,
  onConfirmImport,
}) => {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      className="fr-import-dialog-overlay"
      onClick={() => {
        if (!importingFile) onClose();
      }}
    >
      <div className="fr-import-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="fr-import-dialog-title">
          {t('fileResourcesWorkspace.importDialogTitle')}
        </div>
        <div className="fr-import-dialog-desc">
          {t('fileResourcesWorkspace.importDialogDesc')}
        </div>
        <div className="fr-import-dialog-file">
          <span className="fr-import-dialog-file-label">
            {t('fileResourcesWorkspace.columnFileName')}:
          </span>
          <span className="fr-import-dialog-file-name">
            {selectedFile?.filename}
          </span>
        </div>
        <label className="fr-import-dialog-label">
          {t('fileResourcesWorkspace.selectTargetDirectory')}
        </label>
        {loadingDcDirs ? (
          <div className="fr-import-dialog-loading">{t('sidebar.loading')}</div>
        ) : (
          <select
            className="fr-import-dialog-select"
            value={importTargetDirId ?? ''}
            onChange={(e) =>
              setImportTargetDirId(e.target.value ? Number(e.target.value) : null)
            }
            disabled={importingFile}
          >
            <option value="">{t('fileResourcesWorkspace.rootDirectory')}</option>
            {flatDcDirs.map((d) => (
              <option key={d.id} value={d.id}>
                {'\u00A0\u00A0'.repeat(d.depth)}{d.name}
              </option>
            ))}
          </select>
        )}
        {importMessage && (
          <div
            className={`fr-import-dialog-msg fr-import-dialog-msg-${importMessage.type}`}
          >
            {importMessage.text}
          </div>
        )}
        <div className="fr-import-dialog-actions">
          <button
            type="button"
            className="fr-btn fr-btn-neutral"
            onClick={onClose}
            disabled={importingFile}
          >
            {t('fileResourcesWorkspace.cancelImport')}
          </button>
          <button
            type="button"
            className="fr-btn fr-btn-primary"
            onClick={onConfirmImport}
            disabled={importingFile || loadingDcDirs}
          >
            {importingFile
              ? t('fileResourcesWorkspace.importing')
              : t('fileResourcesWorkspace.confirmImport')}
          </button>
        </div>
      </div>
    </div>
  );
};
