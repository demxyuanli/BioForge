import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityType } from './VSLayout';
import FileExplorer from './FileExplorer';
import KnowledgeBaseTree from './KnowledgeBaseTree';
import RecentKnowledgeList from './RecentKnowledgeList';
import OverviewStatusList from './OverviewStatusList';

export type ResourceView = 'files' | 'knowledge';

const ACTIVITIES_WITH_SIDEBAR: ActivityType[] = [
  'dashboard',
  'fileResources',
  'knowledgeBase',
  'datacenter',
  'training',
  'production',
  'evaluation',
  'chat'
];

const ITEM_KEYS_BY_ACTIVITY: Record<ActivityType, string[]> = {
  dashboard: [],
  fileResources: [],
  knowledgeBase: ['knowledgeTree', 'knowledgeGraph', 'knowledgeManagement'],
  datacenter: ['knowledgeCreation', 'knowledgePointsManagement', 'keywordManagement'],
  training: ['knowledgePoints', 'annotations', 'exportJsonl'],
  production: ['datasetAndCost', 'jobs', 'logs'],
  evaluation: ['templates', 'customPrompt', 'compareResult'],
  chat: ['conversation'],
  settings: [],
  explorer: []
};

const ITEM_TO_VIEW: Record<string, ResourceView> = {
  fileExplorer: 'files',
  knowledgeBase: 'knowledge',
  documentsAndFolders: 'files',
  knowledgePoints: 'knowledge',
  knowledgeCreation: 'files',
  knowledgePointsManagement: 'knowledge',
  keywordManagement: 'knowledge',
  knowledgeTree: 'knowledge',
  knowledgeGraph: 'knowledge',
  knowledgeManagement: 'knowledge'
};

interface ResourceSidebarProps {
  activity: ActivityType;
  activeView: ResourceView;
  onViewChange?: (view: ResourceView) => void;
  selectedSubItem?: string;
  onSubItemChange?: (key: string) => void;
}

const ResourceSidebar: React.FC<ResourceSidebarProps> = ({
  activity,
  activeView,
  onViewChange,
  selectedSubItem,
  onSubItemChange
}) => {
  const { t } = useTranslation();
  const hasSidebar = ACTIVITIES_WITH_SIDEBAR.includes(activity);
  const itemKeys = hasSidebar ? ITEM_KEYS_BY_ACTIVITY[activity] : [];
  const isResourceActivity =
    activity === 'fileResources' || activity === 'datacenter' || activity === 'knowledgeBase';

  const handleItemClick = (key: string) => {
    const view = ITEM_TO_VIEW[key];
    if (view && onViewChange && isResourceActivity) {
      onViewChange(view);
    }
    if (onSubItemChange) {
      onSubItemChange(key);
    }
  };

  const getActiveItem = (): string | undefined => {
    if (activity === 'knowledgeBase') {
      return selectedSubItem ?? 'knowledgeTree';
    }
    if (activity === 'datacenter') {
      return selectedSubItem ?? 'knowledgeCreation';
    }
    if (isResourceActivity) {
      if (activeView === 'files') return 'fileExplorer';
      return 'knowledgeBase';
    }
    return selectedSubItem ?? (itemKeys.length ? itemKeys[0] : undefined);
  };

  const activeItem = getActiveItem();

  if (!hasSidebar) {
    return (
      <div className="vs-sidebar-content">
        {activeView === 'files' ? <FileExplorer /> : <KnowledgeBaseTree />}
      </div>
    );
  }

  const titleKey = `sidebar.activityTitles.${activity}`;
  const title = t(titleKey);

  return (
    <>
      <div className="vs-sidebar-header">
        <span className="vs-sidebar-title">{title}</span>
      </div>
      {itemKeys.length > 0 && (
      <div className="sidebar-section">
        <div className="sidebar-list">
          {itemKeys.map((key) => {
            const itemLabelKey = `sidebar.activityItems.${activity}.${key}`;
            const isActive = activeItem === key;
            return (
              <div
                key={key}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                onClick={() => handleItemClick(key)}
                style={{ backgroundColor: isActive ? 'var(--vs-list-hover)' : 'transparent' }}
              >
                <span className="item-name" style={{ paddingLeft: '8px' }}>
                  {t(itemLabelKey)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      )}
      <div className="vs-sidebar-content">
        {activity === 'fileResources' ? (
          <FileExplorer />
        ) : activity === 'knowledgeBase' ? (
          <RecentKnowledgeList />
        ) : activity === 'datacenter' ? (
          <div className="vs-sidebar-placeholder">
            {t('sidebar.selectActivity')}
          </div>
        ) : isResourceActivity ? (
          activeView === 'files' ? <FileExplorer /> : <KnowledgeBaseTree />
        ) : activity === 'dashboard' ? (
          <OverviewStatusList />
        ) : (
          <div className="vs-sidebar-placeholder">
            {t('sidebar.selectActivity')}
          </div>
        )}
      </div>
    </>
  );
};

export default ResourceSidebar;
