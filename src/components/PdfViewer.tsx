import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import './PdfViewer.css';

GlobalWorkerOptions.workerSrc = pdfjsWorker;

type FitMode = 'none' | 'width' | 'page';

interface PdfViewerProps {
  url: string | null;
  className?: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ url, className = '' }) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [fitMode, setFitMode] = useState<FitMode>('none');
  const [pageInput, setPageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);

  useEffect(() => {
    if (!url) {
      setPdfDoc(null);
      setNumPages(0);
      setPageNum(1);
      setError(null);
      pdfDocRef.current = null;
      return;
    }
    setLoading(true);
    setError(null);
    getDocument({ url })
      .promise.then((doc) => {
        pdfDocRef.current = doc;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNum(1);
      })
      .catch((err) => {
        setError(err?.message ?? 'Failed to load PDF');
        setPdfDoc(null);
        pdfDocRef.current = null;
      })
      .finally(() => setLoading(false));
    return () => {
      const prev = pdfDocRef.current;
      pdfDocRef.current = null;
      prev?.destroy?.();
    };
  }, [url]);

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setContainerSize({ w: width, h: height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const renderPage = useCallback(
    (pageNumber: number, s: number, rot: number) => {
      if (!pdfDoc || !canvasRef.current) return;
      renderTaskRef.current?.cancel();
      pdfDoc.getPage(pageNumber).then((page) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        let viewport = page.getViewport({ scale: s, rotation: rot });
        if (fitMode !== 'none' && containerSize.w > 0 && containerSize.h > 0) {
          const pad = 16;
          const availW = containerSize.w - pad;
          const availH = containerSize.h - pad;
          const baseVp = page.getViewport({ scale: 1, rotation: rot });
          let fitScale = s;
          if (fitMode === 'width') fitScale = availW / baseVp.width;
          else if (fitMode === 'page') {
            fitScale = Math.min(availW / baseVp.width, availH / baseVp.height);
          }
          viewport = page.getViewport({ scale: fitScale, rotation: rot });
        } else {
          viewport = page.getViewport({ scale: s, rotation: rot });
        }
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        const task = page.render({
          canvasContext: ctx,
          canvas,
          viewport
        });
        renderTaskRef.current = task;
        task.promise.catch(() => {}).finally(() => {
          renderTaskRef.current = null;
        });
      });
    },
    [pdfDoc, scale, rotation, fitMode, containerSize]
  );

  useEffect(() => {
    if (pdfDoc && pageNum >= 1 && pageNum <= numPages) {
      let s = scale;
      if (fitMode !== 'none' && containerSize.w > 0 && containerSize.h > 0) {
        pdfDoc.getPage(pageNum).then((page) => {
          const vp = page.getViewport({ scale: 1, rotation });
          const pad = 16;
          const availW = containerSize.w - pad;
          const availH = containerSize.h - pad;
          if (fitMode === 'width') s = availW / vp.width;
          else if (fitMode === 'page') s = Math.min(availW / vp.width, availH / vp.height);
          renderPage(pageNum, s, rotation);
        });
      } else {
        renderPage(pageNum, scale, rotation);
      }
    }
  }, [pdfDoc, pageNum, numPages, scale, rotation, fitMode, containerSize, renderPage]);

  const goPrev = () => setPageNum((p) => Math.max(1, p - 1));
  const goNext = () => setPageNum((p) => Math.min(numPages, p + 1));
  const goFirst = () => setPageNum(1);
  const goLast = () => setPageNum(numPages);

  const handleGoToPage = () => {
    const n = parseInt(pageInput, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= numPages) {
      setPageNum(n);
      setPageInput('');
    }
  };

  const zoomIn = () => {
    setFitMode('none');
    setScale((s) => Math.min(3, s + 0.2));
  };
  const zoomOut = () => {
    setFitMode('none');
    setScale((s) => Math.max(0.5, s - 0.2));
  };

  const fitToWidth = () => setFitMode('width');
  const fitToPage = () => setFitMode('page');

  const rotateCw = () => setRotation((r) => (r + 90) % 360);
  const rotateCcw = () => setRotation((r) => (r + 270) % 360);

  useEffect(() => {
    setPageInput('');
  }, [pageNum]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!pdfDoc || numPages === 0) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (!containerRef.current?.contains(target)) return;
      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          setPageNum((p) => Math.max(1, p - 1));
          break;
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          setPageNum((p) => Math.min(numPages, p + 1));
          break;
        case 'Home':
          e.preventDefault();
          setPageNum(1);
          break;
        case 'End':
          e.preventDefault();
          setPageNum(numPages);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pdfDoc, numPages]);

  const zoomDisplay = (() => {
    if (fitMode === 'width') return t('pdfViewer.fitWidth');
    if (fitMode === 'page') return t('pdfViewer.fitPage');
    return `${Math.round(scale * 100)}%`;
  })();

  if (!url) return null;
  if (loading) return <div className="pdf-viewer-loading">{t('pdfViewer.loading')}</div>;
  if (error) return <div className="pdf-viewer-error">{error}</div>;
  if (!pdfDoc || numPages === 0) return null;

  return (
    <div className={`pdf-viewer ${className}`} ref={containerRef}>
      <div className="pdf-viewer-toolbar">
        <button type="button" onClick={goFirst} disabled={pageNum <= 1} aria-label={t('pdfViewer.firstPage')}>
          &#x21E4;
        </button>
        <button type="button" onClick={goPrev} disabled={pageNum <= 1} aria-label={t('pdfViewer.prevPage')}>
          &#9664;
        </button>
        <span className="pdf-viewer-page-info">
          {pageNum} / {numPages}
        </span>
        <button type="button" onClick={goNext} disabled={pageNum >= numPages} aria-label={t('pdfViewer.nextPage')}>
          &#9654;
        </button>
        <button type="button" onClick={goLast} disabled={pageNum >= numPages} aria-label={t('pdfViewer.lastPage')}>
          &#x21E5;
        </button>
        <div className="pdf-viewer-goto">
          <input
            type="number"
            min={1}
            max={numPages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGoToPage()}
            placeholder={String(pageNum)}
            className="pdf-viewer-goto-input"
            aria-label={t('pdfViewer.goToPage')}
          />
          <button type="button" onClick={handleGoToPage} className="pdf-viewer-goto-btn" aria-label={t('pdfViewer.goToPage')}>
            {t('pdfViewer.go')}
          </button>
        </div>
        <span className="pdf-viewer-sep" />
        <button type="button" onClick={zoomOut} aria-label={t('pdfViewer.zoomOut')}>
          &#8722;
        </button>
        <span className="pdf-viewer-zoom">{zoomDisplay}</span>
        <button type="button" onClick={zoomIn} aria-label={t('pdfViewer.zoomIn')}>
          +
        </button>
        <button type="button" onClick={fitToWidth} className={fitMode === 'width' ? 'pdf-viewer-btn-active' : ''} aria-label={t('pdfViewer.fitWidth')}>
          W
        </button>
        <button type="button" onClick={fitToPage} className={fitMode === 'page' ? 'pdf-viewer-btn-active' : ''} aria-label={t('pdfViewer.fitPage')}>
          P
        </button>
        <span className="pdf-viewer-sep" />
        <button type="button" onClick={rotateCcw} aria-label={t('pdfViewer.rotateCcw')}>
          &#8630;
        </button>
        <button type="button" onClick={rotateCw} aria-label={t('pdfViewer.rotateCw')}>
          &#8631;
        </button>
      </div>
      <div className="pdf-viewer-canvas-wrap" ref={canvasWrapRef} tabIndex={0}>
        <canvas ref={canvasRef} className="pdf-viewer-canvas" />
      </div>
    </div>
  );
};

export default PdfViewer;
