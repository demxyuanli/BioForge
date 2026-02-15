import React from 'react';
import './FileExplorer.css';

const FileExplorer: React.FC = () => {
  return (
    <div className="fe-container">
      <div className="sidebar-empty"></div>
    </div>
  );
};

export default FileExplorer;

export const MOUNT_POINTS_CHANGED_EVENT = 'mount-points-changed';
export const DOCUMENTS_CHANGED_EVENT = 'documents-changed';
