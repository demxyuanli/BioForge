import { useState, useEffect, useRef } from 'react';
import { getDocuments, getDirectories, type Document, type DirectoryNode } from '../services/api';
import { DOCUMENTS_CHANGED_EVENT } from '../components/layout/FileExplorer';

export interface UseDataCenterDocumentsReturn {
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  directoryTree: DirectoryNode[];
  setDirectoryTree: React.Dispatch<React.SetStateAction<DirectoryNode[]>>;
  loadData: () => Promise<void>;
  loadDocuments: () => Promise<void>;
  loadDirectories: () => Promise<void>;
}

/**
 * Hook for DataCenter documents and directory tree with loading and polling.
 * Optional pollCallbackRef is called during the processing-poll interval so the parent can refresh KP list.
 */
export function useDataCenterDocuments(
  pollCallbackRef?: React.MutableRefObject<(() => void) | null | undefined>
): UseDataCenterDocumentsReturn {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [directoryTree, setDirectoryTree] = useState<DirectoryNode[]>([]);

  const documentsRef = useRef<Document[]>(documents);
  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

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

  const loadData = async () => {
    await Promise.all([loadDocuments(), loadDirectories()]);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      const processing = documentsRef.current.filter(
        (d) => d.processingStatus === 'pending' || d.processingStatus === 'processing'
      );
      if (processing.length > 0) {
        loadDocuments();
        loadDirectories();
        pollCallbackRef?.current?.();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = () => {
      loadData();
      pollCallbackRef?.current?.();
    };
    window.addEventListener(DOCUMENTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(DOCUMENTS_CHANGED_EVENT, handler);
  }, []);

  return {
    documents,
    setDocuments,
    directoryTree,
    setDirectoryTree,
    loadData,
    loadDocuments,
    loadDirectories,
  };
}
