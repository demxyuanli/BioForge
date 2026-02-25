import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getKnowledgePoints,
  getKnowledgePointKeywords,
  type KnowledgePoint,
} from '../services/api';

export interface UseDataCenterKnowledgePointsReturn {
  knowledgePoints: KnowledgePoint[];
  setKnowledgePoints: React.Dispatch<React.SetStateAction<KnowledgePoint[]>>;
  kpPage: number;
  setKpPage: React.Dispatch<React.SetStateAction<number>>;
  kpTotal: number;
  setKpTotal: React.Dispatch<React.SetStateAction<number>>;
  loadKnowledgePoints: () => Promise<void>;
  highlightedKeywords: string[];
  setHighlightedKeywords: React.Dispatch<React.SetStateAction<string[]>>;
  loadKeywords: (kpId: number) => Promise<void>;
}

/**
 * Hook for DataCenter knowledge points list and keywords.
 * selectedDocIdRef is used by loadKnowledgePoints so polling can use current value.
 */
export function useDataCenterKnowledgePoints(
  selectedDocId: number | null,
  selectedDocIdRef: React.MutableRefObject<number | null>,
  selectedKpId: number | null | undefined,
  kpPageSize: number
): UseDataCenterKnowledgePointsReturn {
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [kpPage, setKpPage] = useState(1);
  const [kpTotal, setKpTotal] = useState(0);
  const [highlightedKeywords, setHighlightedKeywords] = useState<string[]>([]);

  const kpPageRef = useRef(kpPage);
  useEffect(() => {
    kpPageRef.current = kpPage;
  }, [kpPage]);

  useEffect(() => {
    if (selectedDocId == null) {
      setKnowledgePoints([]);
      setKpTotal(0);
      setKpPage(1);
      kpPageRef.current = 1;
      setHighlightedKeywords([]);
      return;
    }
    setKnowledgePoints([]);
    setKpTotal(0);
    setKpPage(1);
    kpPageRef.current = 1;
    setHighlightedKeywords([]);
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
    if (selectedKpId != null) {
      loadKeywordsInternal(selectedKpId);
    } else {
      setHighlightedKeywords([]);
    }
  }, [selectedKpId]);

  const loadKeywordsInternal = async (kpId: number) => {
    try {
      const data = await getKnowledgePointKeywords(kpId);
      setHighlightedKeywords(data.keywords ?? []);
    } catch (error) {
      console.error('Load keywords error:', error);
      setHighlightedKeywords([]);
    }
  };

  const loadKeywords = async (kpId: number) => {
    await loadKeywordsInternal(kpId);
  };

  const loadKnowledgePoints = useCallback(async () => {
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
  }, [kpPageSize]);

  useEffect(() => {
    loadKnowledgePoints();
  }, [kpPage, loadKnowledgePoints]);

  return {
    knowledgePoints,
    setKnowledgePoints,
    kpPage,
    setKpPage,
    kpTotal,
    setKpTotal,
    loadKnowledgePoints,
    highlightedKeywords,
    setHighlightedKeywords,
    loadKeywords,
  };
}
