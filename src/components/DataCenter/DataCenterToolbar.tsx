import React from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FolderPlus } from 'lucide-react';
import Tooltip from '../Tooltip';

interface DataCenterToolbarProps {
  uploadProgress: string;
  isUploading: boolean;
  onUploadClick: () => void;
  isCreatingDir: boolean;
  newDirName: string;
  onNewDirNameChange: (value: string) => void;
  onCreateDirectory: () => void;
  onCancelCreateDir: () => void;
  onStartCreateDir: () => void;
}

const DataCenterToolbar: React.FC<DataCenterToolbarProps> = ({
  uploadProgress,
  isUploading,
  onUploadClick,
  isCreatingDir,
  newDirName,
  onNewDirNameChange,
  onCreateDirectory,
  onCancelCreateDir,
  onStartCreateDir,
}) => {
  const { t } = useTranslation();
  return (
    <div className="dc-toolbar">
      <div className="dc-toolbar-left">
        {uploadProgress ? <span className="dc-upload-status">{uploadProgress}</span> : null}
      </div>
      <div className="dc-toolbar-right">
        {!isCreatingDir ? (
          <>
            <Tooltip title={t('dataCenter.uploadFile')}>
              <button
                type="button"
                onClick={onUploadClick}
                disabled={isUploading}
                className="dc-icon-btn dc-icon-btn-primary"
                aria-label={t('dataCenter.uploadFile')}
              >
                <Upload size={14} />
              </button>
            </Tooltip>
            <Tooltip title={t('dataCenter.newFolder')}>
              <button
                type="button"
                onClick={onStartCreateDir}
                className="dc-icon-btn"
                aria-label={t('dataCenter.newFolder')}
              >
                <FolderPlus size={14} />
              </button>
            </Tooltip>
          </>
        ) : (
          <div className="dc-new-folder">
            <input
              type="text"
              value={newDirName}
              onChange={(e) => onNewDirNameChange(e.target.value)}
              placeholder={t('dataCenter.folderName')}
              onKeyDown={(e) => e.key === 'Enter' && onCreateDirectory()}
              className="dc-input"
            />
            <button type="button" onClick={onCreateDirectory} className="dc-btn dc-btn-small">
              {t('common.ok')}
            </button>
            <button type="button" onClick={onCancelCreateDir} className="dc-btn dc-btn-small">
              {t('common.cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataCenterToolbar;
