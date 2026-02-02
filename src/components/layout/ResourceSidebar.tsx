import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Document, FinetuningJob } from '../../services/api';
import KnowledgeBaseTree from './KnowledgeBaseTree';
import { SidebarViewType } from './VSLayout';

interface ResourceSidebarProps {
  documents: Document[];
  jobs: FinetuningJob[];
  activeSidebarView: SidebarViewType;
  onSidebarViewChange: (view: SidebarViewType) => void;
  onCreateFolder?: (parentId: string | null, name: string) => Promise<void>;
  onMoveItem?: (itemId: string, targetId: string | null) => Promise<void>;
  onDeleteItem?: (itemId: string) => Promise<void>;
}

const ResourceSidebar: React.FC<ResourceSidebarProps> = ({
  documents,
  jobs,
  activeSidebarView,
  onSidebarViewChange
}) => {
  const { t } = useTranslation();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'files': true,
    'knowledge': true,
    'jobs': true
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Switch view based on activeSidebarView if needed, or just show everything in sections?
  // The original VSLayout had buttons to switch between "files" and "knowledge".
  // The user asked for "Resource Icon" to switch to "File Library and Knowledge Base content".
  // Let's implement tabs within the sidebar header to switch views, utilizing the props passed from App.tsx.

  return (
    <>
      <div className="vs-sidebar-header">
        <div className="vs-sidebar-tabs">
          <button
            className={`vs-sidebar-tab ${activeSidebarView === 'files' ? 'active' : ''}`}
            onClick={() => onSidebarViewChange('files')}
            title={t('sidebar.fileExplorer')}
          >
            <span className="vs-sidebar-tab-icon">{'\uD83D\uDCC1'}</span>
            <span className="vs-sidebar-tab-label">{t('sidebar.fileExplorer')}</span>
          </button>
          <button
            className={`vs-sidebar-tab ${activeSidebarView === 'knowledge' ? 'active' : ''}`}
            onClick={() => onSidebarViewChange('knowledge')}
            title={t('sidebar.knowledgeBase')}
          >
            <span className="vs-sidebar-tab-icon">{'\uD83D\uDCDA'}</span>
            <span className="vs-sidebar-tab-label">{t('sidebar.knowledgeBase')}</span>
          </button>
        </div>
      </div>
      
      <div className="vs-sidebar-content">
        {activeSidebarView === 'files' && (
          <>
            <div className="sidebar-section">
              <h4 onClick={() => toggleSection('files')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <span style={{ transform: expandedSections['files'] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', marginRight: '4px' }}>▶</span>
                {t('sidebar.files')}
              </h4>
              {expandedSections['files'] && (
                <div className="sidebar-list">
                  {documents.length === 0 ? (
                    <div className="sidebar-empty">{t('sidebar.noFiles')}</div>
                  ) : (
                    documents.map(doc => (
                      <div key={doc.id} className="sidebar-item" title={doc.filename}>
                        <span className="item-icon">📄</span>
                        <span className="item-name">{doc.filename}</span>
                        <span className={`item-status ${doc.processed ? 'processed' : 'pending'}`}>
                          {doc.processed ? '✓' : '○'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            <div className="sidebar-section">
              <h4 onClick={() => toggleSection('jobs')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <span style={{ transform: expandedSections['jobs'] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', marginRight: '4px' }}>▶</span>
                {t('sidebar.jobs')}
              </h4>
              {expandedSections['jobs'] && (
                <div className="sidebar-list">
                  {jobs.length === 0 ? (
                    <div className="sidebar-empty">{t('sidebar.noJobs')}</div>
                  ) : (
                    jobs.map(job => (
                      <div key={job.id} className="sidebar-item">
                        <span className="item-icon">⚙</span>
                        <span className="item-name">{job.model}</span>
                        <span className={`item-status status-${job.status}`}>
                          {job.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {activeSidebarView === 'knowledge' && (
          <div style={{ height: '100%' }}>
            <KnowledgeBaseTree />
          </div>
        )}
      </div>
    </>
  );
};

export default ResourceSidebar;