import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart2, Maximize2, Network, X } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import { getKnowledgePointsForGraph, type KnowledgePoint } from '../services/api';
import './KnowledgeGraph.css';

const CHARS_PER_LINE = 8;
const MAX_LINES = 2;
const MAX_LABEL_LEN = CHARS_PER_LINE * MAX_LINES;
const ENTITY_RADIUS_BASE = 26;
const ENTITY_RADIUS_PER_WEIGHT = 5;
const KEYWORD_RADIUS = 18;
const ENTITY_FONT_SIZE = 10;
const KEYWORD_FONT_SIZE = 9;
const MIN_FONT_SIZE = 8;

function truncate(s: string, max: number): string {
  const t = (s || '').trim();
  if (t.length <= max) return t;
  return t.slice(0, max) + '..';
}

function labelToLines(label: string): string[] {
  const lines: string[] = [];
  for (let i = 0; i < MAX_LINES && i * CHARS_PER_LINE < label.length; i++) {
    lines.push(label.slice(i * CHARS_PER_LINE, (i + 1) * CHARS_PER_LINE));
  }
  return lines;
}

function normalizeKeywords(kw: unknown): string[] {
  let arr: unknown[] = [];
  if (Array.isArray(kw)) {
    arr = kw;
  } else if (typeof kw === 'string') {
    try {
      const parsed = JSON.parse(kw) as unknown;
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      arr = [];
    }
  }
  return arr
    .map((x) => {
      if (typeof x === 'string') return x.trim();
      if (x != null && typeof x === 'object' && 'keyword' in x) return String((x as { keyword: unknown }).keyword).trim();
      if (x != null && typeof x === 'object' && 'text' in x) return String((x as { text: unknown }).text).trim();
      return String(x).trim();
    })
    .filter((s) => s.length > 0);
}

export type GraphMode = 'shared' | 'keywordNodes';

export type GraphNodeBase = { id: string; label: string; nodeType: 'entity' | 'concept'; fullContent?: string };
type KpNode = GraphNodeBase & { kp: KnowledgePoint; weight: number; nodeType: 'entity' };
type KwNode = GraphNodeBase & { nodeType: 'concept' };
export type GraphNode = KpNode | KwNode;

export type GraphLink = { source: string; target: string; linkType: 'sequence' | 'keyword' };
export type GraphData = { nodes: GraphNode[]; links: GraphLink[] };

type KnowledgeGraphProps = {
  onSelectKnowledgePoint?: (kp: KnowledgePoint) => void;
  selectedKnowledgePointId?: number | null;
};

function buildGraphData(kps: KnowledgePoint[], mode: GraphMode): GraphData {
  const kpNodes: KpNode[] = kps
    .filter((kp) => kp.id != null)
    .map((kp) => ({
      id: String(kp.id),
      kp,
      label: truncate(kp.content || '', MAX_LABEL_LEN),
      fullContent: (kp.content || '').trim(),
      weight: Math.max(1, Math.min(5, Math.round(kp.weight ?? 1))),
      nodeType: 'entity' as const,
    }));
  const links: GraphLink[] = [];
  const linkKey = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const seenLinks = new Set<string>();

  const kpNodeById = new Map<string, KpNode>();
  for (const n of kpNodes) kpNodeById.set(n.id, n);

  const byDoc = new Map<number, { id: string }[]>();
  for (const n of kpNodes) {
    const docId = n.kp.document_id;
    if (!byDoc.has(docId)) byDoc.set(docId, []);
    byDoc.get(docId)!.push({ id: n.id });
  }
  for (const [, list] of byDoc) {
    const withChunk = list
      .map((x) => ({ id: x.id, chunk: (kpNodeById.get(x.id)?.kp as KnowledgePoint).chunk_index }))
      .sort((a, b) => (a.chunk ?? 0) - (b.chunk ?? 0));
    for (let i = 0; i < withChunk.length - 1; i++) {
      const a = withChunk[i].id;
      const b = withChunk[i + 1].id;
      const key = linkKey(a, b);
      if (!seenLinks.has(key)) {
        seenLinks.add(key);
        links.push({ source: a, target: b, linkType: 'sequence' });
      }
    }
  }

  const kpKeywords = new Map<string, string[]>();
  for (const n of kpNodes) {
    const raw = (n.kp as unknown as Record<string, unknown>).keywords ?? n.kp.keywords;
    kpKeywords.set(n.id, normalizeKeywords(raw));
  }

  if (mode === 'keywordNodes') {
    const keywordSet = new Set<string>();
    for (const kwList of kpKeywords.values()) {
      for (const kw of kwList) keywordSet.add(kw);
    }
    const uniqueKeywords = Array.from(keywordSet);
    const keywordToId = new Map<string, string>();
    const kwNodes: KwNode[] = uniqueKeywords.map((kw, i) => {
      const id = `kw_${i}`;
      keywordToId.set(kw, id);
      return {
        id,
        label: truncate(kw, MAX_LABEL_LEN),
        fullContent: kw,
        nodeType: 'concept' as const,
      };
    });
    for (const n of kpNodes) {
      const kwList = kpKeywords.get(n.id) ?? [];
      for (const kw of kwList) {
        const kwId = keywordToId.get(kw);
        if (kwId) links.push({ source: n.id, target: kwId, linkType: 'keyword' });
      }
    }
    return { nodes: [...kpNodes, ...kwNodes], links };
  }

  // Build inverted index: keyword -> list of node ids that have it
  const kwToNodeIds = new Map<string, string[]>();
  for (const [nodeId, kwList] of kpKeywords) {
    for (const kw of kwList) {
      let arr = kwToNodeIds.get(kw);
      if (!arr) { arr = []; kwToNodeIds.set(kw, arr); }
      arr.push(nodeId);
    }
  }

  // Collect all pairs sharing a keyword via inverted index (O(n * k) instead of O(n^2))
  // Also store (a, b) tuples for new links
  const pairsWithKeyword = new Set<string>();
  const newKeywordPairs: [string, string][] = [];
  for (const [, nodeIds] of kwToNodeIds) {
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const key = linkKey(nodeIds[i], nodeIds[j]);
        if (!pairsWithKeyword.has(key)) {
          pairsWithKeyword.add(key);
          const a = nodeIds[i] < nodeIds[j] ? nodeIds[i] : nodeIds[j];
          const b = nodeIds[i] < nodeIds[j] ? nodeIds[j] : nodeIds[i];
          newKeywordPairs.push([a, b]);
        }
      }
    }
  }

  // Upgrade existing sequence links to keyword type if they share keywords
  for (const link of links) {
    const key = linkKey(String(link.source), String(link.target));
    if (pairsWithKeyword.has(key)) link.linkType = 'keyword';
  }

  // Add new keyword links for pairs not already linked
  for (const [a, b] of newKeywordPairs) {
    const key = linkKey(a, b);
    if (!seenLinks.has(key)) {
      seenLinks.add(key);
      links.push({ source: a, target: b, linkType: 'keyword' });
    }
  }

  return { nodes: kpNodes, links };
}

function getGraphColors(el: HTMLElement | null): {
  nodeFillByWeight: string[];
  nodeBorderByWeight: string[];
  nodeHighlight: string;
  nodeBorderHighlight: string;
  entityNodeText: string;
  keywordNodeFill: string;
  keywordNodeBorder: string;
  keywordNodeText: string;
  linkSequence: string;
  linkKeyword: string;
  bg: string;
} {
  const root = el?.closest('.kg-root') ?? document.querySelector('.kg-root');
  const fallbackWeightColors = [
    '#94a3b8', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7',
  ];
  const fallbackBorder = ['#64748b', '#2563eb', '#16a34a', '#d97706', '#7c3aed'];
  if (!root) {
    return {
      nodeFillByWeight: fallbackWeightColors,
      nodeBorderByWeight: fallbackBorder,
      nodeHighlight: '#2563eb',
      nodeBorderHighlight: '#1d4ed8',
      entityNodeText: '#ffffff',
      keywordNodeFill: '#bae6fd',
      keywordNodeBorder: '#7dd3fc',
      keywordNodeText: '#0f172a',
      linkSequence: '#64748b',
      linkKeyword: '#059669',
      bg: '#f1f5f9',
    };
  }
  const s = getComputedStyle(root);
  const get = (key: string, fallback: string) => s.getPropertyValue(key).trim() || fallback;
  const nodeFillByWeight = [1, 2, 3, 4, 5].map((w) => get(`--kg-node-weight-${w}`, fallbackWeightColors[w - 1]));
  const nodeBorderByWeight = [1, 2, 3, 4, 5].map((w) => get(`--kg-node-border-weight-${w}`, fallbackBorder[w - 1]));
  return {
    nodeFillByWeight,
    nodeBorderByWeight,
    nodeHighlight: get('--kg-node-highlight', '#2563eb'),
    nodeBorderHighlight: get('--kg-node-border-highlight', '#1d4ed8'),
    entityNodeText: get('--kg-entity-node-text', '#ffffff'),
    keywordNodeFill: get('--kg-keyword-node-fill', '#bae6fd'),
    keywordNodeBorder: get('--kg-keyword-node-border', '#7dd3fc'),
    keywordNodeText: get('--kg-keyword-node-text', '#0f172a'),
    linkSequence: get('--kg-link-sequence', '#64748b'),
    linkKeyword: get('--kg-link-keyword', '#059669'),
    bg: get('--kg-bg', '#f1f5f9'),
  };
}

type GraphNodeWithCoords = GraphNode & { x?: number; y?: number };

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  onSelectKnowledgePoint,
  selectedKnowledgePointId = null,
}) => {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 400, h: 300 });
  const [minWeight, setMinWeight] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawKps, setRawKps] = useState<KnowledgePoint[] | null>(null);
  const [graphMode, setGraphMode] = useState<GraphMode>('shared');
  const [highlightNode, setHighlightNode] = useState<string | null>(null);
  const externalHighlightNodeId = selectedKnowledgePointId != null ? String(selectedKnowledgePointId) : null;
  const [zoomMode, setZoomMode] = useState(false);
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const [zoomSize, setZoomSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.offsetWidth || 400, h: el.offsetHeight || 300 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!zoomMode) return;
    const el = zoomContainerRef.current;
    if (!el) return;
    const update = () => setZoomSize({ w: el.offsetWidth || 800, h: el.offsetHeight || 600 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [zoomMode]);

  useEffect(() => {
    if (!zoomMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomMode(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomMode]);

  const graphData = useMemo<GraphData | null>(() => {
    if (!rawKps) return null;
    return buildGraphData(rawKps, graphMode);
  }, [rawKps, graphMode]);

  const onRefresh = useCallback(() => {
    setError(null);
    setLoading(true);
    const w = Math.max(1, Math.min(5, Number(minWeight)));
    getKnowledgePointsForGraph(w)
      .then((kps) => setRawKps(kps))
      .catch((e) => setError(e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [minWeight]);

  useEffect(() => {
    onRefresh();
  }, [minWeight, onRefresh]);

  const colorsRef = useRef(getGraphColors(null));
  useEffect(() => {
    colorsRef.current = getGraphColors(rootRef.current);
  });

  const drawNode = useCallback(
    (node: GraphNodeWithCoords, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const colors = colorsRef.current;
      const label = (node.label || node.id).slice(0, MAX_LABEL_LEN);
      const lines = labelToLines(label);
      const cx = node.x ?? 0;
      const cy = node.y ?? 0;
      const isEntity = node.nodeType === 'entity';
      const weight = isEntity && 'weight' in node ? Math.max(1, Math.min(5, node.weight)) : 1;
      const weightIndex = weight - 1;
      const isHighlight = (externalHighlightNodeId ?? highlightNode) === node.id;

      if (isEntity) {
        const r = (ENTITY_RADIUS_BASE + (weight - 1) * ENTITY_RADIUS_PER_WEIGHT) / globalScale;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.fillStyle = isHighlight ? colors.nodeHighlight : colors.nodeFillByWeight[weightIndex];
        ctx.fill();
        ctx.strokeStyle = isHighlight ? colors.nodeBorderHighlight : colors.nodeBorderByWeight[weightIndex];
        ctx.lineWidth = (isHighlight ? 2 : 1.2) / globalScale;
        ctx.setLineDash([]);
        ctx.stroke();
        const fontSize = Math.max(MIN_FONT_SIZE, ENTITY_FONT_SIZE / globalScale);
        const lineHeight = fontSize * 1.2;
        ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = colors.entityNodeText;
        const totalTextHeight = lines.length * lineHeight;
        const startY = cy - totalTextHeight / 2 + lineHeight / 2;
        lines.forEach((line, i) => {
          ctx.fillText(line, cx, startY + i * lineHeight);
        });
      } else {
        const r = KEYWORD_RADIUS / globalScale;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.fillStyle = isHighlight ? colors.nodeHighlight : colors.keywordNodeFill;
        ctx.fill();
        ctx.strokeStyle = isHighlight ? colors.nodeBorderHighlight : colors.keywordNodeBorder;
        ctx.lineWidth = (isHighlight ? 2 : 1) / globalScale;
        ctx.setLineDash([]);
        ctx.stroke();
        const fontSize = Math.max(MIN_FONT_SIZE, KEYWORD_FONT_SIZE / globalScale);
        const lineHeight = fontSize * 1.2;
        ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = colors.keywordNodeText;
        const totalTextHeight = lines.length * lineHeight;
        const startY = cy - totalTextHeight / 2 + lineHeight / 2;
        lines.forEach((line, i) => {
          ctx.fillText(line, cx, startY + i * lineHeight);
        });
      }
    },
    [highlightNode, externalHighlightNodeId]
  );

  const drawLink = useCallback(
    (
      link: { source: string | GraphNodeWithCoords; target: string | GraphNodeWithCoords; linkType: string },
      ctx: CanvasRenderingContext2D
    ) => {
      const colors = colorsRef.current;
      const src = typeof link.source === 'object' && link.source && 'x' in link.source ? (link.source as GraphNodeWithCoords) : null;
      const tgt = typeof link.target === 'object' && link.target && 'x' in link.target ? (link.target as GraphNodeWithCoords) : null;
      if (!src || !tgt) return;
      const sx = src.x ?? 0;
      const sy = src.y ?? 0;
      const tx = tgt.x ?? 0;
      const ty = tgt.y ?? 0;
      const isKeyword = link.linkType === 'keyword';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = isKeyword ? colors.linkKeyword : colors.linkSequence;
      ctx.lineWidth = isKeyword ? 1.5 : 1.2;
      ctx.setLineDash(isKeyword ? [6, 5] : []);
      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = isKeyword ? 0.85 : 0.9;
      ctx.stroke();
      ctx.globalAlpha = prevAlpha;
      ctx.setLineDash([]);
    },
    []
  );

  const nodeLabel = useCallback((n: GraphNodeWithCoords) => {
    const typeLabel = n.nodeType === 'entity' ? t('knowledgeGraph.nodeTypeEntity') : t('knowledgeGraph.nodeTypeKeyword');
    const content = n.fullContent ?? n.label ?? n.id;
    const short = content.length > 120 ? content.slice(0, 120) + '...' : content;
    return `${typeLabel}\n${short}`;
  }, [t]);

  const nodePointerAreaPaint = useCallback(
    (node: GraphNodeWithCoords, paintColor: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const cx = node.x ?? 0;
      const cy = node.y ?? 0;
      const isEntity = node.nodeType === 'entity';
      const r = isEntity
        ? (ENTITY_RADIUS_BASE + ('weight' in node ? (Math.max(1, Math.min(5, node.weight)) - 1) * ENTITY_RADIUS_PER_WEIGHT : 0)) / globalScale
        : KEYWORD_RADIUS / globalScale;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fillStyle = paintColor;
      ctx.fill();
    },
    []
  );

  const fgRef = useRef<{
    d3Force: (name: string) => { strength?: (n: number) => void; distance?: (n: number) => void };
    d3ReheatSimulation?: () => void;
  } | null>(null);

  const onNodeDragEnd = useCallback((node: GraphNodeWithCoords) => {
    delete (node as Record<string, unknown>).fx;
    delete (node as Record<string, unknown>).fy;
    fgRef.current?.d3ReheatSimulation?.();
  }, []);

  const fgCommon = useMemo(
    () => ({
      nodeId: 'id' as const,
      nodeLabel,
      enableNodeDrag: true,
      onNodeClick: (n: GraphNodeWithCoords) => {
        if (n.nodeType === 'entity' && 'kp' in n) {
          if (onSelectKnowledgePoint) {
            setHighlightNode(null);
            onSelectKnowledgePoint(n.kp);
          } else {
            setHighlightNode((prev) => (prev === n.id ? null : n.id ?? null));
          }
          return;
        }
        setHighlightNode((prev) => (prev === n.id ? null : n.id ?? null));
      },
      onBackgroundClick: () => setHighlightNode(null),
      onNodeDragEnd,
      nodeCanvasObject: drawNode,
      nodePointerAreaPaint,
      linkCanvasObject: drawLink,
      linkDirectionalArrowLength: 0,
      d3AlphaDecay: 0.022,
      d3VelocityDecay: 0.4,
      cooldownTicks: 200,
    }),
    [nodeLabel, drawNode, drawLink, onNodeDragEnd, nodePointerAreaPaint, onSelectKnowledgePoint]
  );

  useEffect(() => {
    const g = fgRef.current;
    if (!g || !graphData) return;
    const charge = g.d3Force('charge');
    const link = g.d3Force('link');
    if (charge?.strength) charge.strength(-80);
    if (link?.distance) link.distance(180);
  }, [graphData]);

  const bgColor = colorsRef.current.bg;

  return (
    <div ref={rootRef} className="kg-root">
      <div className="kg-toolbar">
        <span className="kg-toolbar-group" title={t('knowledgeGraph.minWeight')}>
          <BarChart2 size={16} className="kg-toolbar-icon" aria-hidden />
          <select
            className="kg-weight-select"
            value={minWeight}
            onChange={(e) => setMinWeight(Number(e.target.value))}
            aria-label={t('knowledgeGraph.minWeight')}
          >
            {[1, 2, 3, 4, 5].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </span>
        <span className="kg-toolbar-group" title={t('knowledgeGraph.graphMode')}>
          <Network size={16} className="kg-toolbar-icon" aria-hidden />
          <select
            className="kg-weight-select"
            value={graphMode}
            onChange={(e) => setGraphMode(e.target.value as GraphMode)}
            aria-label={t('knowledgeGraph.graphMode')}
          >
            <option value="shared">{t('knowledgeGraph.modeShared')}</option>
            <option value="keywordNodes">{t('knowledgeGraph.modeKeywordNodes')}</option>
          </select>
        </span>
        <button
          type="button"
          className="kg-refresh-btn"
          onClick={onRefresh}
          disabled={loading}
          aria-label={t('knowledgeGraph.refresh')}
          title={t('knowledgeGraph.refresh')}
        >
          {loading ? t('knowledgeGraph.loading') : t('knowledgeGraph.refresh')}
        </button>
        {graphData && graphData.nodes.length > 0 && (
          <>
            <div className="kg-legend" aria-hidden="true" title={t('knowledgeGraph.legend')}>
              <span className="kg-legend-item" title={t('knowledgeGraph.nodeTypeEntity')}>
                <span className="kg-legend-node kg-legend-entity" />
                {t('knowledgeGraph.nodeTypeEntity')}
              </span>
              <span className="kg-legend-item" title={t('knowledgeGraph.nodeTypeKeyword')}>
                <span className="kg-legend-node kg-legend-keyword" />
                {t('knowledgeGraph.nodeTypeKeyword')}
              </span>
              <span className="kg-legend-item" title={t('knowledgeGraph.linkSequence')}>
                <span className="kg-legend-line kg-legend-sequence" />
                {t('knowledgeGraph.linkSequence')}
              </span>
              <span className="kg-legend-item" title={t('knowledgeGraph.linkKeyword')}>
                <span className="kg-legend-line kg-legend-keyword-line" />
                {t('knowledgeGraph.linkKeyword')}
              </span>
            </div>
            <button
              type="button"
              className="kg-icon-btn kg-zoom-btn"
              onClick={() => setZoomMode(true)}
              aria-label={t('knowledgeGraph.zoomMode')}
              title={t('knowledgeGraph.zoomMode')}
            >
              <Maximize2 size={18} aria-hidden />
            </button>
          </>
        )}
      </div>
      {error && <p className="kg-error" role="alert">{error}</p>}
      <div ref={containerRef} className="kg-graph-container">
        {graphData && graphData.nodes.length === 0 && !loading && (
          <p className="kg-empty">{t('knowledgeGraph.noPoints')}</p>
        )}
        {graphData && graphData.nodes.length > 0 && (
          <ForceGraph2D
            ref={fgRef as any}
            graphData={graphData as any}
            width={size.w}
            height={size.h}
            backgroundColor={bgColor}
            {...fgCommon}
          />
        )}
      </div>
      {zoomMode && graphData && graphData.nodes.length > 0 && (
        <div
          className="kg-zoom-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('knowledgeGraph.zoomMode')}
        >
          <div className="kg-zoom-header">
            <span className="kg-zoom-title">{t('knowledgeGraph.zoomTitle')}</span>
            <button
              type="button"
              className="kg-zoom-close"
              onClick={() => setZoomMode(false)}
              aria-label={t('knowledgeGraph.zoomClose')}
            >
              <X size={24} aria-hidden />
            </button>
          </div>
          <div ref={zoomContainerRef} className="kg-zoom-graph">
            <ForceGraph2D
              graphData={graphData as any}
              width={zoomSize.w}
              height={zoomSize.h}
              backgroundColor={bgColor}
              {...fgCommon}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraph;
