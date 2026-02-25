import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import Tooltip from '../Tooltip';
import { highlightKeywords } from '../../utils/dataCenterUtils';
import type { KnowledgePoint } from '../../services/api';

const KB_KEYWORD_HIGHLIGHT_CLASS = 'kb-kp-keyword-highlight';

export interface KnowledgeBaseWorkspaceKpPanelProps {
  rootRef?: React.RefObject<HTMLDivElement | null>;
  knowledgePoints: KnowledgePoint[];
  kpPage: number;
  kpTotalPages: number;
  setKpPage: React.Dispatch<React.SetStateAction<number>>;
  selectedKp: KnowledgePoint | null;
  setSelectedKp: React.Dispatch<React.SetStateAction<KnowledgePoint | null>>;
  kpWeightDragging: { kpId: number; value: number } | null;
  handleKpWeightMouseDown: (kp: KnowledgePoint, currentWeight: number, e: React.MouseEvent) => void;
  onKpWeightChange: (kp: KnowledgePoint, weight: number) => void;
  deletedKpIds: Set<number>;
  onKpDelete: (kp: KnowledgePoint, e: React.MouseEvent) => void;
  onKpRestore: (kp: KnowledgePoint, e: React.MouseEvent) => void;
  highlightedKeywords: string[];
  loadKeywords: (kpId: number) => void;
  handleKpContentMouseUp: () => void;
  removeHighlightedKeyword: (index: number) => void;
  selectedDocId: number | null;
  lowerVisible: boolean;
  onOpenPreview: () => void;
  kpListHeight: number | null;
  kpTopPanelRef: React.RefObject<HTMLDivElement | null>;
  onResizeKpVerticalStart: (e: React.MouseEvent) => void;
}

export const KnowledgeBaseWorkspaceKpPanel: React.FC<KnowledgeBaseWorkspaceKpPanelProps> = ({
  rootRef,
  knowledgePoints,
  kpPage,
  kpTotalPages,
  setKpPage,
  selectedKp,
  setSelectedKp,
  kpWeightDragging,
  handleKpWeightMouseDown,
  onKpWeightChange,
  deletedKpIds,
  onKpDelete,
  onKpRestore,
  highlightedKeywords,
  loadKeywords,
  handleKpContentMouseUp,
  removeHighlightedKeyword,
  selectedDocId,
  lowerVisible,
  onOpenPreview,
  kpListHeight,
  kpTopPanelRef,
  onResizeKpVerticalStart,
}) => {
  const { t } = useTranslation();

  const renderHighlight = (content: string, keywords: string[]) =>
    highlightKeywords(content, keywords, KB_KEYWORD_HIGHLIGHT_CLASS);

  return (
    <div className="kb-upper-left-right" ref={rootRef} data-testid="kb-upper-left-right">
      <div
        ref={kpTopPanelRef}
        className="kb-upper-left-right-top kb-cli-panel"
        style={
          kpListHeight != null ? { height: kpListHeight, flex: '0 0 auto' } : undefined
        }
      >
        <div className="kb-kp-list-title-bar">
          <span className="kb-kp-list-title">{t('knowledgeBaseWorkspace.knowledgePointList')}</span>
          {selectedDocId != null && lowerVisible !== true && (
            <Tooltip title={t('knowledgeBaseWorkspace.documentPreview')}>
              <button
                type="button"
                className="kb-kp-preview-icon-btn"
                onClick={onOpenPreview}
                aria-label={t('knowledgeBaseWorkspace.documentPreview')}
              >
                <FileText size={16} aria-hidden />
              </button>
            </Tooltip>
          )}
        </div>
        {selectedDocId == null ? (
          <p className="kb-placeholder">{t('knowledgeBaseWorkspace.selectFileFirst')}</p>
        ) : knowledgePoints.length === 0 && kpTotalPages === 0 ? (
          <p className="kb-placeholder">{t('knowledgeBaseWorkspace.noKnowledgePointsForFile')}</p>
        ) : (
          <>
            <div
              className="kb-kp-table-wrap"
              role="listbox"
              aria-label={t('knowledgeBaseWorkspace.selectedDocKnowledgePoints')}
            >
              <div className="kb-kp-table-header">
                <span className="kb-kp-col-state" aria-hidden="true" />
                <span className="kb-kp-col-content">{t('knowledgeBaseWorkspace.columnName')}</span>
                <span className="kb-kp-col-weight">{t('knowledgeBaseWorkspace.weight')}</span>
                <span className="kb-kp-col-action" aria-hidden="true" />
              </div>
              <ul className="kb-kp-list">
                {knowledgePoints.map((kp, idx) => {
                  const baseWeight = Math.max(1, Math.min(5, Math.round(kp.weight ?? 1)));
                  const weight =
                    kpWeightDragging && kpWeightDragging.kpId === kp.id
                      ? kpWeightDragging.value
                      : baseWeight;
                  const isSelected = selectedKp === kp;
                  const isDeleted =
                    kp.excluded || (kp.id != null && deletedKpIds.has(kp.id));
                  const contentText = (kp.content || '').trim();
                  return (
                    <li
                      key={kp.id ?? `kp-${kp.document_id}-${kp.chunk_index}-${idx}`}
                      className={`kb-kp-item ${isSelected ? 'kb-kp-item-selected' : ''} ${isDeleted ? 'kb-kp-item-deleted' : ''}`}
                      role="option"
                      aria-selected={isSelected}
                      aria-label={isDeleted ? t('knowledgeBaseWorkspace.deletedState') : undefined}
                      onClick={() => {
                        setSelectedKp(isSelected ? null : kp);
                        if (!isSelected && kp?.id != null) loadKeywords(kp.id);
                      }}
                    >
                      <Tooltip title={t('knowledgeBaseWorkspace.setWeight')}>
                        <span
                          className="kb-kp-col-state"
                          aria-label={t('knowledgeBaseWorkspace.setWeight')}
                        >
                          {isDeleted ? '\u2717' : '\u22EE'}
                        </span>
                      </Tooltip>
                      <Tooltip
                        title={
                          isDeleted
                            ? `[${t('knowledgeBaseWorkspace.deletedState')}] ${kp.content}`
                            : (kp.content || '')
                        }
                      >
                        <span
                          className={`kb-kp-col-content kb-kp-item-preview kb-kp-weight-${Math.min(5, Math.max(1, weight))}`}
                        >
                          {isDeleted ? `[${t('knowledgeBaseWorkspace.deletedState')}] ` : ''}
                          {contentText}
                        </span>
                      </Tooltip>
                      <span
                        className="kb-kp-col-weight kb-kp-weight-slider"
                        onClick={(e) => e.stopPropagation()}
                        role="slider"
                        aria-valuemin={1}
                        aria-valuemax={5}
                        aria-valuenow={weight}
                        aria-label={t('knowledgeBaseWorkspace.weight')}
                        onMouseDown={(e) =>
                          kp.id != null && handleKpWeightMouseDown(kp, weight, e)
                        }
                      >
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Tooltip key={s} title={`${t('knowledgeBaseWorkspace.setWeight')} ${s}`}>
                            <span
                              role="button"
                              tabIndex={0}
                              className={`kb-kp-star ${s <= weight ? 'filled' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (kp.id != null) onKpWeightChange(kp, s);
                              }}
                              onKeyDown={(e) => {
                                if (
                                  (e.key === 'Enter' || e.key === ' ') &&
                                  kp.id != null
                                ) {
                                  e.preventDefault();
                                  onKpWeightChange(kp, s);
                                }
                              }}
                              aria-pressed={s <= weight}
                            >
                              {s <= weight ? '\u2605' : '\u2606'}
                            </span>
                          </Tooltip>
                        ))}
                      </span>
                      <span className="kb-kp-col-action" onClick={(e) => e.stopPropagation()}>
                        {kp.id != null && (
                          <Tooltip
                            title={
                              isDeleted
                                ? t('knowledgeBaseWorkspace.restore')
                                : t('knowledgeBaseWorkspace.deleteSelected')
                            }
                          >
                            <button
                              type="button"
                              className="kb-kp-action-btn"
                              onClick={(e) =>
                                isDeleted ? onKpRestore(kp, e) : onKpDelete(kp, e)
                              }
                              aria-label={
                                isDeleted
                                  ? t('knowledgeBaseWorkspace.restore')
                                  : t('knowledgeBaseWorkspace.deleteSelected')
                              }
                            >
                              {isDeleted ? '\u21BB' : '\u00D7'}
                            </button>
                          </Tooltip>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            {kpTotalPages > 1 && (
              <div className="kb-kp-pagination">
                <button
                  type="button"
                  className="kb-kp-pagination-btn"
                  disabled={kpPage <= 1}
                  onClick={() => setKpPage((p) => Math.max(1, p - 1))}
                  aria-label={t('knowledgeBaseWorkspace.prevPage')}
                >
                  {t('knowledgeBaseWorkspace.prevPage')}
                </button>
                <span className="kb-kp-pagination-info">
                  {t('knowledgeBaseWorkspace.pageOf', { page: kpPage, total: kpTotalPages })}
                </span>
                <button
                  type="button"
                  className="kb-kp-pagination-btn"
                  disabled={kpPage >= kpTotalPages}
                  onClick={() => setKpPage((p) => Math.min(kpTotalPages, p + 1))}
                  aria-label={t('knowledgeBaseWorkspace.nextPage')}
                >
                  {t('knowledgeBaseWorkspace.nextPage')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <div
        className="kb-resize-handle-v"
        role="separator"
        aria-label="Resize knowledge point list and detail"
        onMouseDown={onResizeKpVerticalStart}
      />
      <div
        className="kb-upper-left-right-bottom"
        style={
          kpListHeight != null ? { flex: 1, minHeight: 100 } : undefined
        }
      >
        {selectedKp == null ? (
          <p className="kb-placeholder">{t('knowledgeBaseWorkspace.selectKpForDetail')}</p>
        ) : (
          <div className="kb-kp-detail-wrap">
            <div className="kb-kp-detail-left kb-cli-panel">
              <div className="kb-kp-detail-meta">
                {selectedKp.document_name && (
                  <span className="kb-kp-detail-source">
                    {t('knowledgeBaseWorkspace.source')}: {selectedKp.document_name}
                  </span>
                )}
                {selectedKp.chunk_index != null && (
                  <span className="kb-kp-detail-chunk">
                    {t('knowledgeBaseWorkspace.chunk')}: {selectedKp.chunk_index + 1}
                  </span>
                )}
              </div>
              <div
                className="kb-kp-detail-content"
                role="article"
                onMouseUp={handleKpContentMouseUp}
              >
                {renderHighlight(selectedKp.content || '', highlightedKeywords)}
              </div>
            </div>
            <div className="kb-kp-detail-right kb-cli-panel">
              <div className="kb-kp-detail-keywords-title kb-cli-title">
                {t('knowledgeBaseWorkspace.knowledgePointKeywordList')}
              </div>
              {highlightedKeywords.length === 0 ? (
                <p className="kb-kp-detail-keywords-empty">
                  {t('knowledgeBaseWorkspace.noKeywordsYet')}
                </p>
              ) : (
                <ul className="kb-kp-detail-keywords-list" role="list">
                  {highlightedKeywords.map((kw, idx) => (
                    <li key={`${idx}-${kw.slice(0, 20)}`} className="kb-kp-detail-keyword">
                      <Tooltip title={kw}>
                        <span className="kb-kp-detail-keyword-text">{kw}</span>
                      </Tooltip>
                      <button
                        type="button"
                        className="kb-kp-detail-keyword-remove"
                        onClick={() => removeHighlightedKeyword(idx)}
                        aria-label={t('common.remove')}
                      >
                        &#215;
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
