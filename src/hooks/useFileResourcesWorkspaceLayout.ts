import { useState, useRef, useCallback } from 'react';

export const BOTTOM_HEIGHT_MIN = 15;
export const BOTTOM_HEIGHT_MAX = 70;
export const BOTTOM_HEIGHT_DEFAULT = 38;

export interface UseFileResourcesWorkspaceLayoutReturn {
  bottomHeightPercent: number;
  setBottomHeightPercent: React.Dispatch<React.SetStateAction<number>>;
  previewMaximized: boolean;
  setPreviewMaximized: React.Dispatch<React.SetStateAction<boolean>>;
  workspaceRef: React.RefObject<HTMLDivElement | null>;
  onBottomResizeStart: (e: React.MouseEvent) => void;
}

export function useFileResourcesWorkspaceLayout(): UseFileResourcesWorkspaceLayoutReturn {
  const [bottomHeightPercent, setBottomHeightPercent] = useState(BOTTOM_HEIGHT_DEFAULT);
  const [previewMaximized, setPreviewMaximized] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const onBottomResizeStart = useCallback((e: React.MouseEvent) => {
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
      pct = Math.max(BOTTOM_HEIGHT_MIN, Math.min(BOTTOM_HEIGHT_MAX, pct));
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

  return {
    bottomHeightPercent,
    setBottomHeightPercent,
    previewMaximized,
    setPreviewMaximized,
    workspaceRef,
    onBottomResizeStart,
  };
}
