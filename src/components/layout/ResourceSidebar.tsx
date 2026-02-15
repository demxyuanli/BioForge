import React from 'react';
import { useTranslation } from 'react-i18next';
import { Document, FinetuningJob } from '../../services/api';
import { ActivityType } from './VSLayout';
import FileExplorer from './FileExplorer';
import KnowledgeBaseTree from './KnowledgeBaseTree';
import OverviewStatusList from './OverviewStatusList';
import RecentKnowledgeList from './RecentKnowledgeList';
import ChatHistorySidebar from '../ChatHistorySidebar';

interface ResourceSidebarProps {
  documents: Document[];
  jobs: FinetuningJob[];
  activity: ActivityType;
  selectedSubItem: string;
  onSubItemChange: (subItem: string) => void;
}

const ResourceSidebar: React.FC<ResourceSidebarProps> = ({
  documents: _documents,
  jobs,
  activity,
  selectedSubItem,
  onSubItemChange
}) => {
  const { t } = useTranslation();

  const getSubItems = (act: ActivityType): string[] => {
    const items = t(`sidebar.activityItems.${act}`, { returnObjects: true }) as Record<string, string>;
    return items ? Object.keys(items) : [];
  };

  const getSubItemLabel = (act: ActivityType, key: string): string => {
    return t(`sidebar.activityItems.${act}.${key}`, { defaultValue: key });
  };

  const subItems = getSubItems(activity);

  if (activity === 'chat') {
    return (
      <>
        <div className="vs-sidebar-header">
          <span className="vs-sidebar-title">{t(`sidebar.activityTitles.${activity}`)}</span>
        </div>
        <div className="vs-sidebar-content">
          <ChatHistorySidebar />
        </div>
      </>
    );
  }

  const renderContent = () => {
    if (subItems.length === 0) {
      return null;
    }

    switch (activity) {
      case 'dashboard':
        switch (selectedSubItem) {
          case 'overview':
            return <OverviewStatusList />;
          case 'recentDocuments':
            return <RecentKnowledgeList />;
          case 'recentJobs':
            return (
              <div className="sidebar-section">
                <div className="sidebar-list">
                  {jobs.length === 0 ? (
                    <div className="sidebar-empty">{t('sidebar.noJobs')}</div>
                  ) : (
                    jobs.slice(0, 20).map(job => (
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
              </div>
            );
          default:
            return <OverviewStatusList />;
        }
      case 'fileResources':
        switch (selectedSubItem) {
          case 'fileExplorer':
            return <FileExplorer />;
          case 'knowledgeBase':
            return <KnowledgeBaseTree />;
          default:
            return <FileExplorer />;
        }
      case 'datacenter':
        switch (selectedSubItem) {
          case 'knowledgeCreation':
            return <FileExplorer />;
          case 'knowledgePointsManagement':
            return <div className="sidebar-empty">{t('sidebar.comingSoon')}</div>;
          case 'keywordManagement':
            return <div className="sidebar-empty">{t('sidebar.comingSoon')}</div>;
          default:
            return <FileExplorer />;
        }
      case 'knowledgeBase':
        switch (selectedSubItem) {
          case 'knowledgeTree':
            return <KnowledgeBaseTree />;
          case 'knowledgeGraph':
            return <div className="sidebar-empty">{t('sidebar.comingSoon')}</div>;
          case 'knowledgeManagement':
            return <div className="sidebar-empty">{t('sidebar.comingSoon')}</div>;
          default:
            return <KnowledgeBaseTree />;
        }
      case 'training':
        switch (selectedSubItem) {
          case 'knowledgePoints':
            return <div className="sidebar-empty">{t('sidebar.comingSoon')}</div>;
          case 'annotations':
            return <div className="sidebar-empty">{t('sidebar.comingSoon')}</div>;
          case 'exportJsonl':
            return <div className="sidebar-empty">{t('sidebar.comingSoon')}</div>;
          default:
            return <div className="sidebar-empty">{t('sidebar.comingSoon')}</div>;
        }
      case 'production':
        switch (selectedSubItem) {
          case 'datasetAndCost':
            return <div className="sidebar-empty"></div>;
          case 'jobs':
            return (
              <div className="sidebar-section">
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
              </div>
            );
          case 'logs':
            return <div className="sidebar-empty">{t('sidebar.comingSoon')}</div>;
          default:
            return <div className="sidebar-empty"></div>;
        }
      case 'evaluation':
        switch (selectedSubItem) {
          case 'templates':
            return <div className="sidebar-empty">{t('sidebar.comingSoon')}</div>;
          case 'customPrompt':
            return <div className="sidebar-empty">{t('sidebar.comingSoon')}</div>;
          case 'compareResult':
            return <div className="sidebar-empty">{t('sidebar.comingSoon')}</div>;
          default:
            return <div className="sidebar-empty">{t('sidebar.comingSoon')}</div>;
        }
      default:
        return <FileExplorer />;
    }
  };

  if (subItems.length === 0) {
    return (
      <div className="vs-sidebar-content">
        <FileExplorer />
      </div>
    );
  }

  return (
    <>
      <div className="vs-sidebar-header">
        <span className="vs-sidebar-title">{t(`sidebar.activityTitles.${activity}`)}</span>
      </div>
      <div className="vs-sidebar-content">
        <div className="sidebar-section">
          <div className="sidebar-list">
            {subItems.map((itemKey) => (
              <div
                key={itemKey}
                className={`sidebar-item ${selectedSubItem === itemKey ? 'active' : ''}`}
                onClick={() => onSubItemChange(itemKey)}
                style={{ backgroundColor: selectedSubItem === itemKey ? 'var(--vs-list-hover)' : 'transparent' }}
              >
                <span className="item-name" style={{ paddingLeft: '8px' }}>
                  {getSubItemLabel(activity, itemKey)}
                </span>
              </div>
            ))}
          </div>
        </div>
        {renderContent()}
      </div>
    </>
  );
};

export default React.memo(ResourceSidebar);
