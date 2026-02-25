import React, { useState, useEffect, useRef } from 'react';
import { getDocumentSummary, getDocumentPreview } from '../services/api';
import { useFileResourcesWorkspaceLayout } from '../hooks/useFileResourcesWorkspaceLayout';
import { useFileResourcesWorkspaceData } from '../hooks/useFileResourcesWorkspaceData';
import { FileResourcesWorkspaceMountList } from './FileResourcesWorkspace/FileResourcesWorkspaceMountList';
import { FileResourcesWorkspaceDetailSection } from './FileResourcesWorkspace/FileResourcesWorkspaceDetailSection';
import { FileResourcesWorkspaceRightPanel } from './FileResourcesWorkspace/FileResourcesWorkspaceRightPanel';
import { FileResourcesWorkspaceBottomPanel } from './FileResourcesWorkspace/FileResourcesWorkspaceBottomPanel';
import { FileResourcesWorkspaceImportDialog } from './FileResourcesWorkspace/FileResourcesWorkspaceImportDialog';
import './FileResourcesWorkspace.css';

const FileResourcesWorkspace: React.FC = () => {
  const layout = useFileResourcesWorkspaceLayout();
  const data = useFileResourcesWorkspaceData();

  const [documentSummary, setDocumentSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewBlobUrlRef = useRef<string | null>(null);

  const {
    bottomHeightPercent,
    previewMaximized,
    setPreviewMaximized,
    workspaceRef,
    onBottomResizeStart,
  } = layout;

  const {
    mountPoints,
    selectedMp,
    setSelectedMp,
    editDescription,
    setEditDescription,
    savingDesc,
    addingMp,
    docStats,
    loadingDocStats,
    statsByMpId,
    removeError,
    removing,
    loadingMountPointFiles,
    descriptionExpanded,
    setDescriptionExpanded,
    filterByExt,
    setFilterByExt,
    expandedNoteRowKey,
    setExpandedNoteRowKey,
    fileNotes,
    setFileNotes,
    savingNoteRowKey,
    weightDragging,
    recentAnnotated,
    editingMpId,
    setEditingMpId,
    editingName,
    setEditingName,
    selectedFile,
    setSelectedFile,
    searchQuery,
    setSearchQuery,
    filteredFiles,
    searchResults,
    getWeightForRow,
    handleWeightMouseDown,
    handleAddMountPoint,
    handleSaveDescription,
    handleSaveMountName,
    handleSaveNote,
    handleRemoveMountPoint,
    importDialogOpen,
    setImportDialogOpen,
    importTargetDirId,
    setImportTargetDirId,
    loadingDcDirs,
    importingFile,
    importMessage,
    flatDcDirs,
    handleOpenImportDialog,
    handleConfirmImport,
  } = data;

  useEffect(() => {
    if (!selectedFile) {
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
    getDocumentSummary(selectedFile.mpId, selectedFile.relativePath)
      .then((r) => setDocumentSummary(r.summary))
      .catch(() => setDocumentSummary(''))
      .finally(() => setLoadingSummary(false));
    setLoadingPreview(true);
    setPreviewError(null);
    previewBlobUrlRef.current = null;
    setPreviewBlobUrl(null);
    getDocumentPreview(selectedFile.mpId, selectedFile.relativePath)
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
  }, [selectedFile?.mpId, selectedFile?.relativePath]);

  const workspace = (
    <div
      className={`fr-workspace ${previewMaximized ? 'fr-workspace-preview-maximized' : ''}`}
      ref={workspaceRef}
    >
      {!previewMaximized && (
        <div className="fr-workspace-top">
          <div className="fr-workspace-left">
            <FileResourcesWorkspaceMountList
              mountPoints={mountPoints}
              selectedMp={selectedMp}
              setSelectedMp={setSelectedMp}
              statsByMpId={statsByMpId}
              addingMp={addingMp}
              editingMpId={editingMpId}
              setEditingMpId={setEditingMpId}
              editingName={editingName}
              setEditingName={setEditingName}
              removing={removing}
              onAddMountPoint={handleAddMountPoint}
              onSaveMountName={handleSaveMountName}
              onRemoveMountPoint={handleRemoveMountPoint}
            />
            <FileResourcesWorkspaceDetailSection
              selectedMp={selectedMp}
              docStats={docStats}
              loadingDocStats={loadingDocStats}
              filterByExt={filterByExt}
              setFilterByExt={setFilterByExt}
              filteredFiles={filteredFiles}
              loadingMountPointFiles={loadingMountPointFiles}
              expandedNoteRowKey={expandedNoteRowKey}
              setExpandedNoteRowKey={setExpandedNoteRowKey}
              fileNotes={fileNotes}
              setFileNotes={setFileNotes}
              weightDragging={weightDragging}
              getWeightForRow={getWeightForRow}
              handleWeightMouseDown={handleWeightMouseDown}
              handleSaveNote={handleSaveNote}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              descriptionExpanded={descriptionExpanded}
              setDescriptionExpanded={setDescriptionExpanded}
              editDescription={editDescription}
              setEditDescription={setEditDescription}
              savingDesc={savingDesc}
              removeError={removeError}
              removing={removing}
              savingNoteRowKey={savingNoteRowKey}
              onSaveDescription={handleSaveDescription}
              onRemoveMountPoint={handleRemoveMountPoint}
            />
          </div>
          <FileResourcesWorkspaceRightPanel
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            recentAnnotated={recentAnnotated}
            mountPoints={mountPoints}
            selectedMp={selectedMp}
            selectedFile={selectedFile}
            setSelectedMp={setSelectedMp}
            setSelectedFile={setSelectedFile}
            setExpandedNoteRowKey={setExpandedNoteRowKey}
          />
        </div>
      )}
      {selectedFile && (
        <FileResourcesWorkspaceBottomPanel
          selectedFile={selectedFile}
          documentSummary={documentSummary}
          loadingSummary={loadingSummary}
          previewBlobUrl={previewBlobUrl}
          loadingPreview={loadingPreview}
          previewError={previewError}
          previewMaximized={previewMaximized}
          onTogglePreviewMaximized={() => setPreviewMaximized((m) => !m)}
          onClose={() => {
            setSelectedFile(null);
            setPreviewMaximized(false);
          }}
          onResizeStart={onBottomResizeStart}
          bottomHeightPercent={bottomHeightPercent}
          onOpenImportDialog={handleOpenImportDialog}
          importingFile={importingFile}
        />
      )}
      {importDialogOpen && (
        <FileResourcesWorkspaceImportDialog
          open={importDialogOpen}
          onClose={() => setImportDialogOpen(false)}
          selectedFile={selectedFile}
          importTargetDirId={importTargetDirId}
          setImportTargetDirId={setImportTargetDirId}
          flatDcDirs={flatDcDirs}
          loadingDcDirs={loadingDcDirs}
          importingFile={importingFile}
          importMessage={importMessage}
          onConfirmImport={handleConfirmImport}
        />
      )}
    </div>
  );

  if (previewMaximized) {
    return (
      <div
        className="fr-workspace-maximized-root"
        style={{
          flex: 1,
          minHeight: 0,
          margin: -16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {workspace}
      </div>
    );
  }
  return workspace;
};

export default FileResourcesWorkspace;
