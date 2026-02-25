import React from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../Tooltip';
import type { MountPoint } from '../../services/api';
import type { SelectedFile, SearchResultItem } from '../../hooks/useFileResourcesWorkspaceData';
import type { RecentAnnotatedFileItem } from '../../services/api';

export interface FileResourcesWorkspaceRightPanelProps {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  searchResults: SearchResultItem[];
  recentAnnotated: RecentAnnotatedFileItem[];
  mountPoints: MountPoint[];
  selectedMp: MountPoint | null;
  selectedFile: SelectedFile | null;
  setSelectedMp: React.Dispatch<React.SetStateAction<MountPoint | null>>;
  setSelectedFile: React.Dispatch<React.SetStateAction<SelectedFile | null>>;
  setExpandedNoteRowKey: React.Dispatch<React.SetStateAction<string | null>>;
}

export const FileResourcesWorkspaceRightPanel: React.FC<
  FileResourcesWorkspaceRightPanelProps
> = ({
  searchQuery,
  setSearchQuery,
  searchResults,
  recentAnnotated,
  mountPoints,
  selectedMp,
  selectedFile,
  setSelectedMp,
  setSelectedFile,
  setExpandedNoteRowKey,
}) => {
  const { t } = useTranslation();

  return (
    <div className="fr-workspace-right">
      <div className="fr-search-section">
        <input
          type="text"
          className="fr-search-input"
          placeholder={t('fileResourcesWorkspace.searchFiles')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t('fileResourcesWorkspace.searchFiles')}
        />
      </div>
      <div className="fr-results-section">
        <div className="fr-section-title">{t('fileResourcesWorkspace.searchResults')}</div>
        <ul
          className="fr-file-list"
          role="listbox"
          aria-label={t('fileResourcesWorkspace.searchResults')}
        >
          {searchQuery.trim() ? (
            searchResults.length === 0 ? (
              <li className="fr-file-item fr-empty">
                {t('fileResourcesWorkspace.noResults')}
              </li>
            ) : (
              searchResults.map((item) => (
                <li
                  key={item.rowKey}
                  className={`fr-file-item ${
                    selectedMp?.id === item.mp.id &&
                    selectedFile?.relativePath === item.path
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => {
                    setSelectedMp(item.mp);
                    setExpandedNoteRowKey(null);
                    setSelectedFile({
                      mpId: item.mp.id,
                      relativePath: item.path,
                      filename: item.filename,
                      ext: item.ext,
                    });
                  }}
                  role="option"
                  aria-selected={
                    selectedMp?.id === item.mp.id &&
                    selectedFile?.relativePath === item.path
                  }
                >
                  <Tooltip title={item.filename}>
                    <span className="fr-file-name">{item.filename}</span>
                  </Tooltip>
                  <Tooltip title={item.mp.name || item.mp.path}>
                    <span className="fr-file-search-mp">
                      {item.mp.name || item.mp.path}
                    </span>
                  </Tooltip>
                </li>
              ))
            )
          ) : (
            <li className="fr-file-item fr-empty">
              {t('fileResourcesWorkspace.typeToSearch')}
            </li>
          )}
        </ul>
      </div>
      <div className="fr-recent-section">
        <div className="fr-section-title">
          {t('fileResourcesWorkspace.recentAnnotatedFiles')}
        </div>
        <ul
          className="fr-file-list"
          role="listbox"
          aria-label={t('fileResourcesWorkspace.recentAnnotatedFiles')}
        >
          {recentAnnotated.length === 0 ? (
            <li className="fr-file-item fr-empty">
              {t('fileResourcesWorkspace.noRecentAnnotatedFiles')}
            </li>
          ) : (
            recentAnnotated.map((item, idx) => {
              const isSelected =
                selectedMp?.id === item.mount_point_id &&
                selectedFile?.relativePath === item.relative_path;
              const filename =
                item.filename || item.relative_path.replace(/^.*[/\\]/, '');
              const ext = filename.includes('.')
                ? filename.split('.').pop()!.toLowerCase()
                : '';
              return (
                <li
                  key={`${item.mount_point_id}:${item.relative_path}:${idx}`}
                  className={`fr-file-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    const mp = mountPoints.find(
                      (m) => m.id === item.mount_point_id
                    );
                    if (mp) {
                      setSelectedMp(mp);
                      setSelectedFile({
                        mpId: item.mount_point_id,
                        relativePath: item.relative_path,
                        filename,
                        ext,
                      });
                    }
                  }}
                  role="option"
                  aria-selected={isSelected}
                >
                  <Tooltip title={filename}>
                    <span className="fr-file-name">{filename}</span>
                  </Tooltip>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
};
