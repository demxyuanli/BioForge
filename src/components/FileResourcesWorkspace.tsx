import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from './Tooltip';
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
  getDocumentSummary,
  getDocumentPreview,
  selectFolder,
  type Document,
  type MountPoint,
  type MountPointDocumentStats,
  type MountPointFiles,
  type RecentAnnotatedFileItem,
} from '../services/api';
import { FolderPlus, Maximize2, Minimize2, Pencil, Trash2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import PdfViewer from './PdfViewer';
import { MOUNT_POINTS_CHANGED_EVENT } from './layout/FileExplorer';
import './FileResourcesWorkspace.css';


const FileResourcesWorkspace: React.FC = () => {
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
  type SelectedFile = { mpId: number; relativePath: string; filename: string; ext: string };
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [documentSummary, setDocumentSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewBlobUrlRef = useRef<string | null>(null);
  const [bottomHeightPercent, setBottomHeightPercent] = useState(38);
  const [previewMaximized, setPreviewMaximized] = useState(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);

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
    const t = setTimeout(refreshMountPoints, 800);
    return () => clearTimeout(t);
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
    ).then((results) => {
      if (aborted.current) return;
      const next = new Map<number, MountPointDocumentStats>();
      for (const { id, stats } of results) {
        next.set(id, stats);
      }
      setStatsByMpId(next);
    }).catch(() => {
      if (!aborted.current) setStatsByMpId(new Map());
    });
    return () => { aborted.current = true; };
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
    ).then((results) => {
      if (aborted.current) return;
      const next = new Map<number, MountPointFiles>();
      for (const { id, data } of results) {
        next.set(id, data);
      }
      setAllMountPointFiles(next);
    }).catch(() => {
      if (!aborted.current) setAllMountPointFiles(new Map());
    });
    return () => { aborted.current = true; };
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
    const list: { mpId: number; mp: MountPoint; ext: string; path: string; filename: string; rowKey: string }[] = [];
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
            rowKey: `${mpId}:${ext}:${path}`
          });
        }
      }
    });
    return list;
  }, [mountPoints, allMountPointFiles]);

  type SearchResultItem = { rowKey: string; filename: string; path: string; ext: string; mp: MountPoint };

  const searchResults = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return [] as SearchResultItem[];
    return allFlattenedFiles
      .filter((f) => f.filename.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
      .map((f) => ({
        rowKey: f.rowKey,
        filename: f.filename,
        path: f.path,
        ext: f.ext,
        mp: f.mp
      }));
  }, [searchQuery, allFlattenedFiles]);

  const loadRecentAnnotated = useCallback(() => {
    getRecentAnnotatedFiles().then(setRecentAnnotated).catch(() => setRecentAnnotated([]));
  }, []);

  useEffect(() => {
    loadRecentAnnotated();
  }, [loadRecentAnnotated]);

  useEffect(() => {
    if (!selectedFile) {
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
    getDocumentSummary(selectedFile.mpId, selectedFile.relativePath)
      .then((r) => setDocumentSummary(r.summary))
      .catch(() => setDocumentSummary(''))
      .finally(() => setLoadingSummary(false));
    setLoadingPreview(true);
    setPreviewError(null);
    previewBlobUrlRef.current = null;
    setPreviewBlobUrl(null);
    getDocumentPreview(selectedFile.mpId, selectedFile.relativePath)
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
  }, [selectedFile?.mpId, selectedFile?.relativePath]);

  useEffect(() => {
    const handler = () => loadRecentAnnotated();
    window.addEventListener(MOUNT_POINTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MOUNT_POINTS_CHANGED_EVENT, handler);
  }, [loadRecentAnnotated]);

  const filteredFiles = useMemo(() => {
    if (!filterByExt) return flattenedFiles;
    return flattenedFiles.filter((f) => f.ext === filterByExt);
  }, [flattenedFiles, filterByExt]);

  const getWeightForRow = useCallback((rowKey: string) => {
    if (weightDragging?.rowKey === rowKey) return weightDragging.value;
    return fileWeights[rowKey] ?? 0;
  }, [fileWeights, weightDragging]);

  const handleWeightMouseDown = useCallback((rowKey: string, relPath: string, currentWeight: number, el: HTMLSpanElement | null) => {
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
      setWeightDragging((prev) => (prev?.rowKey === rowKey ? { rowKey, value: v } : prev));
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
        updateMountPointFileMeta(selectedMp.id, row.relPath, { weight: value }).catch(() => {});
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [selectedMp]);

  const handleAddMountPoint = async () => {
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
  };

  const handleSaveDescription = async () => {
    if (selectedMp == null) return;
    setSavingDesc(true);
    try {
      const updated = await updateMountPoint(selectedMp.id, { description: editDescription });
      setMountPoints((prev) => prev.map((mp) => (mp.id === updated.id ? updated : mp)));
      setSelectedMp(updated);
    } catch (e) {
      console.error('Update mount point description failed:', e);
    } finally {
      setSavingDesc(false);
    }
  };

  const handleSaveMountName = async (mp: MountPoint) => {
    const name = (editingName || '').trim() || undefined;
    setEditingMpId(null);
    setEditingName('');
    try {
      const updated = await updateMountPoint(mp.id, { name: name ?? undefined });
      setMountPoints((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      if (selectedMp?.id === mp.id) setSelectedMp(updated);
    } catch (e) {
      console.error('Update mount point name failed:', e);
    }
  };

  const handleSaveNote = useCallback((rowKey: string, relPath: string, note: string) => {
    if (selectedMp == null) return;
    setSavingNoteRowKey(rowKey);
    updateMountPointFileMeta(selectedMp.id, relPath, { note })
      .then(() => {
        setFileNotes((prev) => ({ ...prev, [rowKey]: note }));
        loadRecentAnnotated();
      })
      .finally(() => setSavingNoteRowKey(null));
  }, [selectedMp, loadRecentAnnotated]);

  const handleBottomResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (moveEvent: MouseEvent) => {
      const el = workspaceRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const h = rect.height;
      if (h <= 0) return;
      const bottomEdge = rect.top + h;
      const bottomPx = bottomEdge - moveEvent.clientY;
      let pct = (bottomPx / h) * 100;
      pct = Math.max(15, Math.min(70, pct));
      setBottomHeightPercent(pct);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const handleRemoveMountPoint = async (mp?: MountPoint | null) => {
    const target = mp ?? selectedMp;
    if (target == null) return;
    if (!window.confirm(t('fileResourcesWorkspace.confirmRemoveMountPoint'))) return;
    setRemoveError(null);
    setRemoving(true);
    const idToDelete = Number(target.id);
    try {
      await deleteMountPoint(idToDelete);
      setMountPoints((prev) => prev.filter((m) => Number(m.id) !== idToDelete));
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
  };

  const workspace = (
    <div className={`fr-workspace ${previewMaximized ? 'fr-workspace-preview-maximized' : ''}`} ref={workspaceRef}>
      {!previewMaximized && (
      <div className="fr-workspace-top">
        <div className="fr-workspace-left">
          <div className="fr-attachment-list-section">
          <div className="fr-attachment-header">
            <div className="fr-section-title">{t('fileResourcesWorkspace.mountPointList')}</div>
            <div className="fr-mount-header-btns">
              <Tooltip title={t('fileResourcesWorkspace.addMountPoint')}>
                <button
                  type="button"
                  className="fr-add-mount-btn"
                  onClick={handleAddMountPoint}
                  disabled={addingMp}
                  aria-label={t('fileResourcesWorkspace.addMountPoint')}
                >
                <FolderPlus className="fr-add-mount-icon" size={14} aria-hidden />
              </button>
              </Tooltip>
            </div>
          </div>
          <div className="fr-cli-panel fr-cli-mount-list" role="listbox" aria-label={t('fileResourcesWorkspace.mountPointList')}>
            {mountPoints.length === 0 ? (
              <div className="fr-cli-line fr-cli-empty">{t('fileResourcesWorkspace.noMountPoints')}</div>
            ) : (
              mountPoints.map((mp) => {
                const stats = statsByMpId.get(mp.id);
                const isSelected = selectedMp?.id === mp.id;
                const isEditing = editingMpId === mp.id;
                return (
                  <div
                    key={mp.id}
                    className={`fr-cli-mount-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => !isEditing && setSelectedMp(mp)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <Tooltip title={mp.path}>
                    <span className="fr-cli-mount-name">
                      {isEditing ? (
                        <input
                          type="text"
                          className="fr-cli-mount-name-input"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => handleSaveMountName(mp)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveMountName(mp);
                            if (e.key === 'Escape') { setEditingMpId(null); setEditingName(''); }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={t('fileResourcesWorkspace.displayName')}
                        />
                      ) : (
                        <>
                          <span className="fr-cli-prompt">$</span> {mp.name || mp.path}
                        </>
                      )}
                    </span>
                    </Tooltip>
                    {stats != null && (
                      <span className="fr-cli-mount-stats">
                        {stats.total > 0
                          ? t('fileResourcesWorkspace.totalDocuments', { count: stats.total })
                          : t('fileResourcesWorkspace.noDocumentsInMount')}
                      </span>
                    )}
                    <span className="fr-cli-mount-actions">
                      <Tooltip title={t('fileResourcesWorkspace.editName')}>
                        <button
                          type="button"
                          className="fr-cli-mount-btn fr-cli-mount-edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingMpId(mp.id);
                            setEditingName(mp.name || mp.path || '');
                          }}
                          disabled={isEditing}
                          aria-label={t('common.edit')}
                        >
                        <Pencil size={12} aria-hidden />
                      </button>
                      </Tooltip>
                      <Tooltip title={t('fileResourcesWorkspace.removeMountPoint')}>
                        <button
                          type="button"
                          className="fr-cli-mount-btn fr-cli-mount-delete"
                          onClick={(e) => { e.stopPropagation(); handleRemoveMountPoint(mp); }}
                          disabled={removing}
                          aria-label={t('fileResourcesWorkspace.removeMountPoint')}
                        >
                        <Trash2 size={12} aria-hidden />
                      </button>
                      </Tooltip>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="fr-cli-detail-section">
          {selectedMp ? (
            <>
              <div className="fr-stats-tags-wrap">
                {loadingDocStats ? (
                  <div className="fr-stats-tags-loading">{t('sidebar.loading')}</div>
                ) : docStats ? (
                  <div className="fr-stats-inline-wrap">
                    <span className="fr-stats-total">{t('fileResourcesWorkspace.totalDocuments', { count: docStats.total })}</span>
                    {Object.entries(docStats.by_type)
                      .sort((a, b) => b[1] - a[1])
                      .map(([ext, count]) => (
                        <Tooltip key={ext} title={t('fileResourcesWorkspace.filterByType', { ext: ext.toUpperCase() })}>
                          <span
                            role="button"
                            tabIndex={0}
                            className={`fr-stats-bracket-link ${filterByExt === ext ? 'active' : ''}`}
                            onClick={() => setFilterByExt((prev) => (prev === ext ? null : ext))}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFilterByExt((prev) => (prev === ext ? null : ext)); } }}
                          >
                            [ <span className="fr-stats-bracket-underline">{ext.toUpperCase()}_{count}</span> ]
                          </span>
                        </Tooltip>
                      ))}
                  </div>
                ) : null}
                <Tooltip title={selectedMp.path}>
                  <span className="fr-stats-mount-path">{selectedMp.path}</span>
                </Tooltip>
              </div>
              <div className="fr-files-panel fr-cli-panel fr-cli-files-panel">
                {loadingMountPointFiles ? (
                  <div className="fr-cli-line">{t('fileResourcesWorkspace.loadingFiles')}</div>
                ) : filteredFiles.length > 0 ? (
                  <div className="fr-cli-file-table-wrap">
                    <div className="fr-cli-file-table-header">
                      <span className="fr-cli-col-filename">{t('fileResourcesWorkspace.columnFileName')}</span>
                      <span className="fr-cli-col-path">{t('fileResourcesWorkspace.columnPath')}</span>
                      <span className="fr-cli-col-weight">{t('fileResourcesWorkspace.columnWeight')}</span>
                      <span className="fr-cli-col-notes" aria-hidden="true" />
                    </div>
                    {filteredFiles.map((row) => {
                      const rowKey = `${row.ext}:${row.path}`;
                      const notesExpanded = expandedNoteRowKey === rowKey;
                      const baseWeight = getWeightForRow(rowKey);
                      const weight = weightDragging?.rowKey === rowKey ? weightDragging.value : baseWeight;
                      const isSelectedFile = selectedFile?.mpId === selectedMp?.id && selectedFile?.relativePath === row.path;
                      return (
                        <React.Fragment key={rowKey}>
                          <div
                            className={`fr-cli-file-row ${isSelectedFile ? 'fr-cli-file-row-selected' : ''}`}
                            onClick={() => selectedMp && setSelectedFile({ mpId: selectedMp.id, relativePath: row.path, filename: row.filename, ext: row.ext })}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (selectedMp) setSelectedFile({ mpId: selectedMp.id, relativePath: row.path, filename: row.filename, ext: row.ext });
                              }
                            }}
                            aria-pressed={isSelectedFile}
                          >
                            <Tooltip title={row.filename}>
                              <span className={`fr-cli-col-filename fr-file-weight-${Math.min(5, Math.max(0, weight))}`}>
                                {row.filename}
                              </span>
                            </Tooltip>
                            <Tooltip title={row.path}>
                              <span className="fr-cli-col-path">
                                {row.path}
                              </span>
                            </Tooltip>
                            <span
                              className="fr-cli-col-weight fr-star-row fr-weight-slider"
                              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleWeightMouseDown(rowKey, row.path, weight, e.currentTarget); }}
                              onClick={(e) => e.stopPropagation()}
                              role="slider"
                              aria-valuemin={0}
                              aria-valuemax={5}
                              aria-valuenow={weight}
                              aria-label={t('fileResourcesWorkspace.columnWeight')}
                            >
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Tooltip key={s} title={t('fileResourcesWorkspace.slideToSetWeight')}>
                                  <span className={`fr-star ${s <= weight ? 'filled' : ''}`}>
                                    {s <= weight ? '\u2605' : '\u2606'}
                                  </span>
                                </Tooltip>
                              ))}
                            </span>
                            <span className="fr-cli-col-notes" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="fr-cli-notes-toggle fr-notes-down-arrow"
                                onClick={() => setExpandedNoteRowKey((k) => (k === rowKey ? null : rowKey))}
                                aria-expanded={notesExpanded}
                                aria-label={t('fileResourcesWorkspace.columnNotes')}
                              >
                                {notesExpanded ? '\u2190' : '\u2192'}
                              </button>
                            </span>
                          </div>
                          {notesExpanded && (
                            <div className="fr-cli-notes-expanded-row">
                              <textarea
                                className="fr-notes-edit"
                                value={fileNotes[rowKey] ?? ''}
                                onChange={(e) => setFileNotes((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                                onBlur={() => handleSaveNote(rowKey, row.path, fileNotes[rowKey] ?? '')}
                                placeholder={t('fileResourcesWorkspace.noNotes')}
                                rows={3}
                                aria-label={t('fileResourcesWorkspace.columnNotes')}
                              />
                              {(fileNotes[rowKey] ?? '').trim() ? (
                                <div className="fr-notes-preview">
                                  <ReactMarkdown>{fileNotes[rowKey] ?? ''}</ReactMarkdown>
                                </div>
                              ) : null}
                              {savingNoteRowKey === rowKey && (
                                <span className="fr-notes-saving">{t('common.saving')}</span>
                              )}
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                ) : (
                  <div className="fr-cli-line fr-cli-empty">{t('fileResourcesWorkspace.noFilesInMount')}</div>
                )}
              </div>
              <div className="fr-description-collapse">
                <button
                  type="button"
                  className="fr-description-collapse-header"
                  onClick={() => setDescriptionExpanded((e) => !e)}
                  aria-expanded={descriptionExpanded}
                  aria-controls="fr-description-body"
                >
                  <span className="fr-description-collapse-chevron">{descriptionExpanded ? '\u2190' : '\u2192'}</span>
                  {t('fileResourcesWorkspace.descriptionNotes')}
                </button>
                <div id="fr-description-body" className={`fr-description-collapse-body ${descriptionExpanded ? 'expanded' : ''}`} hidden={!descriptionExpanded}>
                  <div className="fr-mount-meta">
                    <div className="fr-mount-meta-row">
                      <span className="fr-mount-label">{t('fileResourcesWorkspace.path')}</span>
                      <Tooltip title={selectedMp.path}>
                        <span className="fr-mount-value">{selectedMp.path}</span>
                      </Tooltip>
                    </div>
                    {selectedMp.name && (
                      <div className="fr-mount-meta-row">
                        <span className="fr-mount-label">{t('fileResourcesWorkspace.displayName')}</span>
                        <span className="fr-mount-value">{selectedMp.name}</span>
                      </div>
                    )}
                  </div>
                  <label className="fr-description-label" htmlFor="fr-edit-description">
                    {t('fileResourcesWorkspace.description')}
                  </label>
                  <textarea
                    id="fr-edit-description"
                    className="fr-description-textarea"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder={t('fileResourcesWorkspace.descriptionPlaceholder')}
                    rows={2}
                    aria-label={t('fileResourcesWorkspace.description')}
                  />
                  <div className="fr-description-actions">
                    <button
                      type="button"
                      className="fr-btn fr-btn-neutral"
                      onClick={handleSaveDescription}
                      disabled={savingDesc}
                    >
                      {savingDesc ? t('common.saving') : t('common.save')}
                    </button>
                    {removeError && (
                      <div className="fr-remove-error" role="alert">
                        {removeError}
                      </div>
                    )}
                    <button
                      type="button"
                      className="fr-btn fr-btn-danger"
                      onClick={() => handleRemoveMountPoint()}
                      disabled={removing}
                    >
                      {removing ? t('common.removing') : t('fileResourcesWorkspace.removeMountPoint')}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="fr-cli-placeholder">{t('fileResourcesWorkspace.selectMountPointForAnnotation')}</div>
          )}
        </div>
        </div>
        <div className="fr-workspace-right">
        <div className="fr-search-section">
          <input
            type="text"
            className="fr-search-input"
            placeholder={t('fileResourcesWorkspace.searchFiles')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t('fileResourcesWorkspace.searchFiles')}
          />
        </div>
        <div className="fr-results-section">
          <div className="fr-section-title">{t('fileResourcesWorkspace.searchResults')}</div>
          <ul className="fr-file-list" role="listbox" aria-label={t('fileResourcesWorkspace.searchResults')}>
            {searchQuery.trim() ? (
              searchResults.length === 0 ? (
                <li className="fr-file-item fr-empty">{t('fileResourcesWorkspace.noResults')}</li>
              ) : (
                searchResults.map((item) => (
                  <li
                    key={item.rowKey}
                    className={`fr-file-item ${selectedMp?.id === item.mp.id && selectedFile?.relativePath === item.path ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedMp(item.mp);
                      setExpandedNoteRowKey(null);
                      setSelectedFile({ mpId: item.mp.id, relativePath: item.path, filename: item.filename, ext: item.ext });
                    }}
                    role="option"
                    aria-selected={selectedMp?.id === item.mp.id && selectedFile?.relativePath === item.path}
                  >
                    <Tooltip title={item.filename}>
                      <span className="fr-file-name">{item.filename}</span>
                    </Tooltip>
                    <Tooltip title={item.mp.name || item.mp.path}>
                      <span className="fr-file-search-mp">
                      {item.mp.name || item.mp.path}
                    </span>
                    </Tooltip>
                  </li>
                ))
              )
            ) : (
              <li className="fr-file-item fr-empty">{t('fileResourcesWorkspace.typeToSearch')}</li>
            )}
          </ul>
        </div>
        <div className="fr-recent-section">
          <div className="fr-section-title">{t('fileResourcesWorkspace.recentAnnotatedFiles')}</div>
          <ul className="fr-file-list" role="listbox" aria-label={t('fileResourcesWorkspace.recentAnnotatedFiles')}>
            {recentAnnotated.length === 0 ? (
              <li className="fr-file-item fr-empty">{t('fileResourcesWorkspace.noRecentAnnotatedFiles')}</li>
            ) : (
              recentAnnotated.map((item, idx) => {
                const isSelected = selectedMp?.id === item.mount_point_id && selectedFile?.relativePath === item.relative_path;
                const filename = item.filename || item.relative_path.replace(/^.*[/\\]/, '');
                const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';
                return (
                  <li
                    key={`${item.mount_point_id}:${item.relative_path}:${idx}`}
                    className={`fr-file-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      const mp = mountPoints.find((m) => m.id === item.mount_point_id);
                      if (mp) {
                        setSelectedMp(mp);
                        setSelectedFile({ mpId: item.mount_point_id, relativePath: item.relative_path, filename, ext });
                      }
                    }}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <Tooltip title={filename}>
                      <span className="fr-file-name">{filename}</span>
                    </Tooltip>
                  </li>
                );
              })
            )}
          </ul>
        </div>
        </div>
      </div>
      )}
      {selectedFile ? (
        <>
          {!previewMaximized && (
            <Tooltip title={t('fileResourcesWorkspace.resizePanel')}>
              <div
                className="fr-workspace-resize-handle"
                onMouseDown={handleBottomResizeStart}
                role="separator"
                aria-orientation="horizontal"
                aria-valuenow={bottomHeightPercent}
              />
            </Tooltip>
          )}
          <div
            className="fr-workspace-bottom"
            style={previewMaximized ? undefined : { flex: `0 0 ${bottomHeightPercent}%`, minHeight: 200 }}
          >
            <div className="fr-document-detail-section">
            <div className="fr-document-detail-header">
              <Tooltip title={selectedFile.filename}>
                <span className="fr-document-detail-title">{selectedFile.filename}</span>
              </Tooltip>
              <div className="fr-document-detail-actions">
                <Tooltip title={previewMaximized ? t('fileResourcesWorkspace.restorePreview') : t('fileResourcesWorkspace.maximizePreview')}>
                  <button
                    type="button"
                    className="fr-document-detail-maximize"
                    onClick={() => setPreviewMaximized((m) => !m)}
                    aria-label={previewMaximized ? t('fileResourcesWorkspace.restorePreview') : t('fileResourcesWorkspace.maximizePreview')}
                  >
                    {previewMaximized ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
                  </button>
                </Tooltip>
                <Tooltip title={t('common.close')}>
                  <button
                    type="button"
                    className="fr-document-detail-close"
                    onClick={() => { setSelectedFile(null); setPreviewMaximized(false); }}
                    aria-label={t('common.close')}
                  >
                    <X className="fr-document-detail-close-icon" size={14} aria-hidden />
                  </button>
                </Tooltip>
              </div>
            </div>
            <div className="fr-document-summary-block">
              {loadingSummary ? (
                <div className="fr-document-summary-placeholder">{t('sidebar.loading')}</div>
              ) : (
                <div className="fr-document-summary-content">
                  {(documentSummary || '').trim() ? documentSummary : t('fileResourcesWorkspace.summaryReservedForAI')}
                </div>
              )}
            </div>
            <div className="fr-document-preview-block">
              {loadingPreview ? (
                <div className="fr-document-preview-placeholder">{t('sidebar.loading')}</div>
              ) : previewError ? (
                <div className="fr-document-preview-error">{previewError}</div>
              ) : previewBlobUrl ? (
                <PdfViewer
                  url={previewBlobUrl}
                  className="fr-document-preview-pdf"
                />
              ) : null}
            </div>
          </div>
        </div>
        </>
      ) : null}
    </div>
  );

  if (previewMaximized) {
    return (
      <div
        className="fr-workspace-maximized-root"
        style={{
          flex: 1,
          minHeight: 0,
          margin: -16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {workspace}
      </div>
    );
  }
  return workspace;
};

export default FileResourcesWorkspace;
