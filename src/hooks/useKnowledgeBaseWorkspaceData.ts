import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getDocuments,
  getDirectories,
  getKnowledgePoints,
  updateKnowledgePointWeight,
  updateKnowledgePointExcluded,
  getKnowledgePointKeywords,
  addKnowledgePointKeyword,
  removeKnowledgePointKeyword,
  searchFulltext,
  type Document,
  type DirectoryNode,
  type KnowledgePoint,
  type FulltextSearchHit,
} from '../services/api';
import { loadFileMeta, saveFileMeta, type FileMetaItem } from '../utils/fileMeta';

const KP_PAGE_SIZE = 50;

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

export interface UseKnowledgeBaseWorkspaceDataReturn {
  documents: Document[];
  directoryTree: DirectoryNode[];
  selectedDirId: number | null;
  setSelectedDirId: React.Dispatch<React.SetStateAction<number | null>>;
  selectedDocId: number | null;
  setSelectedDocId: React.Dispatch<React.SetStateAction<number | null>>;
  knowledgePoints: KnowledgePoint[];
  setKnowledgePoints: React.Dispatch<React.SetStateAction<KnowledgePoint[]>>;
  kpPage: number;
  setKpPage: React.Dispatch<React.SetStateAction<number>>;
  kpTotal: number;
  kpTotalPages: number;
  selectedKp: KnowledgePoint | null;
  setSelectedKp: React.Dispatch<React.SetStateAction<KnowledgePoint | null>>;
  fileMeta: Record<number, FileMetaItem>;
  setFileMeta: React.Dispatch<React.SetStateAction<Record<number, FileMetaItem>>>;
  getMeta: (docId: number) => FileMetaItem;
  updateMeta: (docId: number, patch: Partial<FileMetaItem>) => void;
  topLevelDirs: DirectoryNode[];
  topLevelItems: DirectoryNode[];
  selectedDirChildren: DirectoryNode[];
  fileListInDir: Array<{ id: number; name: string; type: 'file'; processed?: boolean; knowledgePointCount?: number }>;
  displayFileList: Array<{ id: number; name: string; type: 'file'; processed?: boolean; knowledgePointCount?: number }>;
  searchResults: Document[];
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  selectedDoc: Document | null;
  loadKnowledgePoints: () => void;
  contentSearchResults: FulltextSearchHit[];
  setContentSearchResults: React.Dispatch<React.SetStateAction<FulltextSearchHit[]>>;
  contentSearching: boolean;
  contentSearchError: string | null;
  setContentSearchError: React.Dispatch<React.SetStateAction<string | null>>;
  handleContentSearch: () => Promise<void>;
  handleContentSearchResultClick: (hit: FulltextSearchHit) => void;
  expandedNoteDocId: number | null;
  setExpandedNoteDocId: React.Dispatch<React.SetStateAction<number | null>>;
  addTagDocId: number | null;
  setAddTagDocId: React.Dispatch<React.SetStateAction<number | null>>;
  addTagInput: string;
  setAddTagInput: React.Dispatch<React.SetStateAction<string>>;
  deletedKpIds: Set<number>;
  kpWeightDragging: { kpId: number; value: number } | null;
  setKpWeightDragging: React.Dispatch<React.SetStateAction<{ kpId: number; value: number } | null>>;
  highlightedKeywords: string[];
  setHighlightedKeywords: React.Dispatch<React.SetStateAction<string[]>>;
  onKpWeightChange: (kp: KnowledgePoint, weight: number) => void;
  handleKpWeightMouseDown: (kp: KnowledgePoint, currentWeight: number, e: React.MouseEvent) => void;
  onKpSetDeleted: (kp: KnowledgePoint, deleted: boolean, e: React.MouseEvent) => void;
  onKpDelete: (kp: KnowledgePoint, e: React.MouseEvent) => void;
  onKpRestore: (kp: KnowledgePoint, e: React.MouseEvent) => void;
  onSelectFile: (id: number) => void;
  loadKeywords: (kpId: number) => Promise<void>;
  handleKpContentMouseUp: () => Promise<void>;
  removeHighlightedKeyword: (index: number) => Promise<void>;
  kpWeightSliderRef: React.RefObject<HTMLSpanElement | null>;
  kpWeightDragValueRef: React.MutableRefObject<number>;
  kpWeightDragKpRef: React.MutableRefObject<KnowledgePoint | null>;
}

export function useKnowledgeBaseWorkspaceData(): UseKnowledgeBaseWorkspaceDataReturn {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [directoryTree, setDirectoryTree] = useState<DirectoryNode[]>([]);
  const [selectedDirId, setSelectedDirId] = useState<number | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [kpPage, setKpPage] = useState(1);
  const [kpTotal, setKpTotal] = useState(0);
  const [selectedKp, setSelectedKp] = useState<KnowledgePoint | null>(null);
  const [fileMeta, setFileMeta] = useState<Record<number, FileMetaItem>>(loadFileMeta);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNoteDocId, setExpandedNoteDocId] = useState<number | null>(null);
  const [addTagDocId, setAddTagDocId] = useState<number | null>(null);
  const [addTagInput, setAddTagInput] = useState('');
  const [deletedKpIds, setDeletedKpIds] = useState<Set<number>>(new Set());
  const [kpWeightDragging, setKpWeightDragging] = useState<{ kpId: number; value: number } | null>(null);
  const [highlightedKeywords, setHighlightedKeywords] = useState<string[]>([]);
  const [contentSearchResults, setContentSearchResults] = useState<FulltextSearchHit[]>([]);
  const [contentSearching, setContentSearching] = useState(false);
  const [contentSearchError, setContentSearchError] = useState<string | null>(null);

  const selectedDocIdRef = useRef<number | null>(selectedDocId);
  const kpPageRef = useRef(kpPage);
  const kpWeightSliderRef = useRef<HTMLSpanElement | null>(null);
  const kpWeightDragValueRef = useRef(1);
  const kpWeightDragKpRef = useRef<KnowledgePoint | null>(null);

  useEffect(() => {
    saveFileMeta(fileMeta);
  }, [fileMeta]);

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

  useEffect(() => {
    selectedDocIdRef.current = selectedDocId;
  }, [selectedDocId]);

  useEffect(() => {
    kpPageRef.current = kpPage;
  }, [kpPage]);

  const topLevelDirs = useMemo(() => {
    return directoryTree.filter(
      (n) => n.type === 'directory' && !n.parentId && !n.directoryId
    );
  }, [directoryTree]);

  const topLevelItems = useMemo(() => {
    return directoryTree.filter((n) => !n.parentId && !n.directoryId);
  }, [directoryTree]);

  const selectedDirChildren = useMemo(() => {
    if (selectedDirId == null) return [];
    const node = findNodeInTree(directoryTree, selectedDirId);
    const fromChildren = node?.children;
    if (fromChildren?.length) return fromChildren;
    return directoryTree.filter(
      (n) => n.parentId === selectedDirId || n.directoryId === selectedDirId
    );
  }, [directoryTree, selectedDirId]);

  type FileListItem = { id: number; name: string; type: 'file'; processed?: boolean; knowledgePointCount?: number };

  const fileListInDir = useMemo((): FileListItem[] => {
    const fromTree = selectedDirId == null ? topLevelItems : selectedDirChildren;
    const filesFromTree = fromTree.filter((n) => n.type === 'file');
    if (filesFromTree.length > 0) {
      return filesFromTree.map((n) => ({
        id: n.id,
        name: n.name,
        type: 'file' as const,
        processed: n.processed,
        knowledgePointCount: n.knowledgePointCount,
      }));
    }
    if (selectedDirId == null) {
      return documents.map((d) => ({
        id: d.id,
        name: d.filename,
        type: 'file' as const,
        processed: d.processed,
        knowledgePointCount: d.knowledgePointCount,
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

  const loadKnowledgePoints = useCallback(() => {
    const docId = selectedDocIdRef.current;
    if (docId == null) return;
    const page = kpPageRef.current;
    getKnowledgePoints(page, KP_PAGE_SIZE, docId)
      .then((res) => {
        if (selectedDocIdRef.current !== docId) return;
        const raw = res.knowledge_points ?? [];
        setKnowledgePoints(raw);
        setKpTotal(res.total ?? 0);
      })
      .catch(() => {
        if (selectedDocIdRef.current !== docId) return;
        setKnowledgePoints([]);
        setKpTotal(0);
      });
  }, []);

  useEffect(() => {
    if (selectedDocId == null) return;
    kpPageRef.current = 1;
    loadKnowledgePoints();
  }, [selectedDocId, loadKnowledgePoints]);

  useEffect(() => {
    loadKnowledgePoints();
  }, [kpPage, loadKnowledgePoints]);

  const kpTotalPages = Math.max(1, Math.ceil(kpTotal / KP_PAGE_SIZE));

  function getMeta(docId: number): FileMetaItem {
    return fileMeta[docId] ?? { weight: 0, note: '', tags: [] };
  }

  function updateMeta(docId: number, patch: Partial<FileMetaItem>): void {
    setFileMeta((prev) => {
      const current = prev[docId] ?? { weight: 0, note: '', tags: [] };
      return { ...prev, [docId]: { ...current, ...patch } };
    });
  }

  const onKpWeightChange = useCallback((kp: KnowledgePoint, weight: number) => {
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
  }, []);

  const handleKpWeightMouseDown = useCallback(
    (kp: KnowledgePoint, currentWeight: number, e: React.MouseEvent) => {
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
                prev.map((p) =>
                  p.id === targetKp.id ? { ...p, weight: finalValue } : p
                )
              );
            })
            .catch(() => {});
        }
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    []
  );

  const onKpSetDeleted = useCallback(
    (kp: KnowledgePoint, deleted: boolean, e: React.MouseEvent) => {
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
    },
    []
  );

  const onKpDelete = useCallback(
    (kp: KnowledgePoint, e: React.MouseEvent) => onKpSetDeleted(kp, true, e),
    [onKpSetDeleted]
  );
  const onKpRestore = useCallback(
    (kp: KnowledgePoint, e: React.MouseEvent) => onKpSetDeleted(kp, false, e),
    [onKpSetDeleted]
  );

  const onSelectFile = useCallback((id: number) => {
    if (selectedDocId === id) {
      setSelectedDocId(null);
    } else {
      setSelectedDocId(id);
      setKpPage(1);
    }
  }, [selectedDocId]);

  const handleContentSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setContentSearching(true);
    setContentSearchResults([]);
    setContentSearchError(null);
    try {
      const { results } = await searchFulltext(q);
      setContentSearchResults(results);
    } catch (e) {
      console.error('Content search error:', e);
      const msg = e instanceof Error ? e.message : String(e);
      setContentSearchError(
        msg.includes('Not Found') || msg.includes('404')
          ? t('dataCenter.contentSearchUnavailable')
          : msg
      );
    } finally {
      setContentSearching(false);
    }
  }, [searchQuery, t]);

  const handleContentSearchResultClick = useCallback((hit: FulltextSearchHit) => {
    setSelectedDocId(hit.document_id);
    setContentSearchResults([]);
    setContentSearchError(null);
  }, []);

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
        processed: d.processed,
        knowledgePointCount: d.knowledgePointCount,
      }));
    }
    return fileListInDir;
  }, [searchQuery, searchResults, fileListInDir]);

  const selectedDoc = useMemo(
    () =>
      selectedDocId != null
        ? documents.find((d) => d.id === selectedDocId) ?? null
        : null,
    [documents, selectedDocId]
  );

  useEffect(() => {
    if (selectedKp?.id != null) {
      getKnowledgePointKeywords(selectedKp.id)
        .then((data) => setHighlightedKeywords(data.keywords ?? []))
        .catch(() => setHighlightedKeywords([]));
    } else {
      setHighlightedKeywords([]);
    }
  }, [selectedKp?.id]);

  const loadKeywords = useCallback(async (kpId: number) => {
    try {
      const data = await getKnowledgePointKeywords(kpId);
      setHighlightedKeywords(data.keywords ?? []);
    } catch (error) {
      console.error('Load keywords error:', error);
      setHighlightedKeywords([]);
    }
  }, []);

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

  return {
    documents,
    directoryTree,
    selectedDirId,
    setSelectedDirId,
    selectedDocId,
    setSelectedDocId,
    knowledgePoints,
    setKnowledgePoints,
    kpPage,
    setKpPage,
    kpTotal,
    kpTotalPages,
    selectedKp,
    setSelectedKp,
    fileMeta,
    setFileMeta,
    getMeta,
    updateMeta,
    topLevelDirs,
    topLevelItems,
    selectedDirChildren,
    fileListInDir,
    displayFileList,
    searchResults,
    searchQuery,
    setSearchQuery,
    selectedDoc,
    loadKnowledgePoints,
    contentSearchResults,
    setContentSearchResults,
    contentSearching,
    contentSearchError,
    setContentSearchError,
    handleContentSearch,
    handleContentSearchResultClick,
    expandedNoteDocId,
    setExpandedNoteDocId,
    addTagDocId,
    setAddTagDocId,
    addTagInput,
    setAddTagInput,
    deletedKpIds,
    kpWeightDragging,
    setKpWeightDragging,
    highlightedKeywords,
    setHighlightedKeywords,
    onKpWeightChange,
    handleKpWeightMouseDown,
    onKpSetDeleted,
    onKpDelete,
    onKpRestore,
    onSelectFile,
    loadKeywords,
    handleKpContentMouseUp,
    removeHighlightedKeyword,
    kpWeightSliderRef,
    kpWeightDragValueRef,
    kpWeightDragKpRef,
  };
}
