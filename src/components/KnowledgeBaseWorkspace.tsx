import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, X, Maximize2, Minimize2 } from 'lucide-react';
import Tooltip from './Tooltip';
import PdfViewer from './PdfViewer';
import { getDocuments, getDirectories, getKnowledgePoints, updateKnowledgePointWeight, updateKnowledgePointExcluded, getDocumentSummaryByDocumentId, getDocumentPreviewByDocumentId, getKnowledgePointKeywords, addKnowledgePointKeyword, removeKnowledgePointKeyword, type Document, type DirectoryNode, type KnowledgePoint } from '../services/api';
import { loadFileMeta, saveFileMeta, type FileMetaItem } from '../utils/fileMeta';
import './KnowledgeBaseWorkspace.css';

const UPPER_MIN = 40;
const UPPER_MAX_OFFSET = 40;
const UPPER_DEFAULT = 48;
const LOWER_VISIBLE_DEFAULT = false;
const KP_PAGE_SIZE = 50;
const LEFT_PANEL_MIN = 280;
const LEFT_PANEL_DEFAULT = 400;
const LEFT_PANEL_HANDLE_WIDTH = 4;
const RIGHT_PANEL_MIN = 200;
const KP_LIST_MIN_HEIGHT = 100;
const KP_DETAIL_MIN_HEIGHT = 100;
const KP_RESIZE_HANDLE_HEIGHT = 4;

const KnowledgeBaseWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [directoryTree, setDirectoryTree] = useState<DirectoryNode[]>([]);
  const [selectedDirId, setSelectedDirId] = useState<number | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [kpPage, setKpPage] = useState(1);
  const [kpTotal, setKpTotal] = useState(0);
  const [selectedKp, setSelectedKp] = useState<KnowledgePoint | null>(null);
  const [upperHeight, setUpperHeight] = useState(UPPER_DEFAULT);
  const [lowerVisible, setLowerVisible] = useState(() => LOWER_VISIBLE_DEFAULT);
  const [previewMaximized, setPreviewMaximized] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [resizingHorizontal, setResizingHorizontal] = useState(false);
  const [resizingKpVertical, setResizingKpVertical] = useState(false);
  const [kpListHeight, setKpListHeight] = useState<number | null>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(LEFT_PANEL_DEFAULT);
  const [fileMeta, setFileMeta] = useState<Record<number, FileMetaItem>>(loadFileMeta);
  const [expandedNoteDocId, setExpandedNoteDocId] = useState<number | null>(null);
  const [addTagDocId, setAddTagDocId] = useState<number | null>(null);
  const [addTagInput, setAddTagInput] = useState('');
  const [deletedKpIds, setDeletedKpIds] = useState<Set<number>>(new Set());
  const [kpWeightDragging, setKpWeightDragging] = useState<{ kpId: number; value: number } | null>(null);
  const [highlightedKeywords, setHighlightedKeywords] = useState<string[]>([]);
  const kpWeightSliderRef = useRef<HTMLSpanElement | null>(null);
  const kpWeightDragValueRef = useRef<number>(1);
  const kpWeightDragKpRef = useRef<KnowledgePoint | null>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const currentUpperHeightRef = useRef(0);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const upperBodyRef = useRef<HTMLDivElement>(null);
  const upperLeftRightRef = useRef<HTMLDivElement>(null);
  const kpTopPanelRef = useRef<HTMLDivElement>(null);
  const startYKpRef = useRef(0);
  const startHeightKpRef = useRef(0);
  const [documentSummary, setDocumentSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    saveFileMeta(fileMeta);
  }, [fileMeta]);

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

  function getMeta(docId: number): FileMetaItem {
    return (
      fileMeta[docId] ?? {
        weight: 0,
        note: '',
        tags: []
      }
    );
  }

  function updateMeta(docId: number, patch: Partial<FileMetaItem>): void {
    setFileMeta((prev) => {
      const current = prev[docId] ?? { weight: 0, note: '', tags: [] };
      return { ...prev, [docId]: { ...current, ...patch } };
    });
  }

  useEffect(() => {
    getDocuments()
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, []);

  useEffect(() => {
    getDirectories()
      .then(setDirectoryTree)
      .catch(() => setDirectoryTree([]));
  }, []);

  const topLevelDirs = useMemo(() => {
    return directoryTree.filter(
      (n) => n.type === 'directory' && !n.parentId && !n.directoryId
    );
  }, [directoryTree]);

  const topLevelItems = useMemo(() => {
    return directoryTree.filter((n) => !n.parentId && !n.directoryId);
  }, [directoryTree]);

  function findNodeInTree(nodes: DirectoryNode[], id: number): DirectoryNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children?.length) {
        const found = findNodeInTree(n.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  const selectedDirChildren = useMemo(() => {
    if (selectedDirId == null) return [];
    const node = findNodeInTree(directoryTree, selectedDirId);
    const fromChildren = node?.children;
    if (fromChildren && fromChildren.length > 0) return fromChildren;
    return directoryTree.filter(
      (n) => n.parentId === selectedDirId || n.directoryId === selectedDirId
    );
  }, [directoryTree, selectedDirId]);

  const fileListInDir = useMemo(() => {
    const fromTree = selectedDirId == null ? topLevelItems : selectedDirChildren;
    const filesFromTree = fromTree.filter((n) => n.type === 'file');
    if (filesFromTree.length > 0) return filesFromTree;
    if (selectedDirId == null) {
      return documents.map((d) => ({
        id: d.id,
        name: d.filename,
        type: 'file' as const,
        processed: d.processed
      }));
    }
    return [];
  }, [selectedDirId, topLevelItems, selectedDirChildren, documents]);

  useEffect(() => {
    if (selectedDocId == null) {
      setKnowledgePoints([]);
      setKpPage(1);
      setKpTotal(0);
      setSelectedKp(null);
      return;
    }
    setKnowledgePoints([]);
    setKpTotal(0);
    setKpPage(1);
    setSelectedKp(null);
  }, [selectedDocId]);

  const selectedDocIdRef = useRef<number | null>(selectedDocId);
  const fetchPageRef = useRef(1);
  useEffect(() => {
    selectedDocIdRef.current = selectedDocId;
  }, [selectedDocId]);
  useEffect(() => {
    fetchPageRef.current = kpPage;
  }, [kpPage]);
  useEffect(() => {
    if (selectedDocId != null) fetchPageRef.current = 1;
  }, [selectedDocId]);

  const refetchKnowledgePoints = useCallback(() => {
    if (selectedDocId == null) return;
    const docId = selectedDocId;
    const page = fetchPageRef.current;
    getKnowledgePoints(page, KP_PAGE_SIZE, docId)
      .then((res) => {
        if (selectedDocIdRef.current !== docId) return;
        const raw = res.knowledge_points ?? [];
        const forDoc = raw.filter((kp) => kp.document_id === docId);
        setKnowledgePoints(forDoc);
        setKpTotal(res.total ?? 0);
      })
      .catch(() => {
        if (selectedDocIdRef.current !== docId) return;
        setKnowledgePoints([]);
        setKpTotal(0);
      });
  }, [selectedDocId, kpPage]);

  useEffect(() => {
    refetchKnowledgePoints();
  }, [refetchKnowledgePoints]);

  const kpTotalPages = Math.max(1, Math.ceil(kpTotal / KP_PAGE_SIZE));

  const onKpWeightChange = (kp: KnowledgePoint, weight: number) => {
    const id = kp.id;
    if (id == null) return;
    const clamped = Math.max(1, Math.min(5, Math.round(weight)));
    updateKnowledgePointWeight(id, clamped)
      .then(() => {
        setKnowledgePoints((prev) =>
          prev.map((p) => (p.id === id ? { ...p, weight: clamped } : p))
        );
      })
      .catch(() => {});
  };

  const handleKpWeightMouseDown = useCallback((kp: KnowledgePoint, currentWeight: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const id = kp.id;
    if (id == null) return;
    const el = e.currentTarget as HTMLSpanElement;
    const value = Math.max(1, Math.min(5, Math.round(currentWeight)));
    kpWeightSliderRef.current = el;
    kpWeightDragValueRef.current = value;
    kpWeightDragKpRef.current = kp;
    setKpWeightDragging({ kpId: id, value });
    const onMove = (moveEvent: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const w = rect.width;
      let v = value;
      if (w > 0) {
        const p = Math.max(0, Math.min(1, x / w));
        v = Math.round(p * 5);
        v = Math.max(1, Math.min(5, v));
      }
      kpWeightDragValueRef.current = v;
      setKpWeightDragging((prev) => (prev?.kpId === id ? { kpId: id, value: v } : prev));
    };
    const onUp = () => {
      const finalValue = kpWeightDragValueRef.current;
      const targetKp = kpWeightDragKpRef.current;
      setKpWeightDragging(null);
      kpWeightSliderRef.current = null;
      kpWeightDragKpRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (targetKp?.id != null) {
        updateKnowledgePointWeight(targetKp.id, finalValue)
          .then(() => {
            setKnowledgePoints((prev) =>
              prev.map((p) => (p.id === targetKp.id ? { ...p, weight: finalValue } : p))
            );
          })
          .catch(() => {});
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const onKpSetDeleted = (kp: KnowledgePoint, deleted: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = kp.id;
    if (id == null) return;
    setDeletedKpIds((prev) => {
      const next = new Set(prev);
      if (deleted) next.add(id);
      else next.delete(id);
      return next;
    });
    updateKnowledgePointExcluded(id, deleted)
      .then(() => {
        setKnowledgePoints((prev) =>
          prev.map((p) => (p.id === id ? { ...p, excluded: deleted } : p))
        );
        setDeletedKpIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      })
      .catch(() => {
        setDeletedKpIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
  };

  const onKpDelete = (kp: KnowledgePoint, e: React.MouseEvent) => onKpSetDeleted(kp, true, e);
  const onKpRestore = (kp: KnowledgePoint, e: React.MouseEvent) => onKpSetDeleted(kp, false, e);

  const onSelectFile = (id: number) => {
    if (selectedDocId === id) {
      setSelectedDocId(null);
    } else {
      setSelectedDocId(id);
      setKpPage(1);
    }
  };

  const searchResults = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return [];
    return documents.filter((d) => d.filename.toLowerCase().includes(q));
  }, [documents, searchQuery]);

  const displayFileList = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (q) {
      return searchResults.map((d) => ({
        id: d.id,
        name: d.filename,
        type: 'file' as const,
        processed: d.processed
      }));
    }
    return fileListInDir;
  }, [searchQuery, searchResults, fileListInDir]);

  const selectedDoc = useMemo(
    () => (selectedDocId != null ? documents.find((d) => d.id === selectedDocId) ?? null : null),
    [documents, selectedDocId]
  );

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientY - startYRef.current;
      let next = startHeightRef.current + delta;
      const el = workspaceRef.current;
      const max = el ? el.clientHeight - UPPER_MAX_OFFSET : next + 1;
      next = Math.max(UPPER_MIN, Math.min(max, next));
      currentUpperHeightRef.current = next;
      setUpperHeight(next);
    };
    const onUp = () => {
      const el = workspaceRef.current;
      const threshold = el ? el.clientHeight - UPPER_MAX_OFFSET - 4 : 0;
      if (lowerVisible && currentUpperHeightRef.current >= threshold) {
        setLowerVisible(false);
        setUpperHeight(UPPER_DEFAULT);
      }
      setResizing(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizing, lowerVisible]);

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!lowerVisible) {
      setLowerVisible(true);
    }
    startYRef.current = e.clientY;
    startHeightRef.current = upperHeight;
    setResizing(true);
  };

  useEffect(() => {
    if (!resizingHorizontal) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      let next = startWidthRef.current + delta;
      const el = upperBodyRef.current;
      const maxW = el ? el.clientWidth - 280 - LEFT_PANEL_HANDLE_WIDTH - RIGHT_PANEL_MIN : next + 1;
      next = Math.max(LEFT_PANEL_MIN, Math.min(maxW, next));
      setLeftPanelWidth(next);
    };
    const onUp = () => setResizingHorizontal(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizingHorizontal]);

  const onResizeHorizontalStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    startWidthRef.current = leftPanelWidth;
    setResizingHorizontal(true);
  };

  useEffect(() => {
    if (!resizingKpVertical) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientY - startYKpRef.current;
      let next = startHeightKpRef.current + delta;
      const el = upperLeftRightRef.current;
      const maxTop = el ? el.clientHeight - KP_RESIZE_HANDLE_HEIGHT - KP_DETAIL_MIN_HEIGHT : next + 1;
      next = Math.max(KP_LIST_MIN_HEIGHT, Math.min(maxTop, next));
      setKpListHeight(next);
    };
    const onUp = () => setResizingKpVertical(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizingKpVertical]);

  const onResizeKpVerticalStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const currentTop =
      kpListHeight ??
      (kpTopPanelRef.current?.offsetHeight ?? 200);
    startYKpRef.current = e.clientY;
    startHeightKpRef.current = currentTop;
    setKpListHeight(currentTop);
    setResizingKpVertical(true);
  };

  useEffect(() => {
    if (selectedKp?.id != null) {
      loadKeywords(selectedKp.id);
    } else {
      setHighlightedKeywords([]);
    }
  }, [selectedKp?.id]);

  const loadKeywords = async (kpId: number) => {
    try {
      const data = await getKnowledgePointKeywords(kpId);
      setHighlightedKeywords(data.keywords ?? []);
    } catch (error) {
      console.error('Load keywords error:', error);
      setHighlightedKeywords([]);
    }
  };

  const handleKpContentMouseUp = useCallback(async () => {
    if (!selectedKp?.id) return;
    const sel = window.getSelection();
    const text = sel?.toString?.()?.trim();
    if (text && !highlightedKeywords.includes(text)) {
      try {
        await addKnowledgePointKeyword(selectedKp.id, text);
        setHighlightedKeywords((prev) => [...prev, text]);
      } catch (error) {
        console.error('Add keyword error:', error);
      }
    }
  }, [highlightedKeywords, selectedKp?.id]);

  const removeHighlightedKeyword = useCallback(async (index: number) => {
    if (!selectedKp?.id) return;
    const keyword = highlightedKeywords[index];
    if (!keyword) return;
    try {
      await removeKnowledgePointKeyword(selectedKp.id, keyword);
      setHighlightedKeywords((prev) => prev.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Remove keyword error:', error);
    }
  }, [highlightedKeywords, selectedKp?.id]);

  const highlightKeywords = (content: string, keywords: string[]): React.ReactNode => {
    if (!content || keywords.length === 0) return content;
    
    const parts: Array<{ text: string; isKeyword: boolean }> = [];
    const sortedKeywords = [...keywords].filter(kw => kw && kw.trim().length > 0).sort((a, b) => b.length - a.length);
    
    if (sortedKeywords.length === 0) return content;
    
    const findNextKeyword = (startIndex: number): { keyword: string; index: number } | null => {
      let found: { keyword: string; index: number } | null = null;
      for (const kw of sortedKeywords) {
        const index = content.indexOf(kw, startIndex);
        if (index !== -1 && (!found || index < found.index)) {
          found = { keyword: kw, index };
        }
      }
      return found;
    };
    
    let currentIndex = 0;
    while (currentIndex < content.length) {
      const found = findNextKeyword(currentIndex);
      if (!found) {
        if (currentIndex < content.length) {
          parts.push({ text: content.substring(currentIndex), isKeyword: false });
        }
        break;
      }
      
      if (found.index > currentIndex) {
        parts.push({ text: content.substring(currentIndex, found.index), isKeyword: false });
      }
      
      parts.push({ text: found.keyword, isKeyword: true });
      currentIndex = found.index + found.keyword.length;
    }
    
    if (parts.length === 0) return content;
    
    return (
      <>
        {parts.map((part, idx) =>
          part.isKeyword ? (
            <mark key={idx} className="kb-kp-keyword-highlight">{part.text}</mark>
          ) : (
            <span key={idx}>{part.text}</span>
          )
        )}
      </>
    );
  };

  return (
    <div className={`kb-workspace ${previewMaximized ? 'kb-workspace-preview-maximized' : ''}`} ref={workspaceRef}>
      {!previewMaximized && (
      <div
        className="kb-upper"
        style={
          lowerVisible
            ? { height: upperHeight, flexShrink: 0 }
            : { flex: 1, minHeight: 0 }
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
            <div className="kb-filelist-search">
              <input
                type="text"
                className="kb-search-input"
                placeholder={t('knowledgeBaseWorkspace.searchFiles')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t('knowledgeBaseWorkspace.searchFiles')}
              />
            </div>
            <div className="kb-cli-file-table-wrap" role="listbox" aria-label={t('knowledgeBaseWorkspace.documentList')}>
              {displayFileList.length === 0 ? (
                <div className="kb-cli-line kb-cli-empty">
                  {searchQuery.trim() ? t('knowledgeBaseWorkspace.noResults') : t('knowledgeBaseWorkspace.emptyDirectory')}
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
                              <span className="kb-cli-col-processed" aria-label={t('knowledgeBaseWorkspace.fileProcessedBadge')}>
                                <span className="kb-file-badge">&#10003;</span>
                              </span>
                            </Tooltip>
                          ) : (
                            <span className="kb-cli-col-processed" aria-hidden> </span>
                          )}
                          <Tooltip title={item.name}>
                            <span className={`kb-cli-col-filename kb-file-weight-${weight}`}>
                              <span className="kb-file-name">{item.name}</span>
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
                                        tags: meta.tags.filter((t) => t !== tag)
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
                          <div className="kb-cli-notes-expanded-row" onClick={(e) => e.stopPropagation()}>
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
          </div>
          <div
            className="kb-resize-handle-h"
            role="separator"
            aria-label="Resize left panel"
            onMouseDown={onResizeHorizontalStart}
          />
          <div className="kb-upper-left-right" ref={upperLeftRightRef}>
            <div
              ref={kpTopPanelRef}
              className="kb-upper-left-right-top kb-cli-panel"
              style={
                kpListHeight != null
                  ? { height: kpListHeight, flex: '0 0 auto' }
                  : undefined
              }
            >
              <div className="kb-kp-list-title-bar">
                <span className="kb-kp-list-title">{t('knowledgeBaseWorkspace.knowledgePointList')}</span>
                {selectedDocId != null && lowerVisible !== true && (
                  <Tooltip title={t('knowledgeBaseWorkspace.documentPreview')}>
                    <button
                      type="button"
                      className="kb-kp-preview-icon-btn"
                      onClick={() => {
                      setLowerVisible(true);
                      const el = workspaceRef.current;
                      if (el) {
                        const total = el.clientHeight;
                        const half = Math.floor((total - 4) / 2);
                        const next = Math.max(UPPER_MIN, Math.min(total - 4 - UPPER_MAX_OFFSET, half));
                        setUpperHeight(next);
                      }
                    }}
                    aria-label={t('knowledgeBaseWorkspace.documentPreview')}
                  >
                    <FileText size={16} aria-hidden />
                  </button>
                  </Tooltip>
                )}
              </div>
              {selectedDocId == null ? (
                <p className="kb-placeholder">{t('knowledgeBaseWorkspace.selectFileFirst')}</p>
              ) : knowledgePoints.length === 0 && kpTotal === 0 ? (
                <p className="kb-placeholder">{t('knowledgeBaseWorkspace.noKnowledgePointsForFile')}</p>
              ) : (
                <>
                  <div className="kb-kp-table-wrap" role="listbox" aria-label={t('knowledgeBaseWorkspace.selectedDocKnowledgePoints')}>
                    <div className="kb-kp-table-header">
                      <span className="kb-kp-col-state" aria-hidden="true" />
                      <span className="kb-kp-col-content">{t('knowledgeBaseWorkspace.columnName')}</span>
                      <span className="kb-kp-col-weight">{t('knowledgeBaseWorkspace.weight')}</span>
                      <span className="kb-kp-col-action" aria-hidden="true" />
                    </div>
                    <ul className="kb-kp-list">
                      {knowledgePoints.map((kp, idx) => {
                        const baseWeight = Math.max(1, Math.min(5, Math.round(kp.weight ?? 1)));
                        const weight = kpWeightDragging && kpWeightDragging.kpId === kp.id ? kpWeightDragging.value : baseWeight;
                        const isSelected = selectedKp === kp;
                        const isDeleted = kp.excluded || (kp.id != null && deletedKpIds.has(kp.id));
                        const contentText = (kp.content || '').trim();
                        return (
                          <li
                            key={kp.id ?? `kp-${kp.document_id}-${kp.chunk_index}-${idx}`}
                            className={`kb-kp-item ${isSelected ? 'kb-kp-item-selected' : ''} ${isDeleted ? 'kb-kp-item-deleted' : ''}`}
                            role="option"
                            aria-selected={isSelected}
                            aria-label={isDeleted ? t('knowledgeBaseWorkspace.deletedState') : undefined}
                            onClick={() => setSelectedKp(isSelected ? null : kp)}
                          >
                            <Tooltip title={t('knowledgeBaseWorkspace.setWeight')}>
                              <span className="kb-kp-col-state" aria-label={t('knowledgeBaseWorkspace.setWeight')}>
                                {isDeleted ? '\u2717' : '\u22EE'}
                              </span>
                            </Tooltip>
                            <Tooltip title={isDeleted ? `[${t('knowledgeBaseWorkspace.deletedState')}] ${kp.content}` : (kp.content || '')} truncate>
                              <span className={`kb-kp-col-content kb-kp-item-preview kb-kp-weight-${Math.min(5, Math.max(1, weight))}`}>
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
                              onMouseDown={(e) => kp.id != null && handleKpWeightMouseDown(kp, weight, e)}
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
                            <span className="kb-kp-col-action" onClick={(e) => e.stopPropagation()}>
                              {kp.id != null && (
                                <Tooltip title={isDeleted ? t('knowledgeBaseWorkspace.restore') : t('knowledgeBaseWorkspace.deleteSelected')}>
                                  <button
                                    type="button"
                                    className="kb-kp-action-btn"
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
                kpListHeight != null
                  ? { flex: 1, minHeight: KP_DETAIL_MIN_HEIGHT }
                  : undefined
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
                      {highlightKeywords(selectedKp.content, highlightedKeywords)}
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
        </div>
        </div>
      </div>
      )}
      {lowerVisible === true && (
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
                  <Tooltip title={previewMaximized ? t('knowledgeBaseWorkspace.restorePreview') : t('knowledgeBaseWorkspace.maximizePreview')}>
                    <button
                      type="button"
                      className="kb-lower-maximize-btn"
                      onClick={() => setPreviewMaximized((m) => !m)}
                      aria-label={previewMaximized ? t('knowledgeBaseWorkspace.restorePreview') : t('knowledgeBaseWorkspace.maximizePreview')}
                    >
                      {previewMaximized ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
                    </button>
                  </Tooltip>
                  <Tooltip title={t('knowledgeBaseWorkspace.closePreview')}>
                    <button
                      type="button"
                      className="kb-lower-hide-btn"
                      onClick={() => { setLowerVisible(false); setPreviewMaximized(false); }}
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
                    {(documentSummary || '').trim() ? documentSummary : t('knowledgeBaseWorkspace.summaryReservedForAI')}
                  </div>
                )}
              </div>
              <div className="kb-lower-preview-block">
                {loadingPreview ? (
                  <div className="kb-lower-preview-placeholder">{t('sidebar.loading')}</div>
                ) : previewError ? (
                  <div className="kb-lower-preview-error">{previewError}</div>
                ) : previewBlobUrl ? (
                  <PdfViewer
                    url={previewBlobUrl}
                    className="kb-lower-preview-pdf"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default KnowledgeBaseWorkspace;
