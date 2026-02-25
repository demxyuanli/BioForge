import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getDocumentSummaryByDocumentId, getDocumentPreviewByDocumentId } from '../services/api';
import { useKnowledgeBaseWorkspaceLayout, UPPER_MIN, UPPER_MAX_OFFSET, LEFT_PANEL_MIN } from '../hooks/useKnowledgeBaseWorkspaceLayout';
import { useKnowledgeBaseWorkspaceData } from '../hooks/useKnowledgeBaseWorkspaceData';
import { KnowledgeBaseWorkspaceFileList } from './KnowledgeBaseWorkspace/KnowledgeBaseWorkspaceFileList';
import { KnowledgeBaseWorkspaceKpPanel } from './KnowledgeBaseWorkspace/KnowledgeBaseWorkspaceKpPanel';
import { KnowledgeBaseWorkspaceLowerPanel } from './KnowledgeBaseWorkspace/KnowledgeBaseWorkspaceLowerPanel';
import './KnowledgeBaseWorkspace.css';

const KnowledgeBaseWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const layout = useKnowledgeBaseWorkspaceLayout();
  const data = useKnowledgeBaseWorkspaceData();

  const [previewMaximized, setPreviewMaximized] = useState(false);
  const [documentSummary, setDocumentSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewBlobUrlRef = useRef<string | null>(null);

  const {
    lowerVisible,
    setLowerVisible,
    upperHeight,
    setUpperHeight,
    leftPanelWidth,
    workspaceRef,
    upperBodyRef,
    upperLeftRightRef,
    kpTopPanelRef,
    kpListHeight,
    onResizeStart,
    onResizeHorizontalStart,
    onResizeKpVerticalStart,
  } = layout;

  const {
    selectedDirId,
    setSelectedDirId,
    selectedDocId,
    knowledgePoints,
    kpPage,
    kpTotalPages,
    setKpPage,
    selectedKp,
    setSelectedKp,
    topLevelDirs,
    displayFileList,
    searchQuery,
    setSearchQuery,
    contentSearching,
    contentSearchError,
    contentSearchResults,
    handleContentSearch,
    handleContentSearchResultClick,
    getMeta,
    updateMeta,
    expandedNoteDocId,
    setExpandedNoteDocId,
    addTagDocId,
    setAddTagDocId,
    addTagInput,
    setAddTagInput,
    selectedDoc,
    onSelectFile,
    deletedKpIds,
    kpWeightDragging,
    handleKpWeightMouseDown,
    onKpWeightChange,
    onKpDelete,
    onKpRestore,
    highlightedKeywords,
    loadKeywords,
    handleKpContentMouseUp,
    removeHighlightedKeyword,
  } = data;

  useEffect(() => {
    if (!lowerVisible || selectedDocId == null) {
      setDocumentSummary('');
      setLoadingSummary(false);
      setPreviewError(null);
      previewBlobUrlRef.current = null;
      setPreviewBlobUrl(null);
      setLoadingPreview(false);
      return;
    }
    setLoadingSummary(true);
    setDocumentSummary('');
    getDocumentSummaryByDocumentId(selectedDocId)
      .then((r) => setDocumentSummary(r.summary))
      .catch(() => setDocumentSummary(''))
      .finally(() => setLoadingSummary(false));
    setLoadingPreview(true);
    setPreviewError(null);
    previewBlobUrlRef.current = null;
    setPreviewBlobUrl(null);
    getDocumentPreviewByDocumentId(selectedDocId)
      .then((url) => {
        if (!url) {
          setPreviewError('Preview not available');
          return;
        }
        previewBlobUrlRef.current = url;
        setPreviewBlobUrl(url);
      })
      .catch(() => setPreviewError('Preview failed'))
      .finally(() => setLoadingPreview(false));
  }, [lowerVisible, selectedDocId]);

  const onOpenPreview = () => {
    setLowerVisible(true);
    const el = workspaceRef.current;
    if (el) {
      const total = el.clientHeight;
      const half = Math.floor((total - 4) / 2);
      const next = Math.max(UPPER_MIN, Math.min(total - 4 - UPPER_MAX_OFFSET, half));
      setUpperHeight(next);
    }
  };

  return (
    <div
      className={`kb-workspace ${previewMaximized ? 'kb-workspace-preview-maximized' : ''}`}
      ref={workspaceRef}
    >
      {!previewMaximized && (
        <div
          className="kb-upper"
          style={
            lowerVisible ? { height: upperHeight, flexShrink: 0 } : { flex: 1, minHeight: 0 }
          }
        >
          <div className="kb-upper-top">
            <span className="kb-upper-top-label">{t('knowledgeBaseWorkspace.directory')}</span>
            <span className="kb-upper-top-brackets">
              <button
                type="button"
                className={`kb-upper-top-tag ${selectedDirId === null ? 'kb-upper-top-tag-selected' : ''}`}
                onClick={() => setSelectedDirId(null)}
                aria-pressed={selectedDirId === null}
              >
                [ {t('knowledgeBaseWorkspace.root')} ]
              </button>
              {topLevelDirs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`kb-upper-top-tag ${selectedDirId === d.id ? 'kb-upper-top-tag-selected' : ''}`}
                  onClick={() => setSelectedDirId(selectedDirId === d.id ? null : d.id)}
                  aria-pressed={selectedDirId === d.id}
                >
                  [ {d.name} ]
                </button>
              ))}
            </span>
          </div>
          <div className="kb-upper-body" ref={upperBodyRef}>
            <div className="kb-upper-left">
              <div
                className="kb-upper-left-filelist kb-cli-panel"
                style={{ width: leftPanelWidth, minWidth: LEFT_PANEL_MIN }}
              >
                <KnowledgeBaseWorkspaceFileList
                  displayFileList={displayFileList}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  contentSearching={contentSearching}
                  contentSearchError={contentSearchError}
                  contentSearchResults={contentSearchResults}
                  onContentSearch={handleContentSearch}
                  onContentSearchResultClick={handleContentSearchResultClick}
                  getMeta={getMeta}
                  updateMeta={updateMeta}
                  expandedNoteDocId={expandedNoteDocId}
                  setExpandedNoteDocId={setExpandedNoteDocId}
                  addTagDocId={addTagDocId}
                  setAddTagDocId={setAddTagDocId}
                  addTagInput={addTagInput}
                  setAddTagInput={setAddTagInput}
                  selectedDocId={selectedDocId}
                  onSelectFile={onSelectFile}
                />
              </div>
            </div>
            <div
              className="kb-resize-handle-h"
              role="separator"
              aria-label="Resize left panel"
              onMouseDown={onResizeHorizontalStart}
            />
            <KnowledgeBaseWorkspaceKpPanel
              rootRef={upperLeftRightRef}
              knowledgePoints={knowledgePoints}
                kpPage={kpPage}
                kpTotalPages={kpTotalPages}
                setKpPage={setKpPage}
                selectedKp={selectedKp}
                setSelectedKp={setSelectedKp}
                kpWeightDragging={kpWeightDragging}
                handleKpWeightMouseDown={handleKpWeightMouseDown}
                onKpWeightChange={onKpWeightChange}
                deletedKpIds={deletedKpIds}
                onKpDelete={onKpDelete}
                onKpRestore={onKpRestore}
                highlightedKeywords={highlightedKeywords}
                loadKeywords={loadKeywords}
                handleKpContentMouseUp={handleKpContentMouseUp}
                removeHighlightedKeyword={removeHighlightedKeyword}
                selectedDocId={selectedDocId}
                lowerVisible={lowerVisible}
                onOpenPreview={onOpenPreview}
                kpListHeight={kpListHeight}
                kpTopPanelRef={kpTopPanelRef}
                onResizeKpVerticalStart={onResizeKpVerticalStart}
              />
          </div>
        </div>
      )}
      {lowerVisible === true && (
        <KnowledgeBaseWorkspaceLowerPanel
          selectedDoc={selectedDoc}
          documentSummary={documentSummary}
          loadingSummary={loadingSummary}
          previewBlobUrl={previewBlobUrl}
          loadingPreview={loadingPreview}
          previewError={previewError}
          lowerVisible={lowerVisible}
          previewMaximized={previewMaximized}
          onTogglePreviewMaximized={() => setPreviewMaximized((p) => !p)}
          onCloseLower={() => setLowerVisible(false)}
          onResizeStart={onResizeStart}
        />
      )}
    </div>
  );
};

export default KnowledgeBaseWorkspace;
