import React from 'react';
import { useTranslation } from 'react-i18next';
import { FolderPlus, Pencil, Trash2 } from 'lucide-react';
import Tooltip from '../Tooltip';
import type { MountPoint, MountPointDocumentStats } from '../../services/api';

export interface FileResourcesWorkspaceMountListProps {
  mountPoints: MountPoint[];
  selectedMp: MountPoint | null;
  setSelectedMp: React.Dispatch<React.SetStateAction<MountPoint | null>>;
  statsByMpId: Map<number, MountPointDocumentStats>;
  addingMp: boolean;
  editingMpId: number | null;
  setEditingMpId: React.Dispatch<React.SetStateAction<number | null>>;
  editingName: string;
  setEditingName: React.Dispatch<React.SetStateAction<string>>;
  removing: boolean;
  onAddMountPoint: () => Promise<void>;
  onSaveMountName: (mp: MountPoint) => Promise<void>;
  onRemoveMountPoint: (mp?: MountPoint | null) => Promise<void>;
}

export const FileResourcesWorkspaceMountList: React.FC<
  FileResourcesWorkspaceMountListProps
> = ({
  mountPoints,
  selectedMp,
  setSelectedMp,
  statsByMpId,
  addingMp,
  editingMpId,
  setEditingMpId,
  editingName,
  setEditingName,
  removing,
  onAddMountPoint,
  onSaveMountName,
  onRemoveMountPoint,
}) => {
  const { t } = useTranslation();

  return (
    <div className="fr-attachment-list-section">
      <div className="fr-attachment-header">
        <div className="fr-section-title">{t('fileResourcesWorkspace.mountPointList')}</div>
        <div className="fr-mount-header-btns">
          <Tooltip title={t('fileResourcesWorkspace.addMountPoint')}>
            <button
              type="button"
              className="fr-add-mount-btn"
              onClick={onAddMountPoint}
              disabled={addingMp}
              aria-label={t('fileResourcesWorkspace.addMountPoint')}
            >
              <FolderPlus className="fr-add-mount-icon" size={14} aria-hidden />
            </button>
          </Tooltip>
        </div>
      </div>
      <div
        className="fr-cli-panel fr-cli-mount-list"
        role="listbox"
        aria-label={t('fileResourcesWorkspace.mountPointList')}
      >
        {mountPoints.length === 0 ? (
          <div className="fr-cli-line fr-cli-empty">
            {t('fileResourcesWorkspace.noMountPoints')}
          </div>
        ) : (
          mountPoints.map((mp) => {
            const stats = statsByMpId.get(mp.id);
            const isSelected = selectedMp?.id === mp.id;
            const isEditing = editingMpId === mp.id;
            return (
              <div
                key={mp.id}
                className={`fr-cli-mount-row ${isSelected ? 'selected' : ''}`}
                onClick={() => !isEditing && setSelectedMp(mp)}
                role="option"
                aria-selected={isSelected}
              >
                <Tooltip title={mp.path}>
                  <span className="fr-cli-mount-name">
                    {isEditing ? (
                      <input
                        type="text"
                        className="fr-cli-mount-name-input"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => onSaveMountName(mp)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onSaveMountName(mp);
                          if (e.key === 'Escape') {
                            setEditingMpId(null);
                            setEditingName('');
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={t('fileResourcesWorkspace.displayName')}
                      />
                    ) : (
                      <>
                        <span className="fr-cli-prompt">$</span> {mp.name || mp.path}
                      </>
                    )}
                  </span>
                </Tooltip>
                {stats != null && (
                  <span className="fr-cli-mount-stats">
                    {stats.total > 0
                      ? t('fileResourcesWorkspace.totalDocuments', { count: stats.total })
                      : t('fileResourcesWorkspace.noDocumentsInMount')}
                  </span>
                )}
                <span className="fr-cli-mount-actions">
                  <Tooltip title={t('fileResourcesWorkspace.editName')}>
                    <button
                      type="button"
                      className="fr-cli-mount-btn fr-cli-mount-edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingMpId(mp.id);
                        setEditingName(mp.name || mp.path || '');
                      }}
                      disabled={isEditing}
                      aria-label={t('common.edit')}
                    >
                      <Pencil size={14} aria-hidden />
                    </button>
                  </Tooltip>
                  <Tooltip title={t('fileResourcesWorkspace.removeMountPoint')}>
                    <button
                      type="button"
                      className="fr-cli-mount-btn fr-cli-mount-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveMountPoint(mp);
                      }}
                      disabled={removing}
                      aria-label={t('fileResourcesWorkspace.removeMountPoint')}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </Tooltip>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
