import { useMemo } from 'react';
import type { DirectoryNode } from '../services/api';
import type { BreadcrumbItem } from '../components/DataCenter/DataCenterDirectoryBreadcrumbs';

function findNode(nodes: DirectoryNode[], id: number): DirectoryNode | null {
  for (const n of nodes) {
    if (n.id === id && n.type === 'directory') return n;
    if (n.children) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function useDataCenterBreadcrumbs(
  directoryTree: DirectoryNode[],
  currentDirId: number | null
): BreadcrumbItem[] {
  return useMemo(() => {
    if (currentDirId === null) return [{ id: null, name: 'Root' }];
    const crumbs: { id: number; name: string }[] = [];
    let id: number | null | undefined = currentDirId;
    while (id) {
      const node = findNode(directoryTree, id);
      if (node) {
        crumbs.unshift({ id: node.id, name: node.name });
        id = node.parentId;
      } else break;
    }
    return [{ id: null, name: 'Root' }, ...crumbs];
  }, [directoryTree, currentDirId]);
}
