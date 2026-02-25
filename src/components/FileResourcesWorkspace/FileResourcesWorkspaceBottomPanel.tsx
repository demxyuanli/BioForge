import React from 'react';
import { useTranslation } from 'react-i18next';
import { DatabaseZap, Maximize2, Minimize2, X } from 'lucide-react';
import Tooltip from '../Tooltip';
import PdfViewer from '../PdfViewer';
import type { SelectedFile } from '../../hooks/useFileResourcesWorkspaceData';

export interface FileResourcesWorkspaceBottomPanelProps {
  selectedFile: SelectedFile | null;
  documentSummary: string;
  loadingSummary: boolean;
  previewBlobUrl: string | null;
  loadingPreview: boolean;
  previewError: string | null;
  previewMaximized: boolean;
  onTogglePreviewMaximized: () => void;
  onClose: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
  bottomHeightPercent: number;
  onOpenImportDialog: () => Promise<void>;
  importingFile: boolean;
}

export const FileResourcesWorkspaceBottomPanel: React.FC<
  FileResourcesWorkspaceBottomPanelProps
> = ({
  selectedFile,
  documentSummary,
  loadingSummary,
  previewBlobUrl,
  loadingPreview,
  previewError,
  previewMaximized,
  onTogglePreviewMaximized,
  onClose,
  onResizeStart,
  bottomHeightPercent,
  onOpenImportDialog,
  importingFile,
}) => {
  const { t } = useTranslation();

  if (!selectedFile) return null;

  return (
    <>
      {!previewMaximized && (
        <Tooltip title={t('fileResourcesWorkspace.resizePanel')}>
          <div
            className="fr-workspace-resize-handle"
            onMouseDown={onResizeStart}
            role="separator"
            aria-orientation="horizontal"
            aria-valuenow={bottomHeightPercent}
          />
        </Tooltip>
      )}
      <div
        className="fr-workspace-bottom"
        style={
          previewMaximized
            ? undefined
            : { flex: `0 0 ${bottomHeightPercent}%`, minHeight: 200 }
        }
      >
        <div className="fr-document-detail-section">
          <div className="fr-document-detail-header">
            <Tooltip title={selectedFile.filename}>
              <span className="fr-document-detail-title">
                {selectedFile.filename}
              </span>
            </Tooltip>
            <div className="fr-document-detail-actions">
              <Tooltip title={t('fileResourcesWorkspace.importToDataCenter')}>
                <button
                  type="button"
                  className="fr-import-dc-btn"
                  onClick={onOpenImportDialog}
                  disabled={importingFile}
                  aria-label={t('fileResourcesWorkspace.importToDataCenter')}
                >
                  <DatabaseZap size={14} aria-hidden />
                </button>
              </Tooltip>
              <Tooltip
                title={
                  previewMaximized
                    ? t('fileResourcesWorkspace.restorePreview')
                    : t('fileResourcesWorkspace.maximizePreview')
                }
              >
                <button
                  type="button"
                  className="fr-document-detail-maximize"
                  onClick={onTogglePreviewMaximized}
                  aria-label={
                    previewMaximized
                      ? t('fileResourcesWorkspace.restorePreview')
                      : t('fileResourcesWorkspace.maximizePreview')
                  }
                >
                  {previewMaximized ? (
                    <Minimize2 size={14} aria-hidden />
                  ) : (
                    <Maximize2 size={14} aria-hidden />
                  )}
                </button>
              </Tooltip>
              <Tooltip title={t('common.close')}>
                <button
                  type="button"
                  className="fr-document-detail-close"
                  onClick={onClose}
                  aria-label={t('common.close')}
                >
                  <X className="fr-document-detail-close-icon" size={14} aria-hidden />
                </button>
              </Tooltip>
            </div>
          </div>
          <div className="fr-document-summary-block">
            {loadingSummary ? (
              <div className="fr-document-summary-placeholder">
                {t('sidebar.loading')}
              </div>
            ) : (
              <div className="fr-document-summary-content">
                {(documentSummary || '').trim()
                  ? documentSummary
                  : t('fileResourcesWorkspace.summaryReservedForAI')}
              </div>
            )}
          </div>
          <div className="fr-document-preview-block">
            {loadingPreview ? (
              <div className="fr-document-preview-placeholder">
                {t('sidebar.loading')}
              </div>
            ) : previewError ? (
              <div className="fr-document-preview-error">{previewError}</div>
            ) : previewBlobUrl ? (
              <PdfViewer
                url={previewBlobUrl}
                className="fr-document-preview-pdf"
              />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};
