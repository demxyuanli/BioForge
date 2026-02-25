import { useState, useRef, useCallback, useEffect } from 'react';

const MIN_LEFT_PX = 560;
const MIN_RIGHT_PX = 360;

export interface UseProductionTuningLayoutReturn {
  leftPaneWidth: number;
  setLeftPaneWidth: React.Dispatch<React.SetStateAction<number>>;
  isSplitResizing: boolean;
  splitContainerRef: React.RefObject<HTMLDivElement | null>;
  splitTemplate: string;
  handleSplitResizeStart: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function useProductionTuningLayout(): UseProductionTuningLayoutReturn {
  const [leftPaneWidth, setLeftPaneWidth] = useState(0);
  const [isSplitResizing, setIsSplitResizing] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const handleSplitResizeStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsSplitResizing(true);
  }, []);

  useEffect(() => {
    if (!isSplitResizing) return;
    const onMouseMove = (e: MouseEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const next = e.clientX - rect.left;
      const clamped = Math.max(
        MIN_LEFT_PX,
        Math.min(rect.width - MIN_RIGHT_PX, next)
      );
      setLeftPaneWidth(clamped);
    };
    const onMouseUp = () => setIsSplitResizing(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isSplitResizing]);

  const splitTemplate =
    leftPaneWidth > 0
      ? `${leftPaneWidth}px 4px minmax(0, 1fr)`
      : 'minmax(620px, 64%) 4px minmax(360px, 1fr)';

  return {
    leftPaneWidth,
    setLeftPaneWidth,
    isSplitResizing,
    splitContainerRef,
    splitTemplate,
    handleSplitResizeStart,
  };
}
