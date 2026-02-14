import React from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../Tooltip';
import type { Document, DirectoryNode } from '../../services/api';
import type { FileMetaItem } from '../../utils/fileMeta';

export interface DataCenterFileListProps {
  displayItems: DirectoryNode[];
  documents: Document[];
  getMeta: (docId: number) => FileMetaItem;
  isExcluded: (item: DirectoryNode) => boolean;
  updateMeta: (docId: number, patch: Partial<FileMetaItem>) => void;
  fileWeightDragging: { docId: number; value: number } | null;
  expandedNoteDocId: number | null;
  setExpandedNoteDocId: React.Dispatch<React.SetStateAction<number | null>>;
  addTagDocId: number | null;
  setAddTagDocId: React.Dispatch<React.SetStateAction<number | null>>;
  addTagInput: string;
  setAddTagInput: React.Dispatch<React.SetStateAction<string>>;
  selectedDocId: number | null;
  setSelectedDocId: React.Dispatch<React.SetStateAction<number | null>>;
  setCurrentDirId: React.Dispatch<React.SetStateAction<number | null>>;
  deletingDocId: number | null;
  onFileWeightMouseDown: (docId: number, currentWeight: number, e: React.MouseEvent) => void;
  onSetExcluded: (item: DirectoryNode, excluded: boolean, e: React.MouseEvent) => void;
  onDeleteClick: (docId: number, filename: string, e: React.MouseEvent) => void;
  searchQuery: string;
}

const DataCenterFileList: React.FC<DataCenterFileListProps> = ({
  displayItems,
  documents,
  getMeta,
  isExcluded,
  updateMeta,
  fileWeightDragging,
  expandedNoteDocId,
  setExpandedNoteDocId,
  addTagDocId,
  setAddTagDocId,
  addTagInput,
  setAddTagInput,
  selectedDocId,
  setSelectedDocId,
  setCurrentDirId,
  deletingDocId,
  onFileWeightMouseDown,
  onSetExcluded,
  onDeleteClick,
  searchQuery,
}) => {
  const { t } = useTranslation();

  return (
    <div className="dc-cli-file-table-wrap" role="listbox" aria-label={t('dataCenter.filesAndFolders')}>
      {displayItems.length === 0 ? (
        <div className="dc-cli-file-row dc-cli-empty">
          {searchQuery.trim() ? t('dataCenter.noSearchResults') : t('dataCenter.emptyFolder')}
        </div>
      ) : (
        <>
          <div className="dc-cli-file-table-header">
            <span className="dc-cli-col-processed" aria-hidden="true" />
            <span className="dc-cli-col-filename">{t('fileResourcesWorkspace.columnFileName')}</span>
            <span className="dc-cli-col-weight">{t('fileResourcesWorkspace.columnWeight')}</span>
            <span className="dc-cli-col-notes" aria-hidden="true" />
          </div>
          {displayItems.map((item) => {
            const doc = documents.find((d) => d.id === item.id);
            const status = doc?.processingStatus ?? (item.processed ? 'completed' : 'pending');
            const isFile = item.type === 'file';
            const meta: FileMetaItem = isFile ? getMeta(item.id) : { weight: 0, note: '', tags: [], excluded: false };
            const baseWeight = Math.min(5, Math.max(0, meta.weight));
            const weight = fileWeightDragging?.docId === item.id ? fileWeightDragging.value : baseWeight;
            const noteExpanded = expandedNoteDocId === item.id;
            const addingTag = addTagDocId === item.id;
            const isSelected = isFile && selectedDocId === item.id;
            const excluded = isExcluded(item);
            return (
              <React.Fragment key={`${item.type}-${item.id}`}>
                <div
                  className={`dc-cli-file-row ${isSelected ? 'dc-cli-file-row-selected' : ''} ${excluded ? 'dc-cli-file-row-deleted' : ''}`}
                  onClick={() => {
                    if (isFile) setSelectedDocId(selectedDocId === item.id ? null : item.id);
                    else setCurrentDirId(item.id);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (isFile) setSelectedDocId(selectedDocId === item.id ? null : item.id);
                      else setCurrentDirId(item.id);
                    }
                  }}
                  aria-pressed={isSelected}
                >
                  {isFile ? (
                    item.processed ? (
                      <Tooltip title={t('knowledgeBaseWorkspace.fileProcessedBadge')}>
                        <span className="dc-cli-col-processed" aria-label={t('knowledgeBaseWorkspace.fileProcessedBadge')}>
                          <span className="dc-file-badge">&#10003;</span>
                        </span>
                      </Tooltip>
                    ) : (
                      <span className="dc-cli-col-processed" aria-hidden> </span>
                    )
                  ) : (
                    <span className="dc-cli-col-processed" aria-hidden> </span>
                  )}
                  <Tooltip title={item.name}>
                    <span className={`dc-cli-col-filename dc-file-weight-${isFile ? weight : 0}`}>
                      <span className="dc-file-name">{item.name}</span>
                    </span>
                  </Tooltip>
                  {isFile ? (
                    <span
                      className="dc-cli-col-weight dc-weight-slider"
                      onClick={(e) => e.stopPropagation()}
                      role="group"
                      aria-label={t('knowledgeBaseWorkspace.weight')}
                      onMouseDown={(e) => onFileWeightMouseDown(item.id, weight, e)}
                    >
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Tooltip key={s} title={`${t('knowledgeBaseWorkspace.setWeight')} ${s}`}>
                          <span
                            role="button"
                            tabIndex={0}
                            className={`dc-star ${s <= weight ? 'filled' : ''}`}
                            onClick={() => updateMeta(item.id, { weight: s })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                updateMeta(item.id, { weight: s });
                              }
                            }}
                            aria-pressed={s <= weight}
                          >
                            {s <= weight ? '\u2605' : '\u2606'}
                          </span>
                        </Tooltip>
                      ))}
                    </span>
                  ) : (
                    <span className="dc-cli-col-weight" aria-hidden> </span>
                  )}
                  <span className="dc-cli-col-notes" onClick={(e) => e.stopPropagation()}>
                    {isFile ? (
                      <>
                        <Tooltip title={t('knowledgeBaseWorkspace.note')}>
                          <button
                            type="button"
                            className={`dc-cli-notes-toggle ${meta.note.trim() ? 'dc-notes-has' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedNoteDocId((id) => (id === item.id ? null : item.id));
                            }}
                            aria-expanded={noteExpanded}
                            aria-label={t('knowledgeBaseWorkspace.note')}
                          >
                            {noteExpanded ? '\u2190' : '\u2192'}
                          </button>
                        </Tooltip>
                        <span className="dc-file-item-tags">
                          {meta.tags.map((tag) => (
                            <span key={tag} className="dc-file-tag">
                              {tag}
                              <button
                                type="button"
                                className="dc-file-tag-remove"
                                onClick={() => updateMeta(item.id, { tags: meta.tags.filter((x) => x !== tag) })}
                                aria-label={t('knowledgeBaseWorkspace.removeTag')}
                              >
                                &#215;
                              </button>
                            </span>
                          ))}
                          {addingTag ? (
                            <input
                              type="text"
                              className="dc-file-tag-input"
                              value={addTagInput}
                              onChange={(e) => setAddTagInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const v = addTagInput.trim();
                                  if (v && !meta.tags.includes(v)) {
                                    updateMeta(item.id, { tags: [...meta.tags, v] });
                                    setAddTagInput('');
                                    setAddTagDocId(null);
                                  }
                                }
                                if (e.key === 'Escape') {
                                  setAddTagInput('');
                                  setAddTagDocId(null);
                                }
                              }}
                              onBlur={() => {
                                const v = addTagInput.trim();
                                if (v && !meta.tags.includes(v)) {
                                  updateMeta(item.id, { tags: [...meta.tags, v] });
                                }
                                setAddTagInput('');
                                setAddTagDocId(null);
                              }}
                              placeholder={t('knowledgeBaseWorkspace.tagPlaceholder')}
                              autoFocus
                            />
                          ) : (
                            <Tooltip title={t('knowledgeBaseWorkspace.addTag')}>
                              <button
                                type="button"
                                className="dc-file-tag-add"
                                onClick={() => {
                                  setAddTagDocId(item.id);
                                  setAddTagInput('');
                                }}
                              >
                                +
                              </button>
                            </Tooltip>
                          )}
                        </span>
                      </>
                    ) : null}
                    {excluded ? (
                      <Tooltip title={t('knowledgeBaseWorkspace.restore')}>
                        <button
                          type="button"
                          className="dc-action-btn"
                          onClick={(e) => onSetExcluded(item, false, e)}
                          aria-label={t('knowledgeBaseWorkspace.restore')}
                        >
                          &#8635;
                        </button>
                      </Tooltip>
                    ) : (
                      <Tooltip title={isFile ? t('dataCenter.delete') : t('knowledgeBaseWorkspace.deleteSelected')}>
                        <button
                          type="button"
                          className="dc-action-btn"
                          disabled={(isFile && status === 'processing') || (isFile && deletingDocId === item.id)}
                          onClick={(e) => {
                            if (isFile) {
                              onDeleteClick(item.id, item.name, e);
                            } else {
                              onSetExcluded(item, true, e);
                            }
                          }}
                          aria-label={isFile ? t('dataCenter.delete') : t('knowledgeBaseWorkspace.deleteSelected')}
                        >
                          {isFile && deletingDocId === item.id ? '...' : '×'}
                        </button>
                      </Tooltip>
                    )}
                  </span>
                </div>
                {isFile && noteExpanded && (
                  <div className="dc-cli-notes-expanded-row" onClick={(e) => e.stopPropagation()}>
                    <textarea
                      className="dc-file-note-input"
                      value={meta.note}
                      onChange={(e) => updateMeta(item.id, { note: e.target.value })}
                      placeholder={t('knowledgeBaseWorkspace.notePlaceholder')}
                      rows={2}
                      aria-label={t('knowledgeBaseWorkspace.note')}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </>
      )}
    </div>
  );
};

export default DataCenterFileList;
