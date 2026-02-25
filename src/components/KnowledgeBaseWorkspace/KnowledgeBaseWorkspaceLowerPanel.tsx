import React from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2, Minimize2, X } from 'lucide-react';
import Tooltip from '../Tooltip';
import PdfViewer from '../PdfViewer';
import type { Document } from '../../services/api';

export interface KnowledgeBaseWorkspaceLowerPanelProps {
  selectedDoc: Document | null;
  documentSummary: string;
  loadingSummary: boolean;
  previewBlobUrl: string | null;
  loadingPreview: boolean;
  previewError: string | null;
  lowerVisible: boolean;
  previewMaximized: boolean;
  onTogglePreviewMaximized: () => void;
  onCloseLower: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
}

export const KnowledgeBaseWorkspaceLowerPanel: React.FC<KnowledgeBaseWorkspaceLowerPanelProps> = ({
  selectedDoc,
  documentSummary,
  loadingSummary,
  previewBlobUrl,
  loadingPreview,
  previewError,
  lowerVisible,
  previewMaximized,
  onTogglePreviewMaximized,
  onCloseLower,
  onResizeStart,
}) => {
  const { t } = useTranslation();

  if (!lowerVisible) return null;

  return (
    <>
      {!previewMaximized && (
        <div
          className="kb-resize-handle"
          role="separator"
          aria-label="Resize"
          onMouseDown={onResizeStart}
        />
      )}
      <div className="kb-lower">
        <div className="kb-lower-detail">
          <div className="kb-lower-detail-header">
            <Tooltip title={selectedDoc?.filename ?? ''}>
              <span className="kb-lower-detail-title">{selectedDoc?.filename ?? ''}</span>
            </Tooltip>
            <div className="kb-lower-detail-actions">
              <Tooltip
                title={
                  previewMaximized
                    ? t('knowledgeBaseWorkspace.restorePreview')
                    : t('knowledgeBaseWorkspace.maximizePreview')
                }
              >
                <button
                  type="button"
                  className="kb-lower-maximize-btn"
                  onClick={onTogglePreviewMaximized}
                  aria-label={
                    previewMaximized
                      ? t('knowledgeBaseWorkspace.restorePreview')
                      : t('knowledgeBaseWorkspace.maximizePreview')
                  }
                >
                  {previewMaximized ? (
                    <Minimize2 size={14} aria-hidden />
                  ) : (
                    <Maximize2 size={14} aria-hidden />
                  )}
                </button>
              </Tooltip>
              <Tooltip title={t('knowledgeBaseWorkspace.closePreview')}>
                <button
                  type="button"
                  className="kb-lower-hide-btn"
                  onClick={onCloseLower}
                  aria-label={t('knowledgeBaseWorkspace.closePreview')}
                >
                  <X size={14} className="kb-lower-hide-btn-icon" aria-hidden />
                </button>
              </Tooltip>
            </div>
          </div>
          <div className="kb-lower-summary-block">
            {loadingSummary ? (
              <div className="kb-lower-summary-placeholder">{t('sidebar.loading')}</div>
            ) : (
              <div className="kb-lower-summary-content">
                {(documentSummary || '').trim()
                  ? documentSummary
                  : t('knowledgeBaseWorkspace.summaryReservedForAI')}
              </div>
            )}
          </div>
          <div className="kb-lower-preview-block">
            {loadingPreview ? (
              <div className="kb-lower-preview-placeholder">{t('sidebar.loading')}</div>
            ) : previewError ? (
              <div className="kb-lower-preview-error">{previewError}</div>
            ) : previewBlobUrl ? (
              <PdfViewer url={previewBlobUrl} className="kb-lower-preview-pdf" />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};
