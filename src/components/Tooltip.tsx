import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

const TOOLTIP_PADDING = 8;
const TOOLTIP_DELAY_MS = 400;

interface TooltipProps {
  children: ReactNode;
  title: string;
  disabled?: boolean;
  truncate?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({ children, title, disabled, truncate }) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [placement, setPlacement] = useState<'bottom' | 'top' | 'left' | 'right'>('bottom');
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip || !title) return;

    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const space = {
      bottom: vh - anchorRect.bottom,
      top: anchorRect.top,
      right: vw - anchorRect.right,
      left: anchorRect.left,
    };

    let bestPlacement: 'bottom' | 'top' | 'left' | 'right' = 'bottom';
    if (space.bottom >= tooltipRect.height + TOOLTIP_PADDING) bestPlacement = 'bottom';
    else if (space.top >= tooltipRect.height + TOOLTIP_PADDING) bestPlacement = 'top';
    else if (space.right >= tooltipRect.width + TOOLTIP_PADDING) bestPlacement = 'right';
    else if (space.left >= tooltipRect.width + TOOLTIP_PADDING) bestPlacement = 'left';
    else bestPlacement = space.bottom >= space.top ? 'bottom' : 'top';

    setPlacement(bestPlacement);

    let posTop = 0;
    let posLeft = anchorRect.left + (anchorRect.width / 2) - (tooltipRect.width / 2);

    switch (bestPlacement) {
      case 'bottom':
        posTop = anchorRect.bottom + TOOLTIP_PADDING;
        break;
      case 'top':
        posTop = anchorRect.top - tooltipRect.height - TOOLTIP_PADDING;
        break;
      case 'right':
        posTop = anchorRect.top + (anchorRect.height / 2) - (tooltipRect.height / 2);
        posLeft = anchorRect.right + TOOLTIP_PADDING;
        break;
      case 'left':
        posTop = anchorRect.top + (anchorRect.height / 2) - (tooltipRect.height / 2);
        posLeft = anchorRect.left - tooltipRect.width - TOOLTIP_PADDING;
        break;
    }

    posLeft = Math.max(TOOLTIP_PADDING, Math.min(vw - tooltipRect.width - TOOLTIP_PADDING, posLeft));
    posTop = Math.max(TOOLTIP_PADDING, Math.min(vh - tooltipRect.height - TOOLTIP_PADDING, posTop));

    setPosition({ top: posTop, left: posLeft });
  }, [title]);

  const showTooltip = useCallback(() => {
    if (disabled || !title) return;
    timeoutRef.current = setTimeout(() => {
      setVisible(true);
    }, TOOLTIP_DELAY_MS);
  }, [disabled, title]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  }, []);

  useLayoutEffect(() => {
    if (visible) {
      const raf = requestAnimationFrame(() => {
        updatePosition();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [visible, updatePosition]);

  useEffect(() => {
    if (visible) {
      const tooltip = tooltipRef.current;
      if (tooltip) {
        const ro = new ResizeObserver(updatePosition);
        ro.observe(tooltip);
        return () => ro.disconnect();
      }
    }
  }, [visible, updatePosition]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const tooltipEl = visible && title && (
    <div
      ref={tooltipRef}
      className={`app-tooltip app-tooltip--${placement}`}
      style={{ top: position.top, left: position.left }}
      role="tooltip"
    >
      {title}
    </div>
  );

  return (
    <span
      ref={anchorRef}
      className={`app-tooltip-anchor${truncate ? ' app-tooltip-anchor--truncate' : ''}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      {createPortal(tooltipEl, document.body)}
    </span>
  );
};

export default Tooltip;
