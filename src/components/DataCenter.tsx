import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2, Minimize2, X } from 'lucide-react';
import Tooltip from './Tooltip';
import PdfViewer from './PdfViewer';
import DataCenterDirectoryBreadcrumbs from './DataCenter/DataCenterDirectoryBreadcrumbs';
import DataCenterToolbar from './DataCenter/DataCenterToolbar';
import DataCenterFileList from './DataCenter/DataCenterFileList';
import DataCenterKnowledgePanel from './DataCenter/DataCenterKnowledgePanel';
import { useDataCenterBreadcrumbs } from '../hooks/useDataCenterBreadcrumbs';
import { useDataCenterLayout } from '../hooks/useDataCenterLayout';
import {
  selectFile,
  selectFiles,
  uploadDocument,
  getDocuments,
  getKnowledgePoints,
  updateKnowledgePointWeight,
  updateKnowledgePointExcluded,
  getDocumentSummaryByDocumentId,
  getDocumentPreviewByDocumentId,
  Document,
  getDirectories,
  createDirectory,
  moveDocument,
  deleteDocument,
  DirectoryNode,
  KnowledgePoint,
  addKnowledgePointKeyword,
  removeKnowledgePointKeyword,
  getKnowledgePointKeywords,
} from '../services/api';
import { loadFileMeta, saveFileMeta, type FileMetaItem } from '../utils/fileMeta';
import { DOCUMENTS_CHANGED_EVENT } from './layout/FileExplorer';
import './DataCenter.css';

const DC_EXCLUDED_DIRS_KEY = 'dc_excluded_dirs';
const UPPER_MIN = 40;
const UPPER_MAX_OFFSET = 40;
const LEFT_PANEL_MIN = 280;

function loadExcludedDirs(): Set<number> {
  try {
    const raw = localStorage.getItem(DC_EXCLUDED_DIRS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(Array.isArray(arr) ? arr.filter((n) => typeof n === 'number') : []);
  } catch {
    return new Set();
  }
}

function saveExcludedDirs(ids: Set<number>): void {
  try {
    localStorage.setItem(DC_EXCLUDED_DIRS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function flattenFileNodes(nodes: DirectoryNode[]): DirectoryNode[] {
  const out: DirectoryNode[] = [];
  for (const n of nodes) {
    if (n.type === 'file') out.push(n);
    if (n.children) out.push(...flattenFileNodes(n.children));
  }
  return out;
}

const DataCenter: React.FC = () => {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [directoryTree, setDirectoryTree] = useState<DirectoryNode[]>([]);
  const [currentDirId, setCurrentDirId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [kpPage, setKpPage] = useState(1);
  const [kpTotal, setKpTotal] = useState(0);
  const [kpPageSize] = useState(50);
  const [selectedKp, setSelectedKp] = useState<KnowledgePoint | null>(null);
  const [highlightedKeywords, setHighlightedKeywords] = useState<string[]>([]);
  const [selectionToolbar, setSelectionToolbar] = useState<{ visible: boolean; x: number; y: number; text: string } | null>(null);
  const kpDetailContentRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [newDirName, setNewDirName] = useState('');
  const [isCreatingDir, setIsCreatingDir] = useState(false);
  const [fileMeta, setFileMeta] = useState<Record<number, FileMetaItem>>(loadFileMeta);
  const [excludedDirIds, setExcludedDirIds] = useState<Set<number>>(loadExcludedDirs);
  const [expandedNoteDocId, setExpandedNoteDocId] = useState<number | null>(null);
  const [addTagDocId, setAddTagDocId] = useState<number | null>(null);
  const [addTagInput, setAddTagInput] = useState('');
  const [fileWeightDragging, setFileWeightDragging] = useState<{ docId: number; value: number } | null>(null);
  const [deletedKpIds, setDeletedKpIds] = useState<Set<number>>(new Set());
  const [kpWeightDragging, setKpWeightDragging] = useState<{ kpId: number; value: number } | null>(null);
  const [kpViewMode, setKpViewMode] = useState<'list' | 'graph'>('list');
  const fileWeightSliderRef = useRef<HTMLSpanElement | null>(null);
  const fileWeightDragValueRef = useRef(1);
  const kpWeightSliderRef = useRef<HTMLSpanElement | null>(null);
  const kpWeightDragValueRef = useRef(1);
  const kpWeightDragKpRef = useRef<KnowledgePoint | null>(null);
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
    kpListHeight,
    workspaceRef,
    upperBodyRef,
    upperLeftRightRef,
    kpTopPanelRef,
    onResizeStart,
    onResizeHorizontalStart,
    onResizeKpVerticalStart,
  } = useDataCenterLayout();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectionToolbar?.visible && kpDetailContentRef.current && !kpDetailContentRef.current.contains(e.target as Node)) {
        setSelectionToolbar(null);
        window.getSelection()?.removeAllRanges();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectionToolbar]);

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

  useEffect(() => {
    saveFileMeta(fileMeta);
  }, [fileMeta]);

  useEffect(() => {
    saveExcludedDirs(excludedDirIds);
  }, [excludedDirIds]);

  const documentsRef = useRef<Document[]>(documents);
  useEffect(() => { documentsRef.current = documents; }, [documents]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      const processing = documentsRef.current.filter(
        (d) => d.processingStatus === 'pending' || d.processingStatus === 'processing'
      );
      if (processing.length > 0) {
        loadDocuments();
        loadDirectories();
        if (selectedDocIdRef.current != null) loadKnowledgePoints();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = () => {
      loadData();
      if (selectedDocIdRef.current != null) loadKnowledgePoints();
    };
    window.addEventListener(DOCUMENTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(DOCUMENTS_CHANGED_EVENT, handler);
  }, []);

  const selectedDocIdRef = useRef<number | null>(selectedDocId);
  const kpPageRef = useRef(kpPage);

  // Keep refs in sync via effects (order matters: refs update before dependent effects)
  useEffect(() => {
    selectedDocIdRef.current = selectedDocId;
  }, [selectedDocId]);

  useEffect(() => {
    kpPageRef.current = kpPage;
  }, [kpPage]);

  useEffect(() => {
    if (selectedDocId == null) {
      setKnowledgePoints([]);
      setKpTotal(0);
      setKpPage(1);
      kpPageRef.current = 1;
      setSelectedKp(null);
      setHighlightedKeywords([]);
      setSelectionToolbar(null);
      return;
    }
    setKnowledgePoints([]);
    setKpTotal(0);
    setKpPage(1);
    kpPageRef.current = 1;
    setSelectedKp(null);
    setHighlightedKeywords([]);
    setSelectionToolbar(null);
    const docId = selectedDocId;
    getKnowledgePoints(1, kpPageSize, docId)
      .then((data) => {
        if (selectedDocIdRef.current !== docId) return;
        const raw = data.knowledge_points ?? [];
        setKnowledgePoints(raw);
        setKpTotal(data.total ?? 0);
      })
      .catch(() => {
        if (selectedDocIdRef.current !== docId) return;
        setKnowledgePoints([]);
        setKpTotal(0);
      });
  }, [selectedDocId, kpPageSize]);

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

  const handleSelectKnowledgePoint = useCallback((kp: KnowledgePoint) => {
    setSelectedKp((prev) => {
      if (prev?.id != null && kp.id != null && prev.id === kp.id) {
        return null;
      }
      return kp;
    });
    setHighlightedKeywords([]);
    setSelectionToolbar(null);
  }, []);

  useEffect(() => {
    loadKnowledgePoints();
  }, [kpPage]);

  const loadData = async () => {
    await Promise.all([loadDocuments(), loadDirectories()]);
  };

  const loadDirectories = async () => {
    try {
      const tree = await getDirectories();
      setDirectoryTree(tree);
    } catch (e) {
      console.error('Failed to load directories:', e);
    }
  };

  const loadDocuments = async () => {
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (e) {
      console.error('Failed to load documents:', e);
    }
  };

  const loadKnowledgePoints = async () => {
    const docId = selectedDocIdRef.current;
    if (docId == null) return;
    const page = kpPageRef.current;
    try {
      const data = await getKnowledgePoints(page, kpPageSize, docId);
      if (selectedDocIdRef.current !== docId) return;
      const raw = data.knowledge_points ?? [];
      setKnowledgePoints(raw);
      setKpTotal(data.total ?? 0);
    } catch (e) {
      if (selectedDocIdRef.current !== docId) return;
      console.error('Failed to load knowledge points:', e);
      setKnowledgePoints([]);
      setKpTotal(0);
    }
  };

  function getMeta(docId: number): FileMetaItem {
    return fileMeta[docId] ?? { weight: 0, note: '', tags: [], excluded: false };
  }

  function isExcluded(item: DirectoryNode): boolean {
    if (item.type === 'file') return getMeta(item.id).excluded ?? false;
    return excludedDirIds.has(item.id);
  }

  function updateMeta(docId: number, patch: Partial<FileMetaItem>): void {
    setFileMeta((prev) => {
      const current = prev[docId] ?? { weight: 0, note: '', tags: [], excluded: false };
      return { ...prev, [docId]: { ...current, ...patch } };
    });
  }

  const handleFileWeightMouseDown = useCallback((docId: number, currentWeight: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLSpanElement;
    const value = Math.max(1, Math.min(5, Math.round(currentWeight)));
    fileWeightSliderRef.current = el;
    fileWeightDragValueRef.current = value;
    setFileWeightDragging({ docId, value });
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
      fileWeightDragValueRef.current = v;
      setFileWeightDragging((prev) => (prev?.docId === docId ? { docId, value: v } : prev));
    };
    const onUp = () => {
      const finalValue = fileWeightDragValueRef.current;
      setFileWeightDragging(null);
      fileWeightSliderRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      updateMeta(docId, { weight: finalValue });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ docId: number; filename: string } | null>(null);

  const handleDeleteClick = (docId: number, filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialog({ docId, filename });
  };

  const handlePhysicalDelete = async () => {
    if (!deleteDialog) return;
    const { docId } = deleteDialog;
    setDeleteDialog(null);
    setDeletingDocId(docId);
    try {
      await deleteDocument(docId);
      if (selectedDocId === docId) {
        setSelectedDocId(null);
        setLowerVisible(false);
        setPreviewMaximized(false);
      }
      await loadData();
      setFileMeta((prev) => {
        const next = { ...prev };
        delete next[docId];
        return next;
      });
    } catch (error) {
      console.error('Delete document error:', error);
      alert(t('dataCenter.deleteFailed'));
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleLogicalDelete = () => {
    if (!deleteDialog) return;
    const { docId } = deleteDialog;
    setDeleteDialog(null);
    updateMeta(docId, { excluded: true });
  };

  const onSetExcluded = (item: DirectoryNode, excluded: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'file') {
      updateMeta(item.id, { excluded });
    } else {
      setExcludedDirIds((prev) => {
        const next = new Set(prev);
        if (excluded) next.add(item.id);
        else next.delete(item.id);
        return next;
      });
    }
  };

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

  const currentItems = useMemo(() => {
    if (currentDirId === null) {
      return directoryTree.filter((n) => !n.parentId && !n.directoryId);
    }
    const findNode = (nodes: DirectoryNode[]): DirectoryNode | null => {
      for (const n of nodes) {
        if (n.id === currentDirId && n.type === 'directory') return n;
        if (n.children) {
          const found = findNode(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    const node = findNode(directoryTree);
    return node?.children ?? [];
  }, [directoryTree, currentDirId]);

  const breadcrumbs = useDataCenterBreadcrumbs(directoryTree, currentDirId);
  const allFiles = useMemo(() => flattenFileNodes(directoryTree), [directoryTree]);
  const filteredBySearch = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return currentItems;
    return allFiles.filter((n) => n.name.toLowerCase().includes(q));
  }, [searchQuery, currentItems, allFiles]);

  const displayItems = searchQuery.trim() ? filteredBySearch : currentItems;
  const selectedDoc = selectedDocId != null ? documents.find((d) => d.id === selectedDocId) : null;

  const handleCreateDirectory = async () => {
    if (!newDirName.trim()) return;
    try {
      await createDirectory(newDirName, currentDirId ?? undefined);
      setNewDirName('');
      setIsCreatingDir(false);
      await loadDirectories();
    } catch (e) {
      console.error('Create directory error:', e);
      alert(t('dataCenter.createDirFailed'));
    }
  };

  const handleFileSelect = async () => {
    const filePath = await selectFile();
    if (!filePath) return;
    setIsUploading(true);
    setUploadProgress(t('dataCenter.processing'));
    try {
      const result = await uploadDocument(filePath);
      if (currentDirId && result.document_id) {
        await moveDocument(result.document_id, currentDirId);
      }
      setUploadProgress(t('dataCenter.documentProcessed'));
      await loadData();
      setTimeout(() => setUploadProgress(''), 3000);
    } catch (e) {
      console.error('Upload error:', e);
      setUploadProgress(String(e));
    } finally {
      setIsUploading(false);
    }
  };

  const handleBatchFileSelect = async () => {
    const filePaths = await selectFiles();
    if (filePaths.length === 0) return;
    setIsUploading(true);
    const total = filePaths.length;
    let done = 0;
    let failed = 0;
    try {
      for (const filePath of filePaths) {
        setUploadProgress(t('dataCenter.uploadingCount', { current: done + 1, total }));
        try {
          const result = await uploadDocument(filePath);
          if (currentDirId && result?.document_id) {
            await moveDocument(result.document_id, currentDirId);
          }
          done += 1;
        } catch (e) {
          console.error('Batch upload error:', e);
          failed += 1;
        }
      }
      setUploadProgress(t('dataCenter.batchImportDone', { done, total, failed }));
      await loadData();
      setTimeout(() => setUploadProgress(''), 4000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleKpContentMouseUp = (_e: React.MouseEvent) => {
    const sel = window.getSelection();
    const text = sel?.toString?.()?.trim();
    if (text && text.length > 0) {
      const range = sel?.getRangeAt(0);
      if (range && kpDetailContentRef.current) {
        const rect = range.getBoundingClientRect();
        const containerRect = kpDetailContentRef.current.getBoundingClientRect();
        setSelectionToolbar({
          visible: true,
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top - 30,
          text: text
        });
      }
    } else {
      setSelectionToolbar(null);
    }
  };

  const handleAddKeyword = async () => {
    if (!selectionToolbar || !selectedKp?.id) return;
    const keyword = selectionToolbar.text.trim();
    if (!keyword || highlightedKeywords.includes(keyword)) {
      setSelectionToolbar(null);
      return;
    }
    try {
      await addKnowledgePointKeyword(selectedKp.id, keyword);
      setHighlightedKeywords((prev) => [...prev, keyword]);
      setSelectionToolbar(null);
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error('Add keyword error:', error);
    }
  };

  const removeKeyword = async (keyword: string) => {
    if (!selectedKp?.id) return;
    try {
      await removeKnowledgePointKeyword(selectedKp.id, keyword);
      setHighlightedKeywords((prev) => prev.filter((kw) => kw !== keyword));
    } catch (error) {
      console.error('Remove keyword error:', error);
    }
  };

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
            <mark key={idx} className="dc-kp-keyword-highlight">{part.text}</mark>
          ) : (
            <span key={idx}>{part.text}</span>
          )
        )}
      </>
    );
  };

  const kpTotalPages = Math.max(1, Math.ceil(kpTotal / kpPageSize));

  return (
    <div className={`data-center data-center-layout ${previewMaximized ? 'data-center-preview-maximized' : ''}`} ref={workspaceRef}>
      {!previewMaximized && (
      <div
        className="dc-upper"
        style={
          lowerVisible
            ? { height: upperHeight, flexShrink: 0 }
            : { flex: 1, minHeight: 0 }
        }
      >
      <DataCenterDirectoryBreadcrumbs
        breadcrumbs={breadcrumbs}
        currentDirId={currentDirId}
        onSelectDir={setCurrentDirId}
      />
      <div className="dc-upper-body" ref={upperBodyRef}>
        <div className="dc-upper-left">
          <div
            className="dc-upper-left-filelist dc-cli-panel"
            style={{ width: leftPanelWidth, minWidth: LEFT_PANEL_MIN }}
          >
            <div className="dc-filelist-search">
              <input
                type="text"
                className="dc-search-input"
                placeholder={t('dataCenter.searchDocuments')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t('dataCenter.searchDocuments')}
              />
            </div>
            <DataCenterToolbar
              uploadProgress={uploadProgress}
              isUploading={isUploading}
              onUploadClick={handleFileSelect}
              onBatchUploadClick={handleBatchFileSelect}
              isCreatingDir={isCreatingDir}
              newDirName={newDirName}
              onNewDirNameChange={setNewDirName}
              onCreateDirectory={handleCreateDirectory}
              onCancelCreateDir={() => { setIsCreatingDir(false); setNewDirName(''); }}
              onStartCreateDir={() => setIsCreatingDir(true)}
            />
            <DataCenterFileList
              displayItems={displayItems}
              documents={documents}
              getMeta={getMeta}
              isExcluded={isExcluded}
              updateMeta={updateMeta}
              fileWeightDragging={fileWeightDragging}
              expandedNoteDocId={expandedNoteDocId}
              setExpandedNoteDocId={setExpandedNoteDocId}
              addTagDocId={addTagDocId}
              setAddTagDocId={setAddTagDocId}
              addTagInput={addTagInput}
              setAddTagInput={setAddTagInput}
              selectedDocId={selectedDocId}
              setSelectedDocId={setSelectedDocId}
              setCurrentDirId={setCurrentDirId}
              deletingDocId={deletingDocId}
              onFileWeightMouseDown={handleFileWeightMouseDown}
              onSetExcluded={onSetExcluded}
              onDeleteClick={handleDeleteClick}
              searchQuery={searchQuery}
            />
          </div>
          <div
            className="dc-resize-handle-h"
            role="separator"
            aria-label="Resize"
            onMouseDown={onResizeHorizontalStart}
          />
          <DataCenterKnowledgePanel
            upperLeftRightRef={upperLeftRightRef}
            kpTopPanelRef={kpTopPanelRef}
            kpListHeight={kpListHeight}
            selectedDoc={selectedDoc}
            selectedDocId={selectedDocId}
            kpTotal={kpTotal}
            kpViewMode={kpViewMode}
            setKpViewMode={setKpViewMode}
            knowledgePoints={knowledgePoints}
            kpPage={kpPage}
            kpTotalPages={kpTotalPages}
            setKpPage={setKpPage}
            selectedKp={selectedKp}
            highlightedKeywords={highlightedKeywords}
            selectionToolbar={selectionToolbar}
            deletedKpIds={deletedKpIds}
            kpWeightDragging={kpWeightDragging}
            lowerVisible={lowerVisible}
            onOpenPreview={() => {
              setLowerVisible(true);
              const el = workspaceRef.current;
              if (el) {
                const total = el.clientHeight;
                const half = Math.floor((total - 4) / 2);
                const next = Math.max(UPPER_MIN, Math.min(total - 4 - UPPER_MAX_OFFSET, half));
                setUpperHeight(next);
              }
            }}
            onResizeKpVerticalStart={onResizeKpVerticalStart}
            onSelectKnowledgePoint={handleSelectKnowledgePoint}
            onKpWeightMouseDown={handleKpWeightMouseDown}
            onKpWeightChange={onKpWeightChange}
            onKpDelete={onKpDelete}
            onKpRestore={onKpRestore}
            onKpContentMouseUp={handleKpContentMouseUp}
            onAddKeyword={handleAddKeyword}
            onRemoveKeyword={removeKeyword}
            highlightKeywords={highlightKeywords}
            kpDetailContentRef={kpDetailContentRef}
          />
        </div>
        </div>
      </div>
      )}
      {lowerVisible && (
        <>
          {!previewMaximized && (
            <div
              className="dc-resize-handle"
              role="separator"
              aria-label="Resize"
              onMouseDown={onResizeStart}
            />
          )}
          <div className="dc-lower">
            <div className="dc-lower-detail">
              <div className="dc-lower-detail-header">
                <Tooltip title={selectedDoc?.filename ?? ''}>
                  <span className="dc-lower-detail-title">{selectedDoc?.filename ?? ''}</span>
                </Tooltip>
                <div className="dc-lower-detail-actions">
                  <Tooltip title={previewMaximized ? t('knowledgeBaseWorkspace.restorePreview') : t('knowledgeBaseWorkspace.maximizePreview')}>
                    <button
                      type="button"
                      className="dc-lower-maximize-btn"
                      onClick={() => setPreviewMaximized((m) => !m)}
                      aria-label={previewMaximized ? t('knowledgeBaseWorkspace.restorePreview') : t('knowledgeBaseWorkspace.maximizePreview')}
                    >
                      {previewMaximized ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
                    </button>
                  </Tooltip>
                  <Tooltip title={t('knowledgeBaseWorkspace.closePreview')}>
                    <button
                      type="button"
                      className="dc-lower-hide-btn"
                      onClick={() => { setLowerVisible(false); setPreviewMaximized(false); }}
                      aria-label={t('knowledgeBaseWorkspace.closePreview')}
                    >
                      <X className="dc-lower-hide-btn-icon" size={14} aria-hidden />
                    </button>
                  </Tooltip>
                </div>
              </div>
              <div className="dc-lower-summary-block">
                {loadingSummary ? (
                  <div className="dc-lower-summary-placeholder">{t('sidebar.loading')}</div>
                ) : (
                  <div className="dc-lower-summary-content">
                    {(documentSummary || '').trim() ? documentSummary : t('knowledgeBaseWorkspace.summaryReservedForAI')}
                  </div>
                )}
              </div>
              <div className="dc-lower-preview-block">
                {loadingPreview ? (
                  <div className="dc-lower-preview-placeholder">{t('sidebar.loading')}</div>
                ) : previewError ? (
                  <div className="dc-lower-preview-error">{previewError}</div>
                ) : previewBlobUrl ? (
                  <PdfViewer
                    url={previewBlobUrl}
                    className="dc-lower-preview-pdf"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
      {deleteDialog && (
        <div className="dc-delete-dialog-overlay" onClick={() => setDeleteDialog(null)}>
          <div className="dc-delete-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dc-delete-dialog-header">
              <span className="dc-delete-dialog-title">{t('dataCenter.deleteType')}</span>
              <button
                type="button"
                className="dc-delete-dialog-close"
                onClick={() => setDeleteDialog(null)}
                aria-label={t('common.close')}
              >
                ×
              </button>
            </div>
            <div className="dc-delete-dialog-content">
              <p className="dc-delete-dialog-filename">{deleteDialog.filename}</p>
              <div className="dc-delete-dialog-options">
                <button
                  type="button"
                  className="dc-delete-dialog-option dc-delete-dialog-option-physical"
                  onClick={handlePhysicalDelete}
                >
                  <div className="dc-delete-dialog-option-title">{t('dataCenter.physicalDelete')}</div>
                  <div className="dc-delete-dialog-option-desc">{t('dataCenter.physicalDeleteDesc')}</div>
                </button>
                <button
                  type="button"
                  className="dc-delete-dialog-option dc-delete-dialog-option-logical"
                  onClick={handleLogicalDelete}
                >
                  <div className="dc-delete-dialog-option-title">{t('dataCenter.logicalDelete')}</div>
                  <div className="dc-delete-dialog-option-desc">{t('dataCenter.logicalDeleteDesc')}</div>
                </button>
              </div>
            </div>
            <div className="dc-delete-dialog-footer">
              <button
                type="button"
                className="dc-delete-dialog-cancel"
                onClick={() => setDeleteDialog(null)}
              >
                {t('dataCenter.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataCenter;
