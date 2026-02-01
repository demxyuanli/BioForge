import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  selectFile,
  uploadDocument,
  getDocuments,
  getKnowledgePoints,
  Document,
  getDirectories,
  createDirectory,
  moveDocument,
  deleteDocument,
  deleteDirectory,
  DirectoryNode,
  KnowledgePoint,
} from '../services/api';
import './DataCenter.css';

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
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  useEffect(() => {
    if (selectedDocId == null) {
      setKnowledgePoints([]);
      setKpTotal(0);
      setKpPage(1);
      setSelectedKp(null);
      setHighlightedKeywords([]);
      return;
    }
    setKpPage(1);
    setSelectedKp(null);
    setHighlightedKeywords([]);
    getKnowledgePoints(1, kpPageSize, selectedDocId)
      .then((data) => {
        setKnowledgePoints(data.knowledge_points);
        setKpTotal(data.total);
      })
      .catch(() => {
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
    try {
      const data = await getKnowledgePoints(kpPage, kpPageSize, selectedDocId);
      setKnowledgePoints(data.knowledge_points);
      setKpTotal(data.total);
    } catch (e) {
      console.error('Failed to load knowledge points:', e);
    }
  };

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

  const handleDelete = async (item: DirectoryNode) => {
    if (!confirm(t('dataCenter.confirmDelete'))) return;
    setDeletingId(item.id);
    try {
      if (item.type === 'file') await deleteDocument(item.id);
      else await deleteDirectory(item.id);
      await loadData();
      if (selectedDocId === item.id) setSelectedDocId(null);
    } catch (e) {
      console.error('Delete error:', e);
      alert(`${t('dataCenter.deleteFailed')}: ${e}`);
    } finally {
      setDeletingId(null);
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

  return (
    <div className="data-center data-center-layout">
      <div className="dc-left">
        <div className="dc-search-section">
          <input
            type="text"
            className="dc-search-input"
            placeholder={t('dataCenter.searchDocuments')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t('dataCenter.searchDocuments')}
          />
        </div>
        <div className="dc-docs-section">
          <div className="dc-section-title">{t('dataCenter.addAndProcessDocuments')}</div>
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
          <div className="dc-breadcrumbs">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.id ?? 'root'}>
                {i > 0 && ' > '}
                <button
                  type="button"
                  className="dc-crumb"
                  onClick={() => setCurrentDirId(crumb.id)}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
          <ul className="dc-doc-list" role="listbox" aria-label={t('dataCenter.filesAndFolders')}>
            {displayItems.length === 0 ? (
              <li className="dc-doc-item dc-empty">
                {searchQuery.trim() ? t('dataCenter.noSearchResults') : t('dataCenter.emptyFolder')}
              </li>
            ) : (
              displayItems.map((item) => {
                const doc = documents.find((d) => d.id === item.id);
                const status = doc?.processingStatus ?? (item.processed ? 'completed' : 'pending');
                const isFile = item.type === 'file';
                return (
                  <li
                    key={`${item.type}-${item.id}`}
                    className={`dc-doc-item ${isFile && selectedDocId === item.id ? 'selected' : ''}`}
                  >
                    <span className="dc-doc-icon">{isFile ? '\uD83D\uDCC4' : '\uD83D\uDCC1'}</span>
                    {isFile ? (
                      <>
                        <button
                          type="button"
                          className="dc-doc-name"
                          onClick={() => setSelectedDocId(selectedDocId === item.id ? null : item.id)}
                        >
                          {item.name}
                        </button>
                        <span className="dc-doc-status">
                          {status === 'processing' ? `\u23F3` : status === 'failed' ? `\u274C` : status === 'completed' ? `\u2705` : ''}
                        </span>
                        <button
                          type="button"
                          className="dc-btn dc-btn-danger dc-btn-small"
                          disabled={deletingId === item.id || status === 'processing'}
                          onClick={() => handleDelete(item)}
                        >
                          {deletingId === item.id ? t('dataCenter.deleting') : t('dataCenter.delete')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="dc-doc-name" onClick={() => setCurrentDirId(item.id)}>
                          {item.name}
                        </button>
                        <button
                          type="button"
                          className="dc-btn dc-btn-danger dc-btn-small"
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item)}
                        >
                          {t('dataCenter.delete')}
                        </button>
                      </>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
      <div className="dc-right">
        <div className="dc-kp-list-section">
          <div className="dc-section-title">
            {selectedDoc
              ? t('dataCenter.knowledgePointsList') + ` (${kpTotal}) - ${selectedDoc.filename}`
              : t('dataCenter.selectDocumentForKp')}
          </div>
          {selectedDocId == null ? (
            <p className="dc-placeholder">{t('dataCenter.selectDocumentFirst')}</p>
          ) : (
            <>
              <div className="dc-kp-pagination">
                <button
                  type="button"
                  className="dc-btn dc-btn-small"
                  disabled={kpPage <= 1}
                  onClick={() => setKpPage((p) => Math.max(1, p - 1))}
                >
                  &lt;
                </button>
                <span className="dc-page-info">
                  {t('dataCenter.pageOf', { page: kpPage, total: Math.max(1, Math.ceil(kpTotal / kpPageSize)) })}
                </span>
                <button
                  type="button"
                  className="dc-btn dc-btn-small"
                  disabled={kpPage >= Math.ceil(kpTotal / kpPageSize)}
                  onClick={() => setKpPage((p) => p + 1)}
                >
                  &gt;
                </button>
              </div>
              <ul className="dc-kp-list" role="listbox">
                {knowledgePoints.length === 0 ? (
                  <li className="dc-kp-item dc-empty">{t('dataCenter.noKnowledgePoints')}</li>
                ) : (
                  knowledgePoints.map((kp, idx) => (
                    <li
                      key={`${kp.document_id}-${kp.chunk_index}`}
                      className={`dc-kp-item ${selectedKp === kp ? 'selected' : ''}`}
                      onClick={() => { setSelectedKp(kp); setHighlightedKeywords([]); }}
                    >
                      <span className="dc-kp-index">{(kpPage - 1) * kpPageSize + idx + 1}.</span>
                      <span className="dc-kp-preview" title={kp.content}>
                        {kp.content.length > 60 ? kp.content.slice(0, 60) + '...' : kp.content}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </div>
        <div className="dc-kp-content-section">
          <div className="dc-section-title">{t('dataCenter.knowledgePointContent')}</div>
          <div
            className="dc-kp-content-body"
            onMouseUp={handleKpContentMouseUp}
            role="article"
          >
            {selectedKp ? (
              <>
                <p className="dc-select-hint">{t('dataCenter.selectTextToAddKeyword')}</p>
                <div className="dc-kp-content-text">{selectedKp.content}</div>
              </>
            ) : (
              <p className="dc-placeholder">{t('dataCenter.selectKpForContent')}</p>
            )}
          </div>
        </div>
        <div className="dc-keywords-section">
          <div className="dc-section-title">{t('dataCenter.highlightedKeywords')}</div>
          <ul className="dc-keywords-list">
            {highlightedKeywords.length === 0 ? (
              <li className="dc-keyword-item dc-empty">{t('dataCenter.noKeywordsYet')}</li>
            ) : (
              highlightedKeywords.map((kw, i) => (
                <li key={`${i}-${kw.slice(0, 20)}`} className="dc-keyword-item">
                  <span className="dc-keyword-text" title={kw}>{kw}</span>
                  <button
                    type="button"
                    className="dc-btn dc-btn-small dc-btn-remove"
                    onClick={() => removeKeyword(i)}
                    aria-label={t('common.remove')}
                  >
                    &#215;
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DataCenter;
