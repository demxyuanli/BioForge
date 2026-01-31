import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  selectFile, 
  uploadDocument, 
  getDocuments, 
  deleteDocument, 
  getKnowledgePoints, 
  Document,
  getDirectories,
  createDirectory,
  moveDocument,
  deleteDirectory,
  DirectoryNode,
  KnowledgePoint
} from '../services/api';
import './DataCenter.css';

const DataCenter: React.FC = () => {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [directoryTree, setDirectoryTree] = useState<DirectoryNode[]>([]);
  const [currentDirId, setCurrentDirId] = useState<number | null>(null);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [kpPage, setKpPage] = useState(1);
  const [kpTotal, setKpTotal] = useState(0);
  const [kpPageSize] = useState(50);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newDirName, setNewDirName] = useState('');
  const [isCreatingDir, setIsCreatingDir] = useState(false);
  
  // Filter state for knowledge points
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
        // Poll for document status updates if any document is processing
        const processingDocs = documents.filter(d => d.processingStatus === 'pending' || d.processingStatus === 'processing');
        if (processingDocs.length > 0) {
            loadDocuments();
            loadKnowledgePoints(); // Refresh KPs as well if completed
        }
    }, 3000);
    return () => clearInterval(interval);
  }, [documents.map(d => d.processingStatus).join(',')]);

  useEffect(() => {
      loadKnowledgePoints();
  }, [kpPage, selectedDocId]);

  const loadData = async () => {
    await Promise.all([
      loadDocuments(),
      loadDirectories()
    ]);
  };

  const loadDirectories = async () => {
    try {
      const tree = await getDirectories();
      setDirectoryTree(tree);
    } catch (error) {
      console.error('Failed to load directories:', error);
    }
  };

  const loadDocuments = async () => {
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const loadKnowledgePoints = async () => {
    try {
      const data = await getKnowledgePoints(kpPage, kpPageSize, selectedDocId || undefined);
      setKnowledgePoints(data.knowledge_points);
      setKpTotal(data.total);
    } catch (error) {
      console.error('Failed to load knowledge points:', error);
    }
  };

  const handleCreateDirectory = async () => {
    if (!newDirName.trim()) return;
    
    try {
      await createDirectory(newDirName, currentDirId || undefined);
      setNewDirName('');
      setIsCreatingDir(false);
      await loadDirectories();
    } catch (error) {
      console.error('Create directory error:', error);
      alert(t('dataCenter.createDirFailed') || 'Failed to create directory');
    }
  };

  const handleFileSelect = async () => {
    const filePath = await selectFile();
    if (!filePath) return;

    setIsUploading(true);
    setUploadProgress(t('dataCenter.processing'));
    
    try {
      // Upload document first
      const result = await uploadDocument(filePath);
      
      // If we are in a directory, move the new document there
      if (currentDirId && result.document_id) {
         await moveDocument(result.document_id, currentDirId);
      }
      
      setUploadProgress(t('dataCenter.documentProcessed'));
      await loadData(); // Reload to see the new document in list

      setTimeout(() => {
        setUploadProgress('');
      }, 3000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadProgress(`Error: ${error}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (item: DirectoryNode) => {
    if (!confirm(t('dataCenter.confirmDelete'))) {
      return;
    }

    setDeletingId(item.id);
    try {
      if (item.type === 'file') {
        await deleteDocument(item.id);
      } else {
        await deleteDirectory(item.id);
      }
      await loadData();
    } catch (error) {
      console.error('Delete error:', error);
      alert(`${t('dataCenter.deleteFailed')}: ${error}`);
    } finally {
      setDeletingId(null);
    }
  };
  
  // Helper to get current level items based on currentDirId
  const getCurrentItems = () => {
    if (currentDirId === null) {
      // Root level: items with no parentId (or null)
      return directoryTree.filter(node => !node.parentId && !node.directoryId);
    } else {
      // Find the current directory node recursively
      const findNode = (nodes: DirectoryNode[]): DirectoryNode | null => {
        for (const node of nodes) {
          if (node.id === currentDirId && node.type === 'directory') return node;
          if (node.children) {
            const found = findNode(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      
      const currentDirNode = findNode(directoryTree);
      return currentDirNode?.children || [];
    }
  };

  const getBreadcrumbs = () => {
    if (currentDirId === null) return [{ id: null, name: 'Root' }];
    
    const breadcrumbs = [];
    let currentId: number | null | undefined = currentDirId;
    
    while (currentId) {
      const findNode = (nodes: DirectoryNode[]): DirectoryNode | null => {
        for (const node of nodes) {
          if (node.id === currentId && node.type === 'directory') return node;
          if (node.children) {
            const found = findNode(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      
      const node = findNode(directoryTree);
      if (node) {
        breadcrumbs.unshift({ id: node.id, name: node.name });
        currentId = node.parentId;
      } else {
        break;
      }
    }
    
    breadcrumbs.unshift({ id: null, name: 'Root' });
    return breadcrumbs;
  };

  const currentItems = getCurrentItems();
  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="data-center">
      <h2>{t('dataCenter.title')}</h2>
      
      <div className="file-manager-toolbar" style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
        <button onClick={handleFileSelect} disabled={isUploading}>
          {isUploading ? t('dataCenter.processing') : t('dataCenter.uploadFile') || 'Upload File'}
        </button>
        
        {!isCreatingDir ? (
           <button onClick={() => setIsCreatingDir(true)}>
             {t('dataCenter.newFolder') || 'New Folder'}
           </button>
        ) : (
           <div className="new-folder-input" style={{ display: 'flex', gap: '5px' }}>
             <input 
               type="text" 
               value={newDirName} 
               onChange={(e) => setNewDirName(e.target.value)}
               placeholder="Folder Name"
               autoFocus
               onKeyDown={(e) => e.key === 'Enter' && handleCreateDirectory()}
             />
             <button onClick={handleCreateDirectory}>OK</button>
             <button onClick={() => { setIsCreatingDir(false); setNewDirName(''); }}>Cancel</button>
           </div>
        )}
        
        {uploadProgress && <span style={{ marginLeft: '10px' }}>{uploadProgress}</span>}
      </div>

      <div className="breadcrumbs" style={{ marginBottom: '10px', padding: '5px', background: 'var(--vs-sidebar-bg)' }}>
         {breadcrumbs && breadcrumbs.map((crumb, index) => (
           <span key={crumb.id ?? 'root'}>
             {index > 0 && ' > '}
             <span 
               style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--vs-text-link)' }}
               onClick={() => setCurrentDirId(crumb.id ?? null)}
             >
               {crumb.name}
             </span>
           </span>
         ))}
      </div>

      <div className="documents-list">
        <h3>{t('dataCenter.filesAndFolders') || 'Files & Folders'}</h3>
        {currentItems.length === 0 ? (
          <p>{t('dataCenter.emptyFolder') || 'This folder is empty'}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>{t('dataCenter.name') || 'Name'}</th>
                <th>{t('dataCenter.type') || 'Type'}</th>
                <th>{t('dataCenter.uploadTime')}</th>
                <th>{t('dataCenter.status')}</th>
                <th>{t('dataCenter.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((item) => {
                const doc = documents.find(d => d.id === item.id);
                const status = doc?.processingStatus || (item.processed ? 'completed' : 'pending');
                const message = doc?.processingMessage;
                
                return (
                <tr key={`${item.type}-${item.id}`}>
                  <td style={{ textAlign: 'center' }}>
                    {item.type === 'directory' ? '📁' : '📄'}
                  </td>
                  <td>
                    {item.type === 'directory' ? (
                      <span 
                        style={{ cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => setCurrentDirId(item.id)}
                      >
                        {item.name}
                      </span>
                    ) : (
                      <span 
                        style={{ cursor: 'pointer', color: selectedDocId === item.id ? 'var(--vs-focus-border)' : 'inherit' }}
                        onClick={() => {
                            setSelectedDocId(selectedDocId === item.id ? null : item.id);
                            setKpPage(1); // Reset to first page on filter change
                        }}
                        title="Click to filter knowledge points"
                      >
                        {item.name}
                      </span>
                    )}
                  </td>
                  <td>{item.type === 'directory' ? 'Folder' : item.fileType}</td>
                  <td>{item.uploadTime || '-'}</td>
                  <td>
                      {item.type === 'directory' ? '-' : (
                          <span title={message || ''}>
                              {status === 'processing' ? '⏳ Processing...' : 
                               status === 'failed' ? '❌ Failed' : 
                               status === 'completed' ? '✅ Processed' : 'Pending'}
                          </span>
                      )}
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id || (item.type === 'file' && status === 'processing')}
                      className="delete-btn"
                    >
                      {deletingId === item.id ? t('dataCenter.deleting') : t('dataCenter.delete')}
                    </button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>

      <div className="knowledge-points-list">
        <div className="knowledge-points-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>
            {t('dataCenter.knowledgePointsList')} ({kpTotal})
            {selectedDocId && <span style={{ fontSize: '0.8em', fontWeight: 'normal', marginLeft: '10px' }}>
              (Filtered by: {documents.find(d => d.id === selectedDocId)?.filename || 'Document'})
              <button 
                onClick={() => { setSelectedDocId(null); setKpPage(1); }}
                style={{ marginLeft: '5px', padding: '0 5px', fontSize: '0.8em' }}
              >
                Clear Filter
              </button>
            </span>}
          </h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div className="pagination-controls" style={{ fontSize: '0.9em' }}>
                  <button 
                    disabled={kpPage <= 1} 
                    onClick={() => setKpPage(p => Math.max(1, p - 1))}
                    style={{ padding: '2px 8px' }}
                  >
                    &lt;
                  </button>
                  <span style={{ margin: '0 8px' }}>
                      Page {kpPage} of {Math.max(1, Math.ceil(kpTotal / kpPageSize))}
                  </span>
                  <button 
                    disabled={kpPage >= Math.ceil(kpTotal / kpPageSize)} 
                    onClick={() => setKpPage(p => p + 1)}
                    style={{ padding: '2px 8px' }}
                  >
                    &gt;
                  </button>
              </div>
              <button type="button" className="refresh-kp-btn" onClick={loadKnowledgePoints}>
                {t('dataCenter.refreshKnowledgePoints')}
              </button>
          </div>
        </div>
        {knowledgePoints.length === 0 ? (
          <p>{t('dataCenter.noKnowledgePoints')}</p>
        ) : (
          <ul className="knowledge-points-items">
            {knowledgePoints.map((kp, index) => (
              <li key={`${kp.document_id}-${kp.chunk_index}`} className="knowledge-point-item">
                <span className="kp-index">{(kpPage - 1) * kpPageSize + index + 1}.</span>
                <div style={{ flex: 1 }}>
                   <span className="kp-content">{kp.content}</span>
                   <div style={{ fontSize: '0.8em', color: 'var(--vs-description-foreground)', marginTop: '4px' }}>
                     Source: {kp.document_name}
                   </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DataCenter;
