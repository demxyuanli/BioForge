import React from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import Tooltip from '../Tooltip';
import type { MountPoint, MountPointDocumentStats } from '../../services/api';
import type { SelectedFile } from '../../hooks/useFileResourcesWorkspaceData';

export interface FileResourcesWorkspaceDetailSectionProps {
  selectedMp: MountPoint | null;
  docStats: MountPointDocumentStats | null;
  loadingDocStats: boolean;
  filterByExt: string | null;
  setFilterByExt: React.Dispatch<React.SetStateAction<string | null>>;
  filteredFiles: { ext: string; path: string; filename: string }[];
  loadingMountPointFiles: boolean;
  expandedNoteRowKey: string | null;
  setExpandedNoteRowKey: React.Dispatch<React.SetStateAction<string | null>>;
  fileNotes: Record<string, string>;
  setFileNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  weightDragging: { rowKey: string; value: number } | null;
  getWeightForRow: (rowKey: string) => number;
  handleWeightMouseDown: (
    rowKey: string,
    relPath: string,
    currentWeight: number,
    el: HTMLSpanElement | null
  ) => void;
  handleSaveNote: (rowKey: string, relPath: string, note: string) => void;
  selectedFile: SelectedFile | null;
  setSelectedFile: React.Dispatch<React.SetStateAction<SelectedFile | null>>;
  descriptionExpanded: boolean;
  setDescriptionExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  editDescription: string;
  setEditDescription: React.Dispatch<React.SetStateAction<string>>;
  savingDesc: boolean;
  removeError: string | null;
  removing: boolean;
  savingNoteRowKey: string | null;
  onSaveDescription: () => Promise<void>;
  onRemoveMountPoint: (mp?: MountPoint | null) => Promise<void>;
}

export const FileResourcesWorkspaceDetailSection: React.FC<
  FileResourcesWorkspaceDetailSectionProps
> = ({
  selectedMp,
  docStats,
  loadingDocStats,
  filterByExt,
  setFilterByExt,
  filteredFiles,
  loadingMountPointFiles,
  expandedNoteRowKey,
  setExpandedNoteRowKey,
  fileNotes,
  setFileNotes,
  weightDragging,
  getWeightForRow,
  handleWeightMouseDown,
  handleSaveNote,
  selectedFile,
  setSelectedFile,
  descriptionExpanded,
  setDescriptionExpanded,
  editDescription,
  setEditDescription,
  savingDesc,
  removeError,
  removing,
  savingNoteRowKey,
  onSaveDescription,
  onRemoveMountPoint,
}) => {
  const { t } = useTranslation();

  if (!selectedMp) {
    return (
      <div className="fr-cli-detail-section">
        <div className="fr-cli-placeholder">
          {t('fileResourcesWorkspace.selectMountPointForAnnotation')}
        </div>
      </div>
    );
  }

  return (
    <div className="fr-cli-detail-section">
      <div className="fr-stats-tags-wrap">
        {loadingDocStats ? (
          <div className="fr-stats-tags-loading">{t('sidebar.loading')}</div>
        ) : docStats ? (
          <div className="fr-stats-inline-wrap">
            <span className="fr-stats-total">
              {t('fileResourcesWorkspace.totalDocuments', { count: docStats.total })}
            </span>
            {Object.entries(docStats.by_type)
              .sort((a, b) => b[1] - a[1])
              .map(([ext, count]) => (
                <Tooltip
                  key={ext}
                  title={t('fileResourcesWorkspace.filterByType', {
                    ext: ext.toUpperCase(),
                  })}
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className={`fr-stats-bracket-link ${filterByExt === ext ? 'active' : ''}`}
                    onClick={() =>
                      setFilterByExt((prev) => (prev === ext ? null : ext))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setFilterByExt((prev) => (prev === ext ? null : ext));
                      }
                    }}
                  >
                    [
                    <span className="fr-stats-bracket-underline">
                      {ext.toUpperCase()}_{count}
                    </span>
                    ]
                  </span>
                </Tooltip>
              ))}
          </div>
        ) : null}
        <Tooltip title={selectedMp.path}>
          <span className="fr-stats-mount-path">{selectedMp.path}</span>
        </Tooltip>
      </div>
      <div className="fr-files-panel fr-cli-panel fr-cli-files-panel">
        {loadingMountPointFiles ? (
          <div className="fr-cli-line">{t('fileResourcesWorkspace.loadingFiles')}</div>
        ) : filteredFiles.length > 0 ? (
          <div className="fr-cli-file-table-wrap">
            <div className="fr-cli-file-table-header">
              <span className="fr-cli-col-filename">
                {t('fileResourcesWorkspace.columnFileName')}
              </span>
              <span className="fr-cli-col-path">
                {t('fileResourcesWorkspace.columnPath')}
              </span>
              <span className="fr-cli-col-weight">
                {t('fileResourcesWorkspace.columnWeight')}
              </span>
              <span className="fr-cli-col-notes" aria-hidden="true" />
            </div>
            {filteredFiles.map((row) => {
              const rowKey = `${row.ext}:${row.path}`;
              const notesExpanded = expandedNoteRowKey === rowKey;
              const baseWeight = getWeightForRow(rowKey);
              const weight =
                weightDragging?.rowKey === rowKey ? weightDragging.value : baseWeight;
              const isSelectedFile =
                selectedFile?.mpId === selectedMp?.id &&
                selectedFile?.relativePath === row.path;
              return (
                <React.Fragment key={rowKey}>
                  <div
                    className={`fr-cli-file-row ${isSelectedFile ? 'fr-cli-file-row-selected' : ''}`}
                    onClick={() =>
                      setSelectedFile({
                        mpId: selectedMp.id,
                        relativePath: row.path,
                        filename: row.filename,
                        ext: row.ext,
                      })
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedFile({
                          mpId: selectedMp.id,
                          relativePath: row.path,
                          filename: row.filename,
                          ext: row.ext,
                        });
                      }
                    }}
                    aria-pressed={isSelectedFile}
                  >
                    <Tooltip title={row.filename}>
                      <span
                        className={`fr-cli-col-filename fr-file-weight-${Math.min(5, Math.max(0, weight))}`}
                      >
                        {row.filename}
                      </span>
                    </Tooltip>
                    <Tooltip title={row.path}>
                      <span className="fr-cli-col-path">{row.path}</span>
                    </Tooltip>
                    <span
                      className="fr-cli-col-weight fr-star-row fr-weight-slider"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleWeightMouseDown(
                          rowKey,
                          row.path,
                          weight,
                          e.currentTarget
                        );
                      }}
                      onClick={(e) => e.stopPropagation()}
                      role="slider"
                      aria-valuemin={0}
                      aria-valuemax={5}
                      aria-valuenow={weight}
                      aria-label={t('fileResourcesWorkspace.columnWeight')}
                    >
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Tooltip
                          key={s}
                          title={t('fileResourcesWorkspace.slideToSetWeight')}
                        >
                          <span
                            className={`fr-star ${s <= weight ? 'filled' : ''}`}
                          >
                            {s <= weight ? '\u2605' : '\u2606'}
                          </span>
                        </Tooltip>
                      ))}
                    </span>
                    <span
                      className="fr-cli-col-notes"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="fr-cli-notes-toggle fr-notes-down-arrow"
                        onClick={() =>
                          setExpandedNoteRowKey((k) =>
                            k === rowKey ? null : rowKey
                          )
                        }
                        aria-expanded={notesExpanded}
                        aria-label={t('fileResourcesWorkspace.columnNotes')}
                      >
                        {notesExpanded ? '\u2190' : '\u2192'}
                      </button>
                    </span>
                  </div>
                  {notesExpanded && (
                    <div className="fr-cli-notes-expanded-row">
                      <textarea
                        className="fr-notes-edit"
                        value={fileNotes[rowKey] ?? ''}
                        onChange={(e) =>
                          setFileNotes((prev) => ({
                            ...prev,
                            [rowKey]: e.target.value,
                          }))
                        }
                        onBlur={() =>
                          handleSaveNote(rowKey, row.path, fileNotes[rowKey] ?? '')
                        }
                        placeholder={t('fileResourcesWorkspace.noNotes')}
                        rows={3}
                        aria-label={t('fileResourcesWorkspace.columnNotes')}
                      />
                      {(fileNotes[rowKey] ?? '').trim() ? (
                        <div className="fr-notes-preview">
                          <ReactMarkdown>{fileNotes[rowKey] ?? ''}</ReactMarkdown>
                        </div>
                      ) : null}
                      {savingNoteRowKey === rowKey && (
                        <span className="fr-notes-saving">{t('common.saving')}</span>
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div className="fr-cli-line fr-cli-empty">
            {t('fileResourcesWorkspace.noFilesInMount')}
          </div>
        )}
      </div>
      <div className="fr-description-collapse">
        <button
          type="button"
          className="fr-description-collapse-header"
          onClick={() => setDescriptionExpanded((e) => !e)}
          aria-expanded={descriptionExpanded}
          aria-controls="fr-description-body"
        >
          <span className="fr-description-collapse-chevron">
            {descriptionExpanded ? '\u2190' : '\u2192'}
          </span>
          {t('fileResourcesWorkspace.descriptionNotes')}
        </button>
        <div
          id="fr-description-body"
          className={`fr-description-collapse-body ${descriptionExpanded ? 'expanded' : ''}`}
          hidden={!descriptionExpanded}
        >
          <div className="fr-mount-meta">
            <div className="fr-mount-meta-row">
              <span className="fr-mount-label">{t('fileResourcesWorkspace.path')}</span>
              <Tooltip title={selectedMp.path}>
                <span className="fr-mount-value">{selectedMp.path}</span>
              </Tooltip>
            </div>
            {selectedMp.name && (
              <div className="fr-mount-meta-row">
                <span className="fr-mount-label">
                  {t('fileResourcesWorkspace.displayName')}
                </span>
                <span className="fr-mount-value">{selectedMp.name}</span>
              </div>
            )}
          </div>
          <label className="fr-description-label" htmlFor="fr-edit-description">
            {t('fileResourcesWorkspace.description')}
          </label>
          <textarea
            id="fr-edit-description"
            className="fr-description-textarea"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder={t('fileResourcesWorkspace.descriptionPlaceholder')}
            rows={2}
            aria-label={t('fileResourcesWorkspace.description')}
          />
          <div className="fr-description-actions">
            <button
              type="button"
              className="fr-btn fr-btn-neutral"
              onClick={onSaveDescription}
              disabled={savingDesc}
            >
              {savingDesc ? t('common.saving') : t('common.save')}
            </button>
            {removeError && (
              <div className="fr-remove-error" role="alert">
                {removeError}
              </div>
            )}
            <button
              type="button"
              className="fr-btn fr-btn-danger"
              onClick={() => onRemoveMountPoint()}
              disabled={removing}
            >
              {removing
                ? t('common.removing')
                : t('fileResourcesWorkspace.removeMountPoint')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
