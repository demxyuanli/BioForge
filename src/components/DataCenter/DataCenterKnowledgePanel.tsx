import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, List, Network } from 'lucide-react';
import Tooltip from '../Tooltip';
import KnowledgeGraph from '../KnowledgeGraph';
import type { Document, KnowledgePoint } from '../../services/api';
import { KP_DETAIL_MIN_HEIGHT } from '../../hooks/useDataCenterLayout';

export interface DataCenterKnowledgePanelProps {
  upperLeftRightRef: React.RefObject<HTMLDivElement | null>;
  kpTopPanelRef: React.RefObject<HTMLDivElement | null>;
  kpListHeight: number | null;
  selectedDoc: Document | null | undefined;
  selectedDocId: number | null;
  kpTotal: number;
  kpViewMode: 'list' | 'graph';
  setKpViewMode: React.Dispatch<React.SetStateAction<'list' | 'graph'>>;
  knowledgePoints: KnowledgePoint[];
  kpPage: number;
  kpTotalPages: number;
  setKpPage: React.Dispatch<React.SetStateAction<number>>;
  selectedKp: KnowledgePoint | null;
  highlightedKeywords: string[];
  selectionToolbar: { visible: boolean; x: number; y: number; text: string } | null;
  deletedKpIds: Set<number>;
  kpWeightDragging: { kpId: number; value: number } | null;
  lowerVisible: boolean;
  onOpenPreview: () => void;
  onResizeKpVerticalStart: (e: React.MouseEvent) => void;
  onSelectKnowledgePoint: (kp: KnowledgePoint) => void;
  onKpWeightMouseDown: (kp: KnowledgePoint, currentWeight: number, e: React.MouseEvent) => void;
  onKpWeightChange: (kp: KnowledgePoint, weight: number) => void;
  onKpDelete: (kp: KnowledgePoint, e: React.MouseEvent) => void;
  onKpRestore: (kp: KnowledgePoint, e: React.MouseEvent) => void;
  onKpContentMouseUp: (e: React.MouseEvent) => void;
  onAddKeyword: () => void;
  onRemoveKeyword: (keyword: string) => void;
  highlightKeywords: (content: string, keywords: string[]) => React.ReactNode;
  kpDetailContentRef: React.RefObject<HTMLDivElement | null>;
}

const DataCenterKnowledgePanel: React.FC<DataCenterKnowledgePanelProps> = ({
  upperLeftRightRef,
  kpTopPanelRef,
  kpListHeight,
  selectedDoc,
  selectedDocId,
  kpTotal,
  kpViewMode,
  setKpViewMode,
  knowledgePoints,
  kpPage,
  kpTotalPages,
  setKpPage,
  selectedKp,
  highlightedKeywords,
  selectionToolbar,
  deletedKpIds,
  kpWeightDragging,
  lowerVisible,
  onOpenPreview,
  onResizeKpVerticalStart,
  onSelectKnowledgePoint,
  onKpWeightMouseDown,
  onKpWeightChange,
  onKpDelete,
  onKpRestore,
  onKpContentMouseUp,
  onAddKeyword,
  onRemoveKeyword,
  highlightKeywords,
  kpDetailContentRef,
}) => {
  const { t } = useTranslation();

  return (
    <div className="dc-upper-left-right" ref={upperLeftRightRef}>
      <div
        ref={kpTopPanelRef}
        className="dc-upper-left-right-top dc-cli-panel"
        style={
          kpListHeight != null
            ? { height: kpListHeight, flex: '0 0 auto' }
            : undefined
        }
      >
        <div className="dc-kp-list-title-bar">
          <span className="dc-kp-list-title">
            {selectedDoc
              ? `${t('dataCenter.knowledgePointsList')} (${kpTotal})`
              : t('dataCenter.selectDocumentForKp')}
          </span>
          <div className="dc-kp-view-toggle" role="tablist" aria-label={t('knowledgeGraph.viewMode')}>
            <Tooltip title={t('knowledgeGraph.listView')}>
              <button
                type="button"
                role="tab"
                aria-selected={kpViewMode === 'list'}
                aria-label={t('knowledgeGraph.listView')}
                className={kpViewMode === 'list' ? 'dc-kp-view-tab active' : 'dc-kp-view-tab'}
                onClick={() => setKpViewMode('list')}
              >
                <List size={15} aria-hidden />
              </button>
            </Tooltip>
            <Tooltip title={t('knowledgeGraph.graphView')}>
              <button
                type="button"
                role="tab"
                aria-selected={kpViewMode === 'graph'}
                aria-label={t('knowledgeGraph.graphView')}
                className={kpViewMode === 'graph' ? 'dc-kp-view-tab active' : 'dc-kp-view-tab'}
                onClick={() => setKpViewMode('graph')}
              >
                <Network size={15} aria-hidden />
              </button>
            </Tooltip>
          </div>
          {selectedDocId != null && !lowerVisible && kpViewMode === 'list' && (
            <Tooltip title={t('knowledgeBaseWorkspace.documentPreview')}>
              <button
                type="button"
                className="dc-kp-preview-icon-btn"
                onClick={onOpenPreview}
                aria-label={t('knowledgeBaseWorkspace.documentPreview')}
              >
                <FileText size={16} aria-hidden />
              </button>
            </Tooltip>
          )}
        </div>
        {kpViewMode === 'graph' ? (
          <div className="dc-kp-graph-wrap">
            <KnowledgeGraph
              selectedKnowledgePointId={selectedKp?.id ?? null}
              onSelectKnowledgePoint={onSelectKnowledgePoint}
            />
          </div>
        ) : selectedDocId == null ? (
          <p className="dc-placeholder">{t('dataCenter.selectDocumentFirst')}</p>
        ) : knowledgePoints.length === 0 && kpTotal === 0 ? (
          <p className="dc-placeholder">{t('knowledgeBaseWorkspace.noKnowledgePointsForFile')}</p>
        ) : (
          <>
            <div className="dc-kp-table-wrap" role="listbox" aria-label={t('knowledgeBaseWorkspace.selectedDocKnowledgePoints')}>
              <div className="dc-kp-table-header">
                <span className="dc-kp-col-state" aria-hidden="true" />
                <span className="dc-kp-col-content">{t('knowledgeBaseWorkspace.columnName')}</span>
                <span className="dc-kp-col-weight">{t('knowledgeBaseWorkspace.weight')}</span>
                <span className="dc-kp-col-action" aria-hidden="true" />
              </div>
              <ul className="dc-kp-list">
                {knowledgePoints.length === 0 ? (
                  <li className="dc-kp-item dc-empty">{t('dataCenter.noKnowledgePoints')}</li>
                ) : (
                  knowledgePoints.map((kp, idx) => {
                    const baseWeight = Math.max(1, Math.min(5, Math.round(kp.weight ?? 1)));
                    const weight = (kpWeightDragging && kpWeightDragging.kpId === kp.id) ? kpWeightDragging.value : baseWeight;
                    const isSelected = selectedKp?.id != null && kp.id != null
                      ? selectedKp.id === kp.id
                      : selectedKp === kp;
                    const isDeleted = kp.excluded || (kp.id != null && deletedKpIds.has(kp.id));
                    const contentText = (kp.content || '').trim();
                    return (
                      <li
                        key={kp.id ?? `kp-${kp.document_id}-${kp.chunk_index}-${idx}`}
                        className={`dc-kp-item ${isSelected ? 'dc-kp-item-selected' : ''} ${isDeleted ? 'dc-kp-item-deleted' : ''}`}
                        role="option"
                        aria-selected={isSelected}
                        aria-label={isDeleted ? t('knowledgeBaseWorkspace.deletedState') : undefined}
                        onClick={() => onSelectKnowledgePoint(kp)}
                      >
                        <Tooltip title={t('knowledgeBaseWorkspace.setWeight')}>
                          <span className="dc-kp-col-state" aria-label={t('knowledgeBaseWorkspace.setWeight')}>
                            {isDeleted ? '\u2717' : '\u22EE'}
                          </span>
                        </Tooltip>
                        <Tooltip title={isDeleted ? `[${t('knowledgeBaseWorkspace.deletedState')}] ${kp.content}` : (kp.content || '')}>
                          <span className={`dc-kp-col-content dc-kp-item-preview dc-kp-weight-${Math.min(5, Math.max(1, weight))}`}>
                            {isDeleted ? `[${t('knowledgeBaseWorkspace.deletedState')}] ` : ''}
                            {contentText}
                          </span>
                        </Tooltip>
                        <span
                          className="dc-kp-col-weight dc-kp-weight-slider"
                          onClick={(e) => e.stopPropagation()}
                          role="slider"
                          aria-valuemin={1}
                          aria-valuemax={5}
                          aria-valuenow={weight}
                          aria-label={t('knowledgeBaseWorkspace.weight')}
                          onMouseDown={(e) => kp.id != null && onKpWeightMouseDown(kp, weight, e)}
                        >
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Tooltip key={s} title={`${t('knowledgeBaseWorkspace.setWeight')} ${s}`}>
                              <span
                                role="button"
                                tabIndex={0}
                                className={`dc-kp-star ${s <= weight ? 'filled' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (kp.id != null) onKpWeightChange(kp, s);
                                }}
                                onKeyDown={(e) => {
                                  if ((e.key === 'Enter' || e.key === ' ') && kp.id != null) {
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
                        <span className="dc-kp-col-action" onClick={(e) => e.stopPropagation()}>
                          {kp.id != null && (
                            <Tooltip title={isDeleted ? t('knowledgeBaseWorkspace.restore') : t('knowledgeBaseWorkspace.deleteSelected')}>
                              <button
                                type="button"
                                className="dc-kp-action-btn"
                                onClick={(e) => (isDeleted ? onKpRestore(kp, e) : onKpDelete(kp, e))}
                                aria-label={isDeleted ? t('knowledgeBaseWorkspace.restore') : t('knowledgeBaseWorkspace.deleteSelected')}
                              >
                                {isDeleted ? '\u21BB' : '\u00D7'}
                              </button>
                            </Tooltip>
                          )}
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
            {kpTotalPages > 1 && (
              <div className="dc-kp-pagination">
                <button
                  type="button"
                  className="dc-kp-pagination-btn"
                  disabled={kpPage <= 1}
                  onClick={() => setKpPage((p) => Math.max(1, p - 1))}
                  aria-label={t('knowledgeBaseWorkspace.prevPage')}
                >
                  {t('knowledgeBaseWorkspace.prevPage')}
                </button>
                <span className="dc-kp-pagination-info">
                  {t('dataCenter.pageOf', { page: kpPage, total: kpTotalPages })}
                </span>
                <button
                  type="button"
                  className="dc-kp-pagination-btn"
                  disabled={kpPage >= kpTotalPages}
                  onClick={() => setKpPage((p) => p + 1)}
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
        className="dc-resize-handle-v"
        role="separator"
        aria-label="Resize"
        onMouseDown={onResizeKpVerticalStart}
      />
      <div
        className="dc-upper-left-right-bottom"
        style={
          kpListHeight != null
            ? { flex: 1, minHeight: KP_DETAIL_MIN_HEIGHT }
            : undefined
        }
      >
        {selectedKp == null ? (
          <p className="dc-placeholder">{t('knowledgeBaseWorkspace.selectKpForDetail')}</p>
        ) : (
          <div className="dc-kp-detail-wrap">
            <div className="dc-kp-detail-left dc-cli-panel">
              <div className="dc-kp-detail-meta">
                {selectedKp.document_name && (
                  <span className="dc-kp-detail-source">
                    {t('knowledgeBaseWorkspace.source')}: {selectedKp.document_name}
                  </span>
                )}
                {selectedKp.chunk_index != null && (
                  <span className="dc-kp-detail-chunk">
                    {t('knowledgeBaseWorkspace.chunk')}: {selectedKp.chunk_index + 1}
                  </span>
                )}
              </div>
              <div
                ref={kpDetailContentRef}
                className="dc-kp-detail-content"
                onMouseUp={onKpContentMouseUp}
                role="article"
                style={{ position: 'relative' }}
              >
                {highlightKeywords(selectedKp.content ?? '', highlightedKeywords)}
                {selectionToolbar?.visible && (
                  <div
                    className="dc-selection-toolbar"
                    style={{
                      position: 'absolute',
                      left: `${selectionToolbar.x}px`,
                      top: `${selectionToolbar.y}px`,
                      transform: 'translateX(-50%)'
                    }}
                  >
                    <button
                      type="button"
                      className="dc-selection-toolbar-btn"
                      onClick={onAddKeyword}
                      title={t('knowledgeBaseWorkspace.addKeyword')}
                    >
                      {t('knowledgeBaseWorkspace.addKeyword')}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="dc-kp-detail-right dc-cli-panel">
              <div className="dc-kp-detail-keywords-title dc-cli-title">
                {t('knowledgeBaseWorkspace.knowledgePointKeywordList')}
              </div>
              {highlightedKeywords.length === 0 ? (
                <p className="dc-kp-detail-keywords-empty">
                  {t('knowledgeBaseWorkspace.noKeywordsYet')}
                </p>
              ) : (
                <>
                  <div className="dc-kp-detail-keywords-header">
                    <span className="dc-kp-detail-keywords-col-keyword">
                      {t('knowledgeBaseWorkspace.knowledgePointKeywordList')}
                    </span>
                    <span className="dc-kp-detail-keywords-col-action">
                      {t('common.remove')}
                    </span>
                  </div>
                  <ul className="dc-kp-detail-keywords-list" role="list">
                    {highlightedKeywords.map((kw, i) => (
                      <li key={`${i}-${kw.slice(0, 20)}`} className="dc-kp-detail-keyword">
                        <span className="dc-kp-detail-keyword-text-col">
                          <Tooltip title={kw}>
                            <span className="dc-kp-detail-keyword-text">{kw}</span>
                          </Tooltip>
                        </span>
                        <span className="dc-kp-detail-keyword-action-col">
                          <button
                            type="button"
                            className="dc-kp-detail-keyword-remove"
                            onClick={() => onRemoveKeyword(kw)}
                            aria-label={t('common.remove')}
                          >
                            &#215;
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataCenterKnowledgePanel;
