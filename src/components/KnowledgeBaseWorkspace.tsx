import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getDocuments,
  getKnowledgePoints,
  getTrainingSet,
  createKnowledgePoint,
  type Document,
  type KnowledgePoint,
} from '../services/api';
import './KnowledgeBaseWorkspace.css';

const RECENT_LIMIT = 20;
const KP_PAGE_SIZE = 50;
const BRIEF_LENGTH = 80;
const STAR_FILLED = '\u2605';
const STAR_EMPTY = '\u2606';
const WEIGHT_STARS = 5;

function weightToStars(weight: number | undefined | null): number {
  const w = weight ?? 1;
  return Math.min(WEIGHT_STARS, Math.max(1, Math.round(w)));
}

function renderStars(count: number, filled: number): React.ReactNode {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const isFilled = n <= filled;
    const char = isFilled ? STAR_FILLED : STAR_EMPTY;
    const starClass = isFilled ? 'kb-star-filled' : 'kb-star-empty';
    return <span key={n} className={`kb-star-static ${starClass}`}>{char}</span>;
  });
}

function getLocatedKeywords(content: string, snippets: string[]): string[] {
  const unique = Array.from(new Set(snippets)).filter((s) => s && typeof s === 'string' && s.length > 0);
  return unique.filter((snip) => content.indexOf(snip) >= 0);
}

function highlightAnnotationSpans(
  content: string,
  snippets: string[],
  weightStars: number
): React.ReactNode {
  const unique = Array.from(new Set(snippets)).filter((s) => s && typeof s === 'string' && s.length > 0);
  if (unique.length === 0) return content;
  const sorted = [...unique].sort((a, b) => b.length - a.length);
  type Span = { start: number; end: number };
  const spans: Span[] = [];
  for (const snip of sorted) {
    let pos = 0;
    while (pos < content.length) {
      const idx = content.indexOf(snip, pos);
      if (idx === -1) break;
      const endIdx = idx + snip.length;
      if (!spans.some((s) => (s.start < endIdx && s.end > idx))) {
        spans.push({ start: idx, end: endIdx });
      }
      pos = endIdx;
    }
  }
  spans.sort((a, b) => a.start - b.start);
  const merged: Span[] = [];
  for (const s of spans) {
    if (merged.length && merged[merged.length - 1].end >= s.start) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, s.end);
    } else {
      merged.push({ ...s });
    }
  }
  const starLevel = Math.min(5, Math.max(1, weightStars));
  const weightClass = `kb-weight-${starLevel}`;
  if (merged.length === 0) return content;
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const { start, end } of merged) {
    if (start > last) parts.push(content.slice(last, start));
    parts.push(
      <mark key={`${start}-${end}`} className={`kb-content-mark ${weightClass}`}>
        {content.slice(start, end)}
      </mark>
    );
    last = end;
  }
  if (last < content.length) parts.push(content.slice(last));
  return <>{parts}</>;
}

const KnowledgeBaseWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [kpTotal, setKpTotal] = useState(0);
  const [kpPage, setKpPage] = useState(1);
  const [kpPageSize] = useState(KP_PAGE_SIZE);
  const [selectedKp, setSelectedKp] = useState<KnowledgePoint | null>(null);
  const [loadingKp, setLoadingKp] = useState(false);
  const [annotationSnippets, setAnnotationSnippets] = useState<string[]>([]);
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualContent, setManualContent] = useState('');
  const [addingManual, setAddingManual] = useState(false);
  const prevDocIdRef = useRef<number | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (selectedDocId == null) {
      setKnowledgePoints([]);
      setKpTotal(0);
      setKpPage(1);
      setSelectedKp(null);
      prevDocIdRef.current = null;
      return;
    }
    const docChanged = selectedDocId !== prevDocIdRef.current;
    if (docChanged) {
      prevDocIdRef.current = selectedDocId;
    }
    const pageToFetch = docChanged ? 1 : kpPage;
    setLoadingKp(true);
    getKnowledgePoints(pageToFetch, kpPageSize, selectedDocId)
      .then((data) => {
        setKnowledgePoints(data.knowledge_points);
        setKpTotal(data.total);
        setSelectedKp(null);
      })
      .catch(() => {
        setKnowledgePoints([]);
        setKpTotal(0);
        setSelectedKp(null);
      })
      .finally(() => setLoadingKp(false));
  }, [selectedDocId, kpPage, kpPageSize]);

  const loadDocuments = async () => {
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
      setDocuments([]);
    }
  };

  const searchResults = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return [];
    return documents.filter((d) => d.filename.toLowerCase().includes(q));
  }, [documents, searchQuery]);

  const recentFiles = useMemo(() => {
    return [...documents]
      .sort((a, b) => (b.uploadTime || '').localeCompare(a.uploadTime || ''))
      .slice(0, RECENT_LIMIT);
  }, [documents]);

  const selectedDoc = selectedDocId != null
    ? documents.find((d) => d.id === selectedDocId) ?? null
    : null;

  useEffect(() => {
    getTrainingSet()
      .then(({ annotations }) => {
        const snips: string[] = [];
        for (const a of annotations) {
          const instr = (a as { instruction?: string }).instruction;
          const q = (a as { question?: string }).question;
          if (instr && typeof instr === 'string') snips.push(instr.trim());
          if (q && typeof q === 'string' && q.trim() !== instr?.trim()) snips.push(q.trim());
        }
        setAnnotationSnippets(snips);
      })
      .catch(() => setAnnotationSnippets([]));
  }, []);

  const kpRowId = (kp: KnowledgePoint) => kp.id ?? `doc-${kp.document_id}-chunk-${kp.chunk_index}`;

  const handleAddManualSubmit = async () => {
    const content = manualContent.trim();
    if (!content || selectedDocId == null) return;
    setAddingManual(true);
    try {
      const created = await createKnowledgePoint(selectedDocId, content);
      setManualContent('');
      setShowAddManual(false);
      const nextTotal = kpTotal + 1;
      const lastPage = Math.max(1, Math.ceil(nextTotal / kpPageSize));
      const data = await getKnowledgePoints(lastPage, kpPageSize, selectedDocId);
      setKnowledgePoints(data.knowledge_points);
      setKpTotal(data.total);
      setKpPage(data.page);
      const found = data.knowledge_points.find((kp) => kp.id === created.id);
      setSelectedKp(found ?? created);
    } catch (e) {
      console.error('Create manual knowledge point failed:', e);
    } finally {
      setAddingManual(false);
    }
  };

  return (
    <div className="kb-workspace">
      <div className="kb-workspace-left">
        <div className="kb-search-section">
          <input
            type="text"
            className="kb-search-input"
            placeholder={t('knowledgeBaseWorkspace.searchFiles')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t('knowledgeBaseWorkspace.searchFiles')}
          />
        </div>
        <div className="kb-results-section">
          <div className="kb-section-title">{t('knowledgeBaseWorkspace.searchResults')}</div>
          <ul className="kb-file-list" role="listbox" aria-label={t('knowledgeBaseWorkspace.searchResults')}>
            {searchQuery.trim() ? (
              searchResults.length === 0 ? (
                <li className="kb-file-item kb-empty">{t('knowledgeBaseWorkspace.noResults')}</li>
              ) : (
                searchResults.map((doc) => (
                  <li
                    key={doc.id}
                    className={`kb-file-item ${selectedDocId === doc.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedDocId(doc.id);
                      setKpPage(1);
                    }}
                    role="option"
                    aria-selected={selectedDocId === doc.id}
                  >
                    <span className="kb-file-name" title={doc.filename}>{doc.filename}</span>
                    {doc.processed && <span className="kb-file-badge">&#10003;</span>}
                  </li>
                ))
              )
            ) : (
              <li className="kb-file-item kb-empty">{t('knowledgeBaseWorkspace.typeToSearch')}</li>
            )}
          </ul>
        </div>
        <div className="kb-recent-section">
          <div className="kb-section-title">{t('knowledgeBaseWorkspace.recentFiles')}</div>
          <ul className="kb-file-list" role="listbox" aria-label={t('knowledgeBaseWorkspace.recentFiles')}>
            {recentFiles.length === 0 ? (
              <li className="kb-file-item kb-empty">{t('knowledgeBaseWorkspace.noRecentFiles')}</li>
            ) : (
              recentFiles.map((doc) => (
                <li
                  key={doc.id}
                  className={`kb-file-item ${selectedDocId === doc.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedDocId(doc.id);
                    setKpPage(1);
                  }}
                  role="option"
                  aria-selected={selectedDocId === doc.id}
                >
                  <span className="kb-file-name" title={doc.filename}>{doc.filename}</span>
                  {doc.processed && <span className="kb-file-badge">&#10003;</span>}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
      <div className="kb-workspace-right">
        <div className="kb-kp-brief-section">
          <div className="kb-kp-brief-header">
            <div className="kb-section-title">
              {selectedDoc
                ? t('knowledgeBaseWorkspace.knowledgePointsBrief', { name: selectedDoc.filename, count: kpTotal })
                : t('knowledgeBaseWorkspace.selectFileForKp')}
            </div>
            {selectedDocId != null && (
              <div className="kb-kp-header-actions">
                <button
                  type="button"
                  className="kb-kp-add-manual-btn"
                  onClick={() => setShowAddManual(true)}
                  aria-label={t('knowledgeBaseWorkspace.addManual')}
                >
                  {t('knowledgeBaseWorkspace.addManual')}
                </button>
                {kpTotal > 0 && (
                  <div className="kb-kp-pagination">
                    <button
                      type="button"
                      className="kb-kp-page-btn"
                      disabled={kpPage <= 1}
                      onClick={() => setKpPage((p) => Math.max(1, p - 1))}
                      aria-label={t('knowledgeBaseWorkspace.prevPage')}
                    >
                      &lt;
                    </button>
                    <span className="kb-kp-page-info">
                      {t('knowledgeBaseWorkspace.pageOf', {
                        page: kpPage,
                        total: Math.max(1, Math.ceil(kpTotal / kpPageSize)),
                      })}
                    </span>
                    <button
                      type="button"
                      className="kb-kp-page-btn"
                      disabled={kpPage >= Math.ceil(kpTotal / kpPageSize)}
                      onClick={() => setKpPage((p) => p + 1)}
                      aria-label={t('knowledgeBaseWorkspace.nextPage')}
                    >
                      &gt;
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {showAddManual && selectedDocId != null && (
            <div className="kb-add-manual-form">
              <textarea
                className="kb-add-manual-textarea"
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                placeholder={t('knowledgeBaseWorkspace.manualContentPlaceholder')}
                rows={4}
                aria-label={t('knowledgeBaseWorkspace.manualContentPlaceholder')}
              />
              <div className="kb-add-manual-buttons">
                <button
                  type="button"
                  className="kb-kp-page-btn"
                  onClick={() => { setShowAddManual(false); setManualContent(''); }}
                  disabled={addingManual}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="kb-kp-add-manual-submit"
                  onClick={handleAddManualSubmit}
                  disabled={addingManual || !manualContent.trim()}
                >
                  {addingManual ? t('knowledgeBaseWorkspace.adding') : t('knowledgeBaseWorkspace.addManualConfirm')}
                </button>
              </div>
            </div>
          )}
          {loadingKp ? (
            <div className="kb-loading">{t('sidebar.loading')}</div>
          ) : (
            <ul className="kb-kp-brief-list" role="listbox" aria-label={t('dataCenter.knowledgePointsList')}>
              {knowledgePoints.length === 0 ? (
                <li className="kb-kp-brief-item kb-empty">
                  {selectedDocId
                    ? t('knowledgeBaseWorkspace.noKnowledgePointsForFile')
                    : t('knowledgeBaseWorkspace.selectFileFirst')}
                </li>
              ) : (
                knowledgePoints.map((kp, index) => (
                  <li
                    key={kpRowId(kp)}
                    className={`kb-kp-brief-item ${selectedKp === kp ? 'selected' : ''}${kp.excluded ? ' kb-kp-excluded' : ''}`}
                    onClick={() => setSelectedKp(kp)}
                    role="option"
                    aria-selected={selectedKp === kp}
                  >
                    <span className="kb-kp-brief-index">{(kpPage - 1) * kpPageSize + index + 1}.</span>
                    <span className={`kb-kp-source-badge ${kp.is_manual ? 'kb-kp-manual' : 'kb-kp-auto'}`} title={kp.is_manual ? t('knowledgeBaseWorkspace.manual') : t('knowledgeBaseWorkspace.auto')}>
                      {kp.is_manual ? t('knowledgeBaseWorkspace.manual') : t('knowledgeBaseWorkspace.auto')}
                    </span>
                    <span className="kb-kp-brief-text" title={kp.content}>
                      {kp.content.length <= BRIEF_LENGTH
                        ? kp.content
                        : `${kp.content.slice(0, BRIEF_LENGTH)}...`}
                    </span>
                    {kp.excluded && (
                      <span className="kb-kp-excluded-badge" title={t('knowledgeBaseWorkspace.excluded')}>
                        {t('knowledgeBaseWorkspace.excluded')}
                      </span>
                    )}
                    <span className="kb-kp-weight-stars" title={t('knowledgeBaseWorkspace.weight')}>
                      {renderStars(WEIGHT_STARS, weightToStars(kp.weight))}
                    </span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        <div className="kb-kp-detail-section">
          <div className="kb-section-title">{t('knowledgeBaseWorkspace.knowledgePointDetail')}</div>
          <div className="kb-kp-detail-content" role="article">
            {selectedKp ? (
              <>
                <div className="kb-kp-detail-meta">
                  {selectedDoc && (
                    <span className="kb-kp-detail-source">
                      {t('knowledgeBaseWorkspace.source')}: {selectedDoc.filename}
                    </span>
                  )}
                  <span className={`kb-kp-source-badge ${selectedKp.is_manual ? 'kb-kp-manual' : 'kb-kp-auto'}`}>
                    {selectedKp.is_manual ? t('knowledgeBaseWorkspace.manual') : t('knowledgeBaseWorkspace.auto')}
                  </span>
                  <span className="kb-kp-detail-index">
                    {t('knowledgeBaseWorkspace.chunk')} #{selectedKp.chunk_index + 1}
                  </span>
                </div>
                <div className="kb-kp-detail-weight-row">
                  <span className="kb-kp-weight-label">{t('knowledgeBaseWorkspace.weight')}</span>
                  <div className="kb-kp-stars" role="group" aria-label={t('knowledgeBaseWorkspace.weight')}>
                    {renderStars(WEIGHT_STARS, weightToStars(selectedKp.weight))}
                  </div>
                  {selectedKp.excluded && (
                    <span className="kb-kp-excluded-badge" title={t('knowledgeBaseWorkspace.excluded')}>
                      {t('knowledgeBaseWorkspace.excluded')}
                    </span>
                  )}
                </div>
                {annotationSnippets.length > 0 && (
                  <p className="kb-kp-pre-select-hint">{t('knowledgeBaseWorkspace.annotationPreSelectHint')}</p>
                )}
                <div className="kb-kp-detail-body">
                  {highlightAnnotationSpans(
                    selectedKp.content,
                    annotationSnippets,
                    weightToStars(selectedKp.weight)
                  )}
                </div>
                <div className="kb-keywords-list-section">
                  <div className="kb-keywords-list-title">{t('knowledgeBaseWorkspace.keywordsList')}</div>
                  {(() => {
                    const located = getLocatedKeywords(selectedKp.content, annotationSnippets);
                    const stars = weightToStars(selectedKp.weight);
                    if (located.length === 0) {
                      return <div className="kb-keywords-list-empty">{t('knowledgeBaseWorkspace.noKeywordsInContent')}</div>;
                    }
                    return (
                      <ul className="kb-keywords-list">
                        {located.map((kw, i) => (
                          <li key={`${i}-${kw.slice(0, 30)}`} className="kb-keyword-tag">
                            <span className="kb-keyword-text" title={kw}>
                              {kw.length > 40 ? `${kw.slice(0, 40)}...` : kw}
                            </span>
                            <span className="kb-keyword-stars" title={t('knowledgeBaseWorkspace.weight')}>
                              {renderStars(WEIGHT_STARS, stars)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              </>
            ) : (
              <div className="kb-kp-detail-placeholder">{t('knowledgeBaseWorkspace.selectKpForDetail')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseWorkspace;
