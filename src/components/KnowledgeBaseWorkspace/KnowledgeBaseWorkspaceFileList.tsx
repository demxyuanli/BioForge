import React from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../Tooltip';
import type { FileMetaItem } from '../../utils/fileMeta';
import type { FulltextSearchHit } from '../../services/api';

export interface KnowledgeBaseWorkspaceFileListProps {
  displayFileList: Array<{
    id: number;
    name: string;
    type: 'file';
    processed?: boolean;
    knowledgePointCount?: number;
  }>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  contentSearching: boolean;
  contentSearchError: string | null;
  contentSearchResults: FulltextSearchHit[];
  onContentSearch: () => void;
  onContentSearchResultClick: (hit: FulltextSearchHit) => void;
  getMeta: (docId: number) => FileMetaItem;
  updateMeta: (docId: number, patch: Partial<FileMetaItem>) => void;
  expandedNoteDocId: number | null;
  setExpandedNoteDocId: React.Dispatch<React.SetStateAction<number | null>>;
  addTagDocId: number | null;
  setAddTagDocId: React.Dispatch<React.SetStateAction<number | null>>;
  addTagInput: string;
  setAddTagInput: React.Dispatch<React.SetStateAction<string>>;
  selectedDocId: number | null;
  onSelectFile: (id: number) => void;
}

export const KnowledgeBaseWorkspaceFileList: React.FC<KnowledgeBaseWorkspaceFileListProps> = ({
  displayFileList,
  searchQuery,
  setSearchQuery,
  contentSearching,
  contentSearchError,
  contentSearchResults,
  onContentSearch,
  onContentSearchResultClick,
  getMeta,
  updateMeta,
  expandedNoteDocId,
  setExpandedNoteDocId,
  addTagDocId,
  setAddTagDocId,
  addTagInput,
  setAddTagInput,
  selectedDocId,
  onSelectFile,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="kb-filelist-search kb-content-search-row">
        <input
          type="text"
          className="kb-search-input"
          placeholder={t('dataCenter.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onContentSearch()}
          aria-label={t('dataCenter.searchPlaceholder')}
        />
        <button
          type="button"
          className="kb-btn kb-btn-small"
          onClick={onContentSearch}
          disabled={contentSearching || !searchQuery.trim()}
        >
          {contentSearching ? '...' : t('dataCenter.searchInContent')}
        </button>
      </div>
      {contentSearchError && (
        <div className="kb-content-search-error">{contentSearchError}</div>
      )}
      {contentSearchResults.length > 0 && (
        <div className="kb-content-search-results">
          <div className="kb-content-search-results-header">
            {t('dataCenter.contentSearchResults', { count: contentSearchResults.length })}
          </div>
          <ul className="kb-content-search-results-list">
            {contentSearchResults.map((hit, idx) => (
              <li key={`${hit.document_id}-${hit.knowledge_point_id}-${idx}`}>
                <button
                  type="button"
                  className="kb-content-search-result-item"
                  onClick={() => onContentSearchResultClick(hit)}
                >
                  <span className="kb-content-search-filename">{hit.filename || ''}</span>
                  <span
                    className="kb-content-search-snippet"
                    dangerouslySetInnerHTML={{ __html: hit.snippet || '' }}
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div
        className="kb-cli-file-table-wrap"
        role="listbox"
        aria-label={t('knowledgeBaseWorkspace.documentList')}
      >
        {displayFileList.length === 0 ? (
          <div className="kb-cli-line kb-cli-empty">
            {searchQuery.trim()
              ? t('knowledgeBaseWorkspace.noResults')
              : t('knowledgeBaseWorkspace.emptyDirectory')}
          </div>
        ) : (
          <>
            <div className="kb-cli-file-table-header">
              <span className="kb-cli-col-processed" aria-hidden="true" />
              <span className="kb-cli-col-filename">{t('fileResourcesWorkspace.columnFileName')}</span>
              <span className="kb-cli-col-weight">{t('fileResourcesWorkspace.columnWeight')}</span>
              <span className="kb-cli-col-notes" aria-hidden="true" />
            </div>
            {displayFileList.map((item) => {
              const meta = getMeta(item.id);
              const weight = Math.min(5, Math.max(0, meta.weight));
              const noteExpanded = expandedNoteDocId === item.id;
              const addingTag = addTagDocId === item.id;
              const isSelected = selectedDocId === item.id;
              return (
                <React.Fragment key={item.id}>
                  <div
                    className={`kb-cli-file-row ${isSelected ? 'kb-cli-file-row-selected' : ''}`}
                    onClick={() => onSelectFile(item.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectFile(item.id);
                      }
                    }}
                    aria-pressed={isSelected}
                  >
                    {item.processed ? (
                      <Tooltip title={t('knowledgeBaseWorkspace.fileProcessedBadge')}>
                        <span
                          className="kb-cli-col-processed"
                          aria-label={t('knowledgeBaseWorkspace.fileProcessedBadge')}
                        >
                          <span className="kb-file-badge">&#10003;</span>
                        </span>
                      </Tooltip>
                    ) : (
                      <span className="kb-cli-col-processed" aria-hidden>
                        {' '}
                      </span>
                    )}
                    <Tooltip title={item.name}>
                      <span className={`kb-cli-col-filename kb-file-weight-${weight}`}>
                        <span className="kb-file-name">{item.name}</span>
                        {typeof item.knowledgePointCount === 'number' &&
                          item.knowledgePointCount > 0 && (
                            <span className="kb-file-kp-count">{item.knowledgePointCount}</span>
                          )}
                      </span>
                    </Tooltip>
                    <span
                      className="kb-cli-col-weight"
                      onClick={(e) => e.stopPropagation()}
                      role="group"
                      aria-label={t('knowledgeBaseWorkspace.weight')}
                    >
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Tooltip key={s} title={`${t('knowledgeBaseWorkspace.setWeight')} ${s}`}>
                          <span
                            role="button"
                            tabIndex={0}
                            className={`kb-star ${s <= weight ? 'filled' : ''}`}
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
                    <span className="kb-cli-col-notes" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title={t('knowledgeBaseWorkspace.note')}>
                        <button
                          type="button"
                          className={`kb-cli-notes-toggle ${meta.note.trim() ? 'kb-notes-has' : ''}`}
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
                      <span className="kb-file-item-tags">
                        {meta.tags.map((tag) => (
                          <span key={tag} className="kb-file-tag">
                            {tag}
                            <button
                              type="button"
                              className="kb-file-tag-remove"
                              onClick={() =>
                                updateMeta(item.id, {
                                  tags: meta.tags.filter((x) => x !== tag),
                                })
                              }
                              aria-label={t('knowledgeBaseWorkspace.removeTag')}
                            >
                              &#215;
                            </button>
                          </span>
                        ))}
                        {addingTag ? (
                          <input
                            type="text"
                            className="kb-file-tag-input"
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
                              className="kb-file-tag-add"
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
                    </span>
                  </div>
                  {noteExpanded && (
                    <div
                      className="kb-cli-notes-expanded-row"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <textarea
                        className="kb-file-note-input"
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
    </>
  );
};
