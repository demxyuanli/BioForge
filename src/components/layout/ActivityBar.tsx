import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityType } from './VSLayout';

interface ActivityBarProps {
  activeActivity: ActivityType;
  onActivityChange: (activity: ActivityType) => void;
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
}

interface ActivityItem {
  id: ActivityType;
  icon: string;
  titleKey: string;
}

const activities: ActivityItem[] = [
  { id: 'dashboard', icon: '\u2302', titleKey: 'nav.dashboard' },
  { id: 'datacenter', icon: '\u2630', titleKey: 'nav.dataCenter' },
  { id: 'training', icon: '\u2699', titleKey: 'nav.trainingLab' },
  { id: 'production', icon: '\u26A1', titleKey: 'nav.productionTuning' },
  { id: 'evaluation', icon: '\u2713', titleKey: 'nav.evaluation' },
  { id: 'privacy', icon: '\u26BF', titleKey: 'nav.privacyCenter' }
];

const ActivityBar: React.FC<ActivityBarProps> = ({
  activeActivity,
  onActivityChange,
  sidebarVisible,
  onToggleSidebar
}) => {
  const { t } = useTranslation();

  const handleActivityClick = (activity: ActivityType) => {
    if (activity === activeActivity && sidebarVisible) {
      onToggleSidebar();
    } else {
      onActivityChange(activity);
      if (!sidebarVisible) {
        onToggleSidebar();
      }
    }
  };

  return (
    <div className="vs-activity-bar">
      <div className="vs-activity-top">
        {activities.map((item) => (
          <button
            key={item.id}
            className={`vs-activity-item ${activeActivity === item.id ? 'active' : ''}`}
            onClick={() => handleActivityClick(item.id)}
            title={t(item.titleKey)}
          >
            <span className="vs-activity-icon">{item.icon}</span>
          </button>
        ))}
      </div>
      <div className="vs-activity-bottom">
        <button
          className="vs-activity-item"
          onClick={onToggleSidebar}
          title={t('panel.toggleSidebar')}
        >
          <span className="vs-activity-icon">{sidebarVisible ? '\u25C0' : '\u25B6'}</span>
        </button>
        <button
          className="vs-activity-item"
          title={t('panel.settings')}
        >
          <span className="vs-activity-icon">&#x2699;</span>
        </button>
      </div>
    </div>
  );
};

export default ActivityBar;
