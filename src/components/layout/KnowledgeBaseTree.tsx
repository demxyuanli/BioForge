import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../Tooltip';
import {
  getDirectories,
  getKnowledgePoints,
  moveDocument,
  moveDirectory,
  type DirectoryNode,
  type KnowledgePoint
} from '../../services/api';
import './KnowledgeBaseTree.css';

const ICON_FOLDER = '\uD83D\uDCC1';
const ICON_FOLDER_OPEN = '\uD83D\uDCC2';
const ICON_DOC = '\uD83D\uDCC4';

const DRAG_TYPE = 'application/x-kbt-node';

function collectDescendantIds(node: DirectoryNode): Set<number> {
  const ids = new Set<number>([node.id]);
  if (node.type === 'directory' && node.children) {
    for (const child of node.children) {
      for (const id of collectDescendantIds(child)) {
        ids.add(id);
      }
    }
  }
  return ids;
}

interface ManagedNodeProps {
  node: DirectoryNode;
  level: number;
  pointsByDoc: Map<number, KnowledgePoint[]>;
  onRefresh: () => void;
}

const ManagedNode: React.FC<ManagedNodeProps> = ({ node, level, pointsByDoc, onRefresh }) => {
  const [expanded, setExpanded] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const isDir = node.type === 'directory';
  const hasChildren = isDir && node.children && node.children.length > 0;
  const points = !isDir ? (pointsByDoc.get(node.id) || []) : [];

  const indent = level * 14;
  const icon = isDir
    ? (expanded ? ICON_FOLDER_OPEN : ICON_FOLDER)
    : ICON_DOC;

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    const payload: { type: string; id: number; descendantIds?: number[] } = {
      type: node.type,
      id: node.id
    };
    if (node.type === 'directory') {
      payload.descendantIds = Array.from(collectDescendantIds(node));
    }
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as { type: string; id: number; descendantIds?: number[] };
      const { type, id, descendantIds = [] } = data;
      if (!isDir) return;
      const targetDirId = node.id;
      if (type === 'file') {
        await moveDocument(id, targetDirId);
      } else if (type === 'directory') {
        if (id === targetDirId || descendantIds.includes(targetDirId)) return;
        await moveDirectory(id, targetDirId);
      }
      onRefresh();
    } catch {
      /* ignore */
    }
  };

  const canDrop = (raw: string): boolean => {
    try {
      const data = JSON.parse(raw) as { type: string; id: number; descendantIds?: number[] };
      const { type, id, descendantIds = [] } = data;
      if (!isDir) return false;
      if (type === 'file') return true;
      if (type === 'directory') {
        return id !== node.id && !descendantIds.includes(node.id);
      }
      return false;
    } catch {
      return false;
    }
  };

  const adjustedHandleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };

  const adjustedHandleDrop = (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (raw && canDrop(raw)) {
      handleDrop(e);
    }
  };

  const isDropTarget = isDir;

  return (
    <div className="kbt-tree-node">
      <div
        className={`kbt-item ${isDir ? 'dir' : 'file'} ${dragOver ? 'kbt-drag-over' : ''}`}
        style={{ paddingLeft: indent }}
        draggable
        onDragStart={handleDragStart}
        onDragOver={isDropTarget ? adjustedHandleDragOver : undefined}
        onDragLeave={isDropTarget ? handleDragLeave : undefined}
        onDrop={isDropTarget ? adjustedHandleDrop : undefined}
        onClick={() => isDir && setExpanded(!expanded)}
      >
        <span className="kbt-expand">
          {isDir ? (expanded ? '\u25BE' : '\u25B8') : '\u2003'}
        </span>
        <span className="kbt-icon">{icon}</span>
        <Tooltip title={node.name}>
          <span className="kbt-name">{node.name}</span>
        </Tooltip>
        {!isDir && node.processed && <span className="kbt-badge">{'\u2713'}</span>}
        {!isDir && points.length > 0 && <span className="kbt-count">({points.length})</span>}
      </div>
      {isDir && hasChildren && expanded && (
        <div className="kbt-children">
          {node.children!.map((child) => (
            <ManagedNode
              key={`${child.type}-${child.id}`}
              node={child}
              level={level + 1}
              pointsByDoc={pointsByDoc}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const KnowledgeBaseTree: React.FC = () => {
  const { t } = useTranslation();
  const [tree, setTree] = useState<DirectoryNode[]>([]);
  const [pointsByDoc, setPointsByDoc] = useState<Map<number, KnowledgePoint[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [rootDragOver, setRootDragOver] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dirResult, resp] = await Promise.all([
        getDirectories(),
        getKnowledgePoints(1, 2000)
      ]);
      setTree(dirResult || []);
      const points = resp.knowledge_points || [];
      const map = new Map<number, KnowledgePoint[]>();
      for (const kp of points) {
        const docId = Number(kp.document_id);
        const list = map.get(docId) || [];
        list.push(kp);
        map.set(docId, list);
      }
      setPointsByDoc(map);
    } catch (error) {
      setTree([]);
      setPointsByDoc(new Map());
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="kbt-container">
        <div className="kbt-loading">{t('sidebar.loading')}</div>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="kbt-container">
        <div className="kbt-empty">{t('dataCenter.noKnowledgePoints')}</div>
      </div>
    );
  }

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setRootDragOver(true);
  };

  const handleRootDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setRootDragOver(false);
    }
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRootDragOver(false);
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as { type: string; id: number };
      const { type, id } = data;
      if (type === 'file') {
        await moveDocument(id, undefined);
      } else if (type === 'directory') {
        await moveDirectory(id, undefined);
      }
      loadData();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="kbt-container">
      <div className="kbt-tree">
        <div
          className={`kbt-root-drop ${rootDragOver ? 'kbt-drag-over' : ''}`}
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
        />
        {tree.map((node) => (
          <ManagedNode
            key={`${node.type}-${node.id}`}
            node={node}
            level={0}
            pointsByDoc={pointsByDoc}
            onRefresh={loadData}
          />
        ))}
      </div>
    </div>
  );
};

export default KnowledgeBaseTree;
