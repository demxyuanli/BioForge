import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Maximize2, Minimize2, X } from 'lucide-react';
import Tooltip from './Tooltip';
import PdfViewer from './PdfViewer';
import {
  selectFile,
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
} from '../services/api';
import { loadFileMeta, saveFileMeta, type FileMetaItem } from '../utils/fileMeta';
import './DataCenter.css';

const DC_EXCLUDED_DIRS_KEY = 'dc_excluded_dirs';
const UPPER_MIN = 40;
const UPPER_MAX_OFFSET = 40;
const UPPER_DEFAULT = 48;
const LOWER_VISIBLE_DEFAULT = false;
const LEFT_PANEL_MIN = 280;
const LEFT_PANEL_DEFAULT = 400;
const LEFT_PANEL_HANDLE_WIDTH = 4;
const RIGHT_PANEL_MIN = 200;
const KP_LIST_MIN_HEIGHT = 100;
const KP_DETAIL_MIN_HEIGHT = 100;
const KP_RESIZE_HANDLE_HEIGHT = 4;

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
  const fileWeightSliderRef = useRef<HTMLSpanElement | null>(null);
  const fileWeightDragValueRef = useRef(1);
  const kpWeightSliderRef = useRef<HTMLSpanElement | null>(null);
  const kpWeightDragValueRef = useRef(1);
  const kpWeightDragKpRef = useRef<KnowledgePoint | null>(null);
  const [lowerVisible, setLowerVisible] = useState(LOWER_VISIBLE_DEFAULT);
  const [previewMaximized, setPreviewMaximized] = useState(false);
  const [upperHeight, setUpperHeight] = useState(UPPER_DEFAULT);
  const [resizing, setResizing] = useState(false);
  const [documentSummary, setDocumentSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const upperBodyRef = useRef<HTMLDivElement>(null);
  const upperLeftRightRef = useRef<HTMLDivElement>(null);
  const kpTopPanelRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const currentUpperHeightRef = useRef(0);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const startYKpRef = useRef(0);
  const startHeightKpRef = useRef(0);
  const previewBlobUrlRef = useRef<string | null>(null);
  const [resizingHorizontal, setResizingHorizontal] = useState(false);
  const [resizingKpVertical, setResizingKpVertical] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(LEFT_PANEL_DEFAULT);
  const [kpListHeight, setKpListHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!lowerVisible || selectedDocId == null) {
      setDocumentSummary('');
      setLoadingSummary(false);
      setPreviewError(null);
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
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
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    setPreviewBlobUrl(null);
    getDocumentPreviewByDocumentId(selectedDocId)
      .then((base64) => {
        if (!base64) {
          setPreviewError('Preview not available');
          return;
        }
        try {
          const bin = atob(base64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          if (previewBlobUrlRef.current) URL.revokeObjectURL(previewBlobUrlRef.current);
          previewBlobUrlRef.current = url;
          setPreviewBlobUrl(url);
        } catch {
          setPreviewError('Preview failed');
        }
      })
      .catch(() => setPreviewError('Preview failed'))
      .finally(() => setLoadingPreview(false));
    return () => {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
    };
  }, [lowerVisible, selectedDocId]);

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
    if (!lowerVisible) setLowerVisible(true);
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
      const maxW = el ? el.clientWidth - LEFT_PANEL_HANDLE_WIDTH - RIGHT_PANEL_MIN : next + 1;
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
    const currentTop = kpListHeight ?? (kpTopPanelRef.current?.offsetHeight ?? 200);
    startYKpRef.current = e.clientY;
    startHeightKpRef.current = currentTop;
    setKpListHeight(currentTop);
    setResizingKpVertical(true);
  };

  useEffect(() => {
    saveFileMeta(fileMeta);
  }, [fileMeta]);

  useEffect(() => {
    saveExcludedDirs(excludedDirIds);
  }, [excludedDirIds]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      const processing = documents.filter(
        (d) => d.processingStatus === 'pending' || d.processingStatus === 'processing'
      );
      if (processing.length > 0) {
        loadDocuments();
        if (selectedDocId) loadKnowledgePoints();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [documents.map((d) => d.processingStatus).join(',')]);

  const selectedDocIdRef = useRef<number | null>(selectedDocId);
  useEffect(() => {
    selectedDocIdRef.current = selectedDocId;
  }, [selectedDocId]);

  useEffect(() => {
    if (selectedDocId == null) {
      setKnowledgePoints([]);
      setKpTotal(0);
      setKpPage(1);
      setSelectedKp(null);
      setHighlightedKeywords([]);
      return;
    }
    setKnowledgePoints([]);
    setKpTotal(0);
    setKpPage(1);
    setSelectedKp(null);
    setHighlightedKeywords([]);
    const docId = selectedDocId;
    getKnowledgePoints(1, kpPageSize, docId)
      .then((data) => {
        if (selectedDocIdRef.current !== docId) return;
        setKnowledgePoints(data.knowledge_points ?? []);
        setKpTotal(data.total ?? 0);
      })
      .catch(() => {
        if (selectedDocIdRef.current !== docId) return;
        setKnowledgePoints([]);
        setKpTotal(0);
      });
  }, [selectedDocId, kpPageSize]);

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
    if (selectedDocId == null) return;
    const docId = selectedDocId;
    try {
      const data = await getKnowledgePoints(kpPage, kpPageSize, docId);
      if (selectedDocIdRef.current !== docId) return;
      setKnowledgePoints(data.knowledge_points ?? []);
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

  const getCurrentItems = (): DirectoryNode[] => {
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
  };

  const getBreadcrumbs = (): { id: number | null; name: string }[] => {
    if (currentDirId === null) return [{ id: null, name: 'Root' }];
    const crumbs: { id: number; name: string }[] = [];
    let id: number | null | undefined = currentDirId;
    const findNode = (nodes: DirectoryNode[]): DirectoryNode | null => {
      for (const n of nodes) {
        if (n.id === id && n.type === 'directory') return n;
        if (n.children) {
          const found = findNode(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    while (id) {
      const node = findNode(directoryTree);
      if (node) {
        crumbs.unshift({ id: node.id, name: node.name });
        id = node.parentId;
      } else break;
    }
    return [{ id: null, name: 'Root' }, ...crumbs];
  };

  const currentItems = getCurrentItems();
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

  const handleKpContentMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString?.()?.trim();
    if (text && !highlightedKeywords.includes(text)) {
      setHighlightedKeywords((prev) => [...prev, text]);
    }
  };

  const removeKeyword = (index: number) => {
    setHighlightedKeywords((prev) => prev.filter((_, i) => i !== index));
  };

  const breadcrumbs = getBreadcrumbs();
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
      <div className="dc-upper-top">
        <span className="dc-upper-top-label">{t('knowledgeBaseWorkspace.directory')}</span>
        <span className="dc-upper-top-brackets">
          {breadcrumbs.map((crumb) => (
            <button
              key={crumb.id ?? 'root'}
              type="button"
              className={`dc-upper-top-tag ${currentDirId === crumb.id ? 'dc-upper-top-tag-selected' : ''}`}
              onClick={() => setCurrentDirId(crumb.id)}
              aria-pressed={currentDirId === crumb.id}
            >
              [ {crumb.name} ]
            </button>
          ))}
        </span>
      </div>
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
            <div className="dc-toolbar">
              <button type="button" onClick={handleFileSelect} disabled={isUploading} className="dc-btn dc-btn-primary">
                {isUploading ? t('dataCenter.processing') : t('dataCenter.uploadFile')}
              </button>
              {!isCreatingDir ? (
                <button type="button" onClick={() => setIsCreatingDir(true)} className="dc-btn">
                  {t('dataCenter.newFolder')}
                </button>
              ) : (
                <div className="dc-new-folder">
                  <input
                    type="text"
                    value={newDirName}
                    onChange={(e) => setNewDirName(e.target.value)}
                    placeholder={t('dataCenter.folderName')}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateDirectory()}
                    className="dc-input"
                  />
                  <button type="button" onClick={handleCreateDirectory} className="dc-btn dc-btn-small">
                    {t('common.ok')}
                  </button>
                  <button type="button" onClick={() => { setIsCreatingDir(false); setNewDirName(''); }} className="dc-btn dc-btn-small">
                    {t('common.cancel')}
                  </button>
                </div>
              )}
              {uploadProgress && <span className="dc-upload-status">{uploadProgress}</span>}
            </div>
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
                              onMouseDown={(e) => handleFileWeightMouseDown(item.id, weight, e)}
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
                                    &#x25BC;
                                  </button>
                                </Tooltip>
                                <span className="dc-file-item-tags">
                                  {meta.tags.map((tag) => (
                                    <span key={tag} className="dc-file-tag">
                                      {tag}
                                      <button
                                        type="button"
                                        className="dc-file-tag-remove"
                                        onClick={() => updateMeta(item.id, { tags: meta.tags.filter((t) => t !== tag) })}
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
                                      handleDeleteClick(item.id, item.name, e);
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
          </div>
          <div
            className="dc-resize-handle-h"
            role="separator"
            aria-label="Resize"
            onMouseDown={onResizeHorizontalStart}
          />
          <div className="dc-upper-left-right" ref={upperLeftRightRef}>
            <div
              ref={kpTopPanelRef}
              className="dc-upper-left-right-top dc-cli-panel"
              style={
                kpListHeight != null
                  ? { height: kpListHeight, flexShrink: 0 }
                  : undefined
              }
            >
              <div className="dc-kp-list-title-bar">
                <span className="dc-kp-list-title">
                  {selectedDoc
                    ? `${t('dataCenter.knowledgePointsList')} (${kpTotal})`
                    : t('dataCenter.selectDocumentForKp')}
                </span>
                {selectedDocId != null && !lowerVisible && (
                  <Tooltip title={t('knowledgeBaseWorkspace.documentPreview')}>
                    <button
                      type="button"
                      className="dc-kp-preview-icon-btn"
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
                          const isSelected = selectedKp === kp;
                          const isDeleted = kp.excluded || (kp.id != null && deletedKpIds.has(kp.id));
                          const contentText = (kp.content || '').trim();
                          return (
                            <li
                              key={kp.id ?? `kp-${kp.document_id}-${kp.chunk_index}-${idx}`}
                              className={`dc-kp-item ${isSelected ? 'dc-kp-item-selected' : ''} ${isDeleted ? 'dc-kp-item-deleted' : ''}`}
                              role="option"
                              aria-selected={isSelected}
                              aria-label={isDeleted ? t('knowledgeBaseWorkspace.deletedState') : undefined}
                              onClick={() => { setSelectedKp(isSelected ? null : kp); setHighlightedKeywords([]); }}
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
                                onMouseDown={(e) => kp.id != null && handleKpWeightMouseDown(kp, weight, e)}
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
                    <p className="dc-kp-detail-select-hint">{t('knowledgeBaseWorkspace.selectTextToAddKeyword')}</p>
                    <div
                      className="dc-kp-detail-content"
                      onMouseUp={handleKpContentMouseUp}
                      role="article"
                    >
                      {selectedKp.content}
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
                                  onClick={() => removeKeyword(i)}
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
