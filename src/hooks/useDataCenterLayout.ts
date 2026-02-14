import { useState, useRef, useEffect } from 'react';

export const UPPER_MIN = 40;
export const UPPER_MAX_OFFSET = 40;
export const UPPER_DEFAULT = 48;
export const LOWER_VISIBLE_DEFAULT = false;
export const LEFT_PANEL_MIN = 280;
export const LEFT_PANEL_DEFAULT = 400;
export const LEFT_PANEL_HANDLE_WIDTH = 4;
export const RIGHT_PANEL_MIN = 200;
export const KP_LIST_MIN_HEIGHT = 100;
export const KP_DETAIL_MIN_HEIGHT = 100;
export const KP_RESIZE_HANDLE_HEIGHT = 4;

export interface UseDataCenterLayoutReturn {
  lowerVisible: boolean;
  setLowerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  upperHeight: number;
  setUpperHeight: React.Dispatch<React.SetStateAction<number>>;
  resizing: boolean;
  leftPanelWidth: number;
  setLeftPanelWidth: React.Dispatch<React.SetStateAction<number>>;
  kpListHeight: number | null;
  setKpListHeight: React.Dispatch<React.SetStateAction<number | null>>;
  resizingHorizontal: boolean;
  resizingKpVertical: boolean;
  workspaceRef: React.RefObject<HTMLDivElement | null>;
  upperBodyRef: React.RefObject<HTMLDivElement | null>;
  upperLeftRightRef: React.RefObject<HTMLDivElement | null>;
  kpTopPanelRef: React.RefObject<HTMLDivElement | null>;
  onResizeStart: (e: React.MouseEvent) => void;
  onResizeHorizontalStart: (e: React.MouseEvent) => void;
  onResizeKpVerticalStart: (e: React.MouseEvent) => void;
}

export function useDataCenterLayout(): UseDataCenterLayoutReturn {
  const [lowerVisible, setLowerVisible] = useState(LOWER_VISIBLE_DEFAULT);
  const [upperHeight, setUpperHeight] = useState(UPPER_DEFAULT);
  const [resizing, setResizing] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(LEFT_PANEL_DEFAULT);
  const [kpListHeight, setKpListHeight] = useState<number | null>(null);
  const [resizingHorizontal, setResizingHorizontal] = useState(false);
  const [resizingKpVertical, setResizingKpVertical] = useState(false);

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

  const onResizeHorizontalStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    startWidthRef.current = leftPanelWidth;
    setResizingHorizontal(true);
  };

  const onResizeKpVerticalStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const currentTop = kpListHeight ?? (kpTopPanelRef.current?.offsetHeight ?? 200);
    startYKpRef.current = e.clientY;
    startHeightKpRef.current = currentTop;
    setKpListHeight(currentTop);
    setResizingKpVertical(true);
  };

  return {
    lowerVisible,
    setLowerVisible,
    upperHeight,
    setUpperHeight,
    resizing,
    leftPanelWidth,
    setLeftPanelWidth,
    kpListHeight,
    setKpListHeight,
    resizingHorizontal,
    resizingKpVertical,
    workspaceRef,
    upperBodyRef,
    upperLeftRightRef,
    kpTopPanelRef,
    onResizeStart,
    onResizeHorizontalStart,
    onResizeKpVerticalStart,
  };
}
