import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../Tooltip';
import {
  selectFolder,
  listSystemDir,
  getFileIcon as fetchFileIcon,
  getMountPoints,
  createMountPoint,
  deleteMountPoint,
  type DirEntry,
  type MountPoint,
} from '../../services/api';
import './FileExplorer.css';

const ICON_FOLDER = '\uD83D\uDCC1';
const ICON_FOLDER_OPEN = '\uD83D\uDCC2';
const ICON_FILE = '\uD83D\uDCC4';

const iconCache = new Map<string, string>();

const DOC_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'md', 'txt', 'jpg', 'jpeg', 'png',
  'ppt', 'pptx', 'wps', 'rtf'
]);

function getFileExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function isDocumentFile(name: string): boolean {
  return DOC_EXTENSIONS.has(getFileExt(name));
}

function getFallbackIcon(name: string): string {
  const ext = getFileExt(name);
  switch (ext) {
    case 'pdf': return '\uD83D\uDCD5';
    case 'doc':
    case 'docx':
    case 'wps':
    case 'rtf': return '\uD83D\uDCD2';
    case 'ppt':
    case 'pptx': return '\uD83D\uDCCA';
    case 'md':
    case 'txt': return '\uD83D\uDCDD';
    case 'jpg':
    case 'jpeg':
    case 'png': return '\uD83D\uDDBC';
    default: return ICON_FILE;
  }
}

export type { MountPoint };

const LEGACY_STORAGE_KEY = 'fileExplorerMountPoints';

function loadLegacyMountPoints(): { path: string; name: string }[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((p: { path?: string; name?: string }) => ({
      path: typeof p.path === 'string' ? p.path : '',
      name: typeof p.name === 'string' ? p.name : ''
    })).filter((p: { path: string }) => p.path.length > 0);
  } catch {
    return [];
  }
}

function clearLegacyMountPoints() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch { /* ignore */ }
}

interface FsNode {
  name: string;
  isDirectory: boolean;
  fullPath: string;
}

interface FsNodeItemProps {
  node: FsNode;
  level: number;
}

const FsNodeItem: React.FC<FsNodeItemProps> = ({ node, level }) => {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FsNode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const ext = getFileExt(node.name);
  const [sysIcon, setSysIcon] = useState<string | null>(() =>
    iconCache.get(node.fullPath) ?? iconCache.get(`ext:${ext}`) ?? null
  );

  useEffect(() => {
    if (node.isDirectory || sysIcon) return;
    const cached = iconCache.get(`ext:${ext}`);
    if (cached) {
      setSysIcon(cached);
      return;
    }
    fetchFileIcon(node.fullPath).then((base64) => {
      if (base64) {
        iconCache.set(node.fullPath, base64);
        iconCache.set(`ext:${ext}`, base64);
        setSysIcon(base64);
      }
    });
  }, [node.fullPath, node.name, node.isDirectory, ext, sysIcon]);

  const loadChildren = useCallback(async () => {
    if (loaded || !node.isDirectory) return;
    setLoading(true);
    try {
      const entries = await listSystemDir(node.fullPath);
      const base = node.fullPath.replace(/[/\\]+$/, '');
      const sep = node.fullPath.includes('\\') ? '\\' : '/';
      const nodes: FsNode[] = entries
        .filter((e: DirEntry) => e.isDirectory || isDocumentFile(e.name))
        .map((e: DirEntry) => ({
          name: e.name,
          isDirectory: e.isDirectory,
          fullPath: `${base}${sep}${e.name}`
        }));
      setChildren(nodes);
      setLoaded(true);
    } catch {
      setChildren([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [loaded, node.isDirectory, node.fullPath]);

  const handleToggle = () => {
    if (!node.isDirectory) return;
    if (!expanded && !loaded) {
      loadChildren();
    }
    setExpanded(!expanded);
  };

  const indent = level * 14;
  const folderIcon = expanded ? ICON_FOLDER_OPEN : ICON_FOLDER;
  const fileIconEl = node.isDirectory ? (
    <span className="fe-tree-icon">{folderIcon}</span>
  ) : sysIcon ? (
    <img className="fe-tree-icon-img" src={`data:image/png;base64,${sysIcon}`} alt="" />
  ) : (
    <span className="fe-tree-icon">{getFallbackIcon(node.name)}</span>
  );
  return (
    <div className="fe-tree-node">
      <div
        className={`fe-tree-item ${node.isDirectory ? 'directory' : 'file'}`}
        style={{ paddingLeft: indent }}
        onClick={handleToggle}
      >
        {fileIconEl}
        <Tooltip title={node.name}>
          <span className="fe-tree-name">{node.name}</span>
        </Tooltip>
      </div>
      {node.isDirectory && expanded && (
        <div className="fe-tree-children">
          {loading ? (
            <div className="fe-loading" style={{ paddingLeft: indent + 24 }}>...</div>
          ) : (
            children.map((child, idx) => (
              <FsNodeItem
                key={`${child.fullPath}-${idx}`}
                node={child}
                level={level + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const mpKey = (mp: MountPoint) => String(mp.id);

export const MOUNT_POINTS_CHANGED_EVENT = 'mount-points-changed';

const syncMountPointsFromBackend = (
  setMountPoints: React.Dispatch<React.SetStateAction<MountPoint[]>>
) => {
  getMountPoints()
    .then((list) => {
      const byId = new Map(list.map((mp) => [mp.id, mp]));
      setMountPoints(Array.from(byId.values()));
    })
    .catch(() => setMountPoints([]));
};

const FileExplorer: React.FC = () => {
  const { t } = useTranslation();
  const [mountPoints, setMountPoints] = useState<MountPoint[]>([]);
  const [expandedMount, setExpandedMount] = useState<string | null>(null);
  const [mountChildren, setMountChildren] = useState<Map<string, FsNode[]>>(new Map());

  useEffect(() => {
    const handler = () => syncMountPointsFromBackend(setMountPoints);
    window.addEventListener(MOUNT_POINTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MOUNT_POINTS_CHANGED_EVENT, handler);
  }, []);

  useEffect(() => {
    getMountPoints()
      .then((list) => {
        const byId = new Map(list.map((mp) => [mp.id, mp]));
        const unique = Array.from(byId.values());
        if (unique.length > 0) {
          setMountPoints(unique);
          return;
        }
        const legacy = loadLegacyMountPoints();
        if (legacy.length === 0) {
          setMountPoints([]);
          return;
        }
        clearLegacyMountPoints();
        Promise.all(legacy.map((p) => createMountPoint(p.path, p.name || undefined)))
          .then((created) => {
            const createdById = new Map(created.map((mp) => [mp.id, mp]));
            setMountPoints(Array.from(createdById.values()));
          })
          .catch(() => setMountPoints([]));
      })
      .catch(() => setMountPoints([]));
  }, []);

  const handleAddMount = async () => {
    const path = await selectFolder();
    if (!path?.trim()) return;
    const parts = path.replace(/[/\\]+$/, '').split(/[/\\]/);
    const name = parts[parts.length - 1] || path;
    try {
      await createMountPoint(path, name);
      syncMountPointsFromBackend(setMountPoints);
      window.dispatchEvent(new CustomEvent(MOUNT_POINTS_CHANGED_EVENT));
    } catch (e) {
      console.error('Create mount point failed:', e);
    }
  };

  const handleRemoveMount = async (id: number) => {
    if (!window.confirm(t('fileResourcesWorkspace.confirmRemoveMountPoint'))) return;
    const idNum = Number(id);
    try {
      await deleteMountPoint(idNum);
      const key = String(idNum);
      setMountPoints((prev) => prev.filter((p) => Number(p.id) !== idNum));
      setExpandedMount((prev) => (prev === key ? null : prev));
      setMountChildren((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      window.dispatchEvent(new CustomEvent(MOUNT_POINTS_CHANGED_EVENT));
    } catch (e) {
      console.error('Delete mount point failed:', e);
      window.alert(e instanceof Error ? e.message : String(e));
    }
  };

  const loadMountContents = async (mp: MountPoint) => {
    const key = mpKey(mp);
    if (mountChildren.has(key)) return;
    try {
      const entries = await listSystemDir(mp.path);
      const base = mp.path.replace(/[/\\]+$/, '');
      const sep = mp.path.includes('\\') ? '\\' : '/';
      const nodes: FsNode[] = entries
        .filter((e: DirEntry) => e.isDirectory || isDocumentFile(e.name))
        .map((e: DirEntry) => ({
          name: e.name,
          isDirectory: e.isDirectory,
          fullPath: `${base}${sep}${e.name}`
        }));
      setMountChildren((prev) => new Map(prev).set(key, nodes));
    } catch {
      setMountChildren((prev) => new Map(prev).set(key, []));
    }
  };

  const handleMountToggle = (mp: MountPoint) => {
    const key = mpKey(mp);
    if (expandedMount === key) {
      setExpandedMount(null);
    } else {
      loadMountContents(mp);
      setExpandedMount(key);
    }
  };

  return (
    <div className="fe-container">
      <div className="fe-mount-header">
        <button className="fe-add-mount-btn" onClick={handleAddMount}>
          + {t('sidebar.addMountPoint')}
        </button>
      </div>
      <div className="fe-tree">
        {mountPoints.length === 0 ? (
          <div
            className="fe-add-hint"
            onClick={handleAddMount}
          >
            {t('sidebar.noMountPoints')}
          </div>
        ) : (
          mountPoints.map((mp) => (
            <div key={mp.id} className="fe-mount-node">
              <div
                className="fe-mount-item"
                onClick={() => handleMountToggle(mp)}
              >
                <span className="fe-tree-icon">
                  {expandedMount === mpKey(mp) ? ICON_FOLDER_OPEN : ICON_FOLDER}
                </span>
                <Tooltip title={mp.path}>
                  <span className="fe-tree-name">{mp.name || mp.path}</span>
                </Tooltip>
                <Tooltip title={t('sidebar.removeMountPoint')}>
                  <button
                    className="fe-remove-mount"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveMount(mp.id);
                    }}
                  >
                  {'\u00D7'}
                </button>
                </Tooltip>
              </div>
              {expandedMount === mpKey(mp) && (
                <div className="fe-tree-children">
                  {(mountChildren.get(mpKey(mp)) || []).map((node, idx) => (
                    <FsNodeItem
                      key={`${node.fullPath}-${idx}`}
                      node={node}
                      level={1}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
