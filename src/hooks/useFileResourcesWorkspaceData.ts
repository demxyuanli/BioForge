import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getDocuments,
  getMountPoints,
  createMountPoint,
  updateMountPoint,
  deleteMountPoint,
  getMountPointDocumentStats,
  getMountPointFiles,
  updateMountPointFileMeta,
  getRecentAnnotatedFiles,
  selectFolder,
  getDirectories,
  importFileToDataCenter,
  type Document,
  type MountPoint,
  type MountPointDocumentStats,
  type MountPointFiles,
  type RecentAnnotatedFileItem,
  type DirectoryNode,
} from '../services/api';
import { MOUNT_POINTS_CHANGED_EVENT, DOCUMENTS_CHANGED_EVENT } from '../components/layout/FileExplorer';

export type SelectedFile = { mpId: number; relativePath: string; filename: string; ext: string };
export type SearchResultItem = { rowKey: string; filename: string; path: string; ext: string; mp: MountPoint };

export type FlatDirItem = { id: number; name: string; depth: number };

export interface UseFileResourcesWorkspaceDataReturn {
  mountPoints: MountPoint[];
  selectedMp: MountPoint | null;
  setSelectedMp: React.Dispatch<React.SetStateAction<MountPoint | null>>;
  editDescription: string;
  setEditDescription: React.Dispatch<React.SetStateAction<string>>;
  savingDesc: boolean;
  addingMp: boolean;
  docStats: MountPointDocumentStats | null;
  loadingDocStats: boolean;
  statsByMpId: Map<number, MountPointDocumentStats>;
  removeError: string | null;
  removing: boolean;
  mountPointFiles: MountPointFiles | null;
  loadingMountPointFiles: boolean;
  allMountPointFiles: Map<number, MountPointFiles>;
  descriptionExpanded: boolean;
  setDescriptionExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  filterByExt: string | null;
  setFilterByExt: React.Dispatch<React.SetStateAction<string | null>>;
  expandedNoteRowKey: string | null;
  setExpandedNoteRowKey: React.Dispatch<React.SetStateAction<string | null>>;
  fileWeights: Record<string, number>;
  fileNotes: Record<string, string>;
  setFileNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  savingNoteRowKey: string | null;
  weightDragging: { rowKey: string; value: number } | null;
  recentAnnotated: RecentAnnotatedFileItem[];
  editingMpId: number | null;
  setEditingMpId: React.Dispatch<React.SetStateAction<number | null>>;
  editingName: string;
  setEditingName: React.Dispatch<React.SetStateAction<string>>;
  selectedFile: SelectedFile | null;
  setSelectedFile: React.Dispatch<React.SetStateAction<SelectedFile | null>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  flattenedFiles: { ext: string; path: string; filename: string }[];
  filteredFiles: { ext: string; path: string; filename: string }[];
  searchResults: SearchResultItem[];
  allFlattenedFiles: { mpId: number; mp: MountPoint; ext: string; path: string; filename: string; rowKey: string }[];
  getWeightForRow: (rowKey: string) => number;
  handleWeightMouseDown: (rowKey: string, relPath: string, currentWeight: number, el: HTMLSpanElement | null) => void;
  handleAddMountPoint: () => Promise<void>;
  handleSaveDescription: () => Promise<void>;
  handleSaveMountName: (mp: MountPoint) => Promise<void>;
  handleSaveNote: (rowKey: string, relPath: string, note: string) => void;
  handleRemoveMountPoint: (mp?: MountPoint | null) => Promise<void>;
  importDialogOpen: boolean;
  setImportDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  importTargetDirId: number | null;
  setImportTargetDirId: React.Dispatch<React.SetStateAction<number | null>>;
  dcDirectories: DirectoryNode[];
  loadingDcDirs: boolean;
  importingFile: boolean;
  importMessage: { type: 'success' | 'error'; text: string } | null;
  flatDcDirs: FlatDirItem[];
  handleOpenImportDialog: () => Promise<void>;
  handleConfirmImport: () => Promise<void>;
  weightSliderRef: React.RefObject<HTMLSpanElement | null>;
  weightDragValueRef: React.MutableRefObject<number>;
  weightDragRowRef: React.MutableRefObject<{ rowKey: string; relPath: string } | null>;
}

export function useFileResourcesWorkspaceData(): UseFileResourcesWorkspaceDataReturn {
  const { t } = useTranslation();
  const [, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mountPoints, setMountPoints] = useState<MountPoint[]>([]);
  const [selectedMp, setSelectedMp] = useState<MountPoint | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);
  const [addingMp, setAddingMp] = useState(false);
  const [docStats, setDocStats] = useState<MountPointDocumentStats | null>(null);
  const [loadingDocStats, setLoadingDocStats] = useState(false);
  const [statsByMpId, setStatsByMpId] = useState<Map<number, MountPointDocumentStats>>(new Map());
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [mountPointFiles, setMountPointFiles] = useState<MountPointFiles | null>(null);
  const [loadingMountPointFiles, setLoadingMountPointFiles] = useState(false);
  const [allMountPointFiles, setAllMountPointFiles] = useState<Map<number, MountPointFiles>>(new Map());
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [filterByExt, setFilterByExt] = useState<string | null>(null);
  const [expandedNoteRowKey, setExpandedNoteRowKey] = useState<string | null>(null);
  const [fileWeights, setFileWeights] = useState<Record<string, number>>({});
  const [fileNotes, setFileNotes] = useState<Record<string, string>>({});
  const [savingNoteRowKey, setSavingNoteRowKey] = useState<string | null>(null);
  const [weightDragging, setWeightDragging] = useState<{ rowKey: string; value: number } | null>(null);
  const weightSliderRef = useRef<HTMLSpanElement | null>(null);
  const weightDragValueRef = useRef<number>(0);
  const weightDragRowRef = useRef<{ rowKey: string; relPath: string } | null>(null);
  const [recentAnnotated, setRecentAnnotated] = useState<RecentAnnotatedFileItem[]>([]);
  const [editingMpId, setEditingMpId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importTargetDirId, setImportTargetDirId] = useState<number | null>(null);
  const [dcDirectories, setDcDirectories] = useState<DirectoryNode[]>([]);
  const [loadingDcDirs, setLoadingDcDirs] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    getDocuments().then(setDocuments).catch(() => setDocuments([]));
  }, []);

  const refreshMountPoints = useCallback(() => {
    getMountPoints()
      .then((list) => {
        const byId = new Map(list.map((mp) => [mp.id, mp]));
        setMountPoints(Array.from(byId.values()));
      })
      .catch(() => setMountPoints([]));
  }, []);

  useEffect(() => {
    refreshMountPoints();
    const timeout = setTimeout(refreshMountPoints, 800);
    return () => clearTimeout(timeout);
  }, [refreshMountPoints]);

  useEffect(() => {
    if (mountPoints.length === 0) {
      setStatsByMpId(new Map());
      return;
    }
    const aborted = { current: false };
    Promise.all(
      mountPoints.map((mp) =>
        getMountPointDocumentStats(mp.id).then((stats) => ({ id: mp.id, stats }))
      )
    )
      .then((results) => {
        if (aborted.current) return;
        const next = new Map<number, MountPointDocumentStats>();
        for (const { id, stats } of results) {
          next.set(id, stats);
        }
        setStatsByMpId(next);
      })
      .catch(() => {
        if (!aborted.current) setStatsByMpId(new Map());
      });
    return () => {
      aborted.current = true;
    };
  }, [mountPoints]);

  useEffect(() => {
    const onFocus = () => refreshMountPoints();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshMountPoints]);

  useEffect(() => {
    const handler = () => refreshMountPoints();
    window.addEventListener(MOUNT_POINTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MOUNT_POINTS_CHANGED_EVENT, handler);
  }, [refreshMountPoints]);

  useEffect(() => {
    if (selectedMp) {
      setEditDescription(selectedMp.description);
      setRemoveError(null);
      setFilterByExt(null);
    } else {
      setDocStats(null);
    }
  }, [selectedMp]);

  useEffect(() => {
    if (selectedFile && selectedMp && selectedFile.mpId !== selectedMp.id) {
      setSelectedFile(null);
    }
  }, [selectedMp?.id, selectedFile?.mpId]);

  useEffect(() => {
    if (selectedMp == null) return;
    setLoadingDocStats(true);
    setDocStats(null);
    getMountPointDocumentStats(selectedMp.id)
      .then(setDocStats)
      .catch(() => setDocStats(null))
      .finally(() => setLoadingDocStats(false));
  }, [selectedMp?.id]);

  useEffect(() => {
    if (selectedMp == null) {
      setMountPointFiles(null);
      return;
    }
    setLoadingMountPointFiles(true);
    setMountPointFiles(null);
    getMountPointFiles(selectedMp.id)
      .then((data) => {
        setMountPointFiles(data);
        const weights: Record<string, number> = {};
        const notes: Record<string, string> = {};
        const byType = data.by_type || {};
        const fileMeta = data.file_meta || {};
        for (const [ext, paths] of Object.entries(byType)) {
          for (const path of paths) {
            const rowKey = `${ext}:${path}`;
            weights[rowKey] = fileMeta[path]?.weight ?? 0;
            notes[rowKey] = fileMeta[path]?.note ?? '';
          }
        }
        setFileWeights(weights);
        setFileNotes(notes);
      })
      .catch(() => setMountPointFiles(null))
      .finally(() => setLoadingMountPointFiles(false));
  }, [selectedMp?.id]);

  useEffect(() => {
    if (mountPoints.length === 0) {
      setAllMountPointFiles(new Map());
      return;
    }
    const aborted = { current: false };
    Promise.all(
      mountPoints.map((mp) =>
        getMountPointFiles(mp.id).then((data) => ({ id: mp.id, data }))
      )
    )
      .then((results) => {
        if (aborted.current) return;
        const next = new Map<number, MountPointFiles>();
        for (const { id, data } of results) {
          next.set(id, data);
        }
        setAllMountPointFiles(next);
      })
      .catch(() => {
        if (!aborted.current) setAllMountPointFiles(new Map());
      });
    return () => {
      aborted.current = true;
    };
  }, [mountPoints]);

  const flattenedFiles = useMemo(() => {
    if (!mountPointFiles?.by_type) return [];
    const list: { ext: string; path: string; filename: string }[] = [];
    for (const [ext, paths] of Object.entries(mountPointFiles.by_type)) {
      for (const path of paths) {
        const i = path.replace(/\\/g, '/').lastIndexOf('/');
        const filename = i >= 0 ? path.slice(i + 1) : path;
        list.push({ ext, path, filename });
      }
    }
    return list;
  }, [mountPointFiles]);

  const allFlattenedFiles = useMemo(() => {
    const list: {
      mpId: number;
      mp: MountPoint;
      ext: string;
      path: string;
      filename: string;
      rowKey: string;
    }[] = [];
    const mpById = new Map(mountPoints.map((mp) => [mp.id, mp]));
    allMountPointFiles.forEach((data, mpId) => {
      const mp = mpById.get(mpId);
      if (!mp || !data.by_type) return;
      for (const [ext, paths] of Object.entries(data.by_type)) {
        for (const path of paths) {
          const i = path.replace(/\\/g, '/').lastIndexOf('/');
          const filename = i >= 0 ? path.slice(i + 1) : path;
          list.push({
            mpId,
            mp,
            ext,
            path,
            filename,
            rowKey: `${mpId}:${ext}:${path}`,
          });
        }
      }
    });
    return list;
  }, [mountPoints, allMountPointFiles]);

  const searchResults = useMemo((): SearchResultItem[] => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return [];
    return allFlattenedFiles
      .filter(
        (f) =>
          f.filename.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
      )
      .map((f) => ({
        rowKey: f.rowKey,
        filename: f.filename,
        path: f.path,
        ext: f.ext,
        mp: f.mp,
      }));
  }, [searchQuery, allFlattenedFiles]);

  const loadRecentAnnotated = useCallback(() => {
    getRecentAnnotatedFiles().then(setRecentAnnotated).catch(() => setRecentAnnotated([]));
  }, []);

  useEffect(() => {
    loadRecentAnnotated();
  }, [loadRecentAnnotated]);

  useEffect(() => {
    const handler = () => loadRecentAnnotated();
    window.addEventListener(MOUNT_POINTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MOUNT_POINTS_CHANGED_EVENT, handler);
  }, [loadRecentAnnotated]);

  const filteredFiles = useMemo(() => {
    if (!filterByExt) return flattenedFiles;
    return flattenedFiles.filter((f) => f.ext === filterByExt);
  }, [flattenedFiles, filterByExt]);

  const getWeightForRow = useCallback(
    (rowKey: string) => {
      if (weightDragging?.rowKey === rowKey) return weightDragging.value;
      return fileWeights[rowKey] ?? 0;
    },
    [fileWeights, weightDragging]
  );

  const handleWeightMouseDown = useCallback(
    (
      rowKey: string,
      relPath: string,
      currentWeight: number,
      el: HTMLSpanElement | null
    ) => {
      if (!selectedMp || !el) return;
      weightSliderRef.current = el;
      weightDragValueRef.current = currentWeight;
      weightDragRowRef.current = { rowKey, relPath };
      setWeightDragging({ rowKey, value: currentWeight });
      const onMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const w = rect.width;
        let v = 0;
        if (w > 0) {
          const p = Math.max(0, Math.min(1, x / w));
          v = Math.round(p * 5);
          v = Math.max(0, Math.min(5, v));
        }
        weightDragValueRef.current = v;
        setWeightDragging((prev) =>
          prev?.rowKey === rowKey ? { rowKey, value: v } : prev
        );
      };
      const onUp = () => {
        const value = weightDragValueRef.current;
        const row = weightDragRowRef.current;
        setWeightDragging(null);
        weightSliderRef.current = null;
        weightDragRowRef.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (row) {
          setFileWeights((prev) => ({ ...prev, [row.rowKey]: value }));
          updateMountPointFileMeta(selectedMp.id, row.relPath, { weight: value }).catch(
            () => {}
          );
        }
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [selectedMp]
  );

  const handleAddMountPoint = useCallback(async () => {
    const path = await selectFolder();
    if (!path?.trim()) return;
    setAddingMp(true);
    try {
      const created = await createMountPoint(path);
      setMountPoints((prev) => {
        const byId = new Map(prev.map((mp) => [mp.id, mp]));
        byId.set(created.id, created);
        return Array.from(byId.values());
      });
      setSelectedMp(created);
      window.dispatchEvent(new CustomEvent(MOUNT_POINTS_CHANGED_EVENT));
    } catch (e) {
      console.error('Create mount point failed:', e);
    } finally {
      setAddingMp(false);
    }
  }, []);

  const handleSaveDescription = useCallback(async () => {
    if (selectedMp == null) return;
    setSavingDesc(true);
    try {
      const updated = await updateMountPoint(selectedMp.id, {
        description: editDescription,
      });
      setMountPoints((prev) =>
        prev.map((mp) => (mp.id === updated.id ? updated : mp))
      );
      setSelectedMp(updated);
    } catch (e) {
      console.error('Update mount point description failed:', e);
    } finally {
      setSavingDesc(false);
    }
  }, [selectedMp, editDescription]);

  const handleSaveMountName = useCallback(async (mp: MountPoint) => {
    const name = (editingName || '').trim() || undefined;
    setEditingMpId(null);
    setEditingName('');
    try {
      const updated = await updateMountPoint(mp.id, { name: name ?? undefined });
      setMountPoints((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m))
      );
      if (selectedMp?.id === mp.id) setSelectedMp(updated);
    } catch (e) {
      console.error('Update mount point name failed:', e);
    }
  }, [editingName, selectedMp]);

  const handleSaveNote = useCallback(
    (rowKey: string, relPath: string, note: string) => {
      if (selectedMp == null) return;
      setSavingNoteRowKey(rowKey);
      updateMountPointFileMeta(selectedMp.id, relPath, { note })
        .then(() => {
          setFileNotes((prev) => ({ ...prev, [rowKey]: note }));
          loadRecentAnnotated();
        })
        .finally(() => setSavingNoteRowKey(null));
    },
    [selectedMp, loadRecentAnnotated]
  );

  const flattenDirs = useCallback(
    (
      nodes: DirectoryNode[],
      depth = 0
    ): { id: number; name: string; depth: number }[] => {
      const result: { id: number; name: string; depth: number }[] = [];
      for (const node of nodes) {
        if (node.type === 'directory') {
          result.push({ id: node.id, name: node.name, depth });
          if (node.children) {
            result.push(...flattenDirs(node.children, depth + 1));
          }
        }
      }
      return result;
    },
    []
  );

  const flatDcDirs = useMemo(
    () => flattenDirs(dcDirectories),
    [dcDirectories, flattenDirs]
  );

  const handleOpenImportDialog = useCallback(async () => {
    if (!selectedFile || !selectedMp) return;
    setImportDialogOpen(true);
    setImportTargetDirId(null);
    setImportMessage(null);
    setLoadingDcDirs(true);
    try {
      const dirs = await getDirectories();
      setDcDirectories(dirs);
    } catch {
      setDcDirectories([]);
    } finally {
      setLoadingDcDirs(false);
    }
  }, [selectedFile, selectedMp]);

  const handleConfirmImport = useCallback(async () => {
    if (!selectedFile || !selectedMp) return;
    setImportingFile(true);
    setImportMessage(null);
    try {
      await importFileToDataCenter(
        selectedMp.path,
        selectedFile.relativePath,
        importTargetDirId
      );
      window.dispatchEvent(new CustomEvent(DOCUMENTS_CHANGED_EVENT));
      setImportMessage({
        type: 'success',
        text: t('fileResourcesWorkspace.importSuccess'),
      });
      setTimeout(() => {
        setImportDialogOpen(false);
        setImportMessage(null);
      }, 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setImportMessage({
        type: 'error',
        text: `${t('fileResourcesWorkspace.importFailed')}: ${msg}`,
      });
    } finally {
      setImportingFile(false);
    }
  }, [selectedFile, selectedMp, importTargetDirId, t]);

  const handleRemoveMountPoint = useCallback(
    async (mp?: MountPoint | null) => {
      const target = mp ?? selectedMp;
      if (target == null) return;
      if (!window.confirm(t('fileResourcesWorkspace.confirmRemoveMountPoint')))
        return;
      setRemoveError(null);
      setRemoving(true);
      const idToDelete = Number(target.id);
      try {
        await deleteMountPoint(idToDelete);
        setMountPoints((prev) =>
          prev.filter((m) => Number(m.id) !== idToDelete)
        );
        if (selectedMp?.id === idToDelete) setSelectedMp(null);
        setStatsByMpId((prev) => {
          const next = new Map(prev);
          next.delete(idToDelete);
          return next;
        });
        setEditingMpId((id) => (id === idToDelete ? null : id));
        window.dispatchEvent(new CustomEvent(MOUNT_POINTS_CHANGED_EVENT));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setRemoveError(msg);
        console.error('Delete mount point failed:', e);
      } finally {
        setRemoving(false);
      }
    },
    [selectedMp, t]
  );

  return {
    mountPoints,
    selectedMp,
    setSelectedMp,
    editDescription,
    setEditDescription,
    savingDesc,
    addingMp,
    docStats,
    loadingDocStats,
    statsByMpId,
    removeError,
    removing,
    mountPointFiles,
    loadingMountPointFiles,
    allMountPointFiles,
    descriptionExpanded,
    setDescriptionExpanded,
    filterByExt,
    setFilterByExt,
    expandedNoteRowKey,
    setExpandedNoteRowKey,
    fileWeights,
    fileNotes,
    setFileNotes,
    savingNoteRowKey,
    weightDragging,
    recentAnnotated,
    editingMpId,
    setEditingMpId,
    editingName,
    setEditingName,
    selectedFile,
    setSelectedFile,
    searchQuery,
    setSearchQuery,
    flattenedFiles,
    filteredFiles,
    searchResults,
    allFlattenedFiles,
    getWeightForRow,
    handleWeightMouseDown,
    handleAddMountPoint,
    handleSaveDescription,
    handleSaveMountName,
    handleSaveNote,
    handleRemoveMountPoint,
    importDialogOpen,
    setImportDialogOpen,
    importTargetDirId,
    setImportTargetDirId,
    dcDirectories,
    loadingDcDirs,
    importingFile,
    importMessage,
    flatDcDirs,
    handleOpenImportDialog,
    handleConfirmImport,
    weightSliderRef,
    weightDragValueRef,
    weightDragRowRef,
  };
}
