import React from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Database, GraduationCap, Settings2, CheckSquare, Settings, FolderOpen, BookOpen, MessageCircle } from 'lucide-react';
import { ActivityType } from './VSLayout';

interface ActivityBarProps {
  activeActivity: ActivityType;
  onActivityChange: (activity: ActivityType) => void;
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
}

interface ActivityItem {
  id: ActivityType;
  icon: React.ReactNode;
  titleKey: string;
}

const activities: ActivityItem[] = [
  { id: 'fileResources', icon: <FolderOpen size={18} strokeWidth={1.5} />, titleKey: 'nav.fileResources' },
  { id: 'knowledgeBase', icon: <BookOpen size={18} strokeWidth={1.5} />, titleKey: 'nav.knowledgeBase' },
  { id: 'dashboard', icon: <LayoutDashboard size={18} strokeWidth={1.5} />, titleKey: 'nav.dashboard' },
  { id: 'datacenter', icon: <Database size={18} strokeWidth={1.5} />, titleKey: 'nav.dataCenter' },
  { id: 'training', icon: <GraduationCap size={18} strokeWidth={1.5} />, titleKey: 'nav.trainingLab' },
  { id: 'production', icon: <Settings2 size={18} strokeWidth={1.5} />, titleKey: 'nav.productionTuning' },
  { id: 'evaluation', icon: <CheckSquare size={18} strokeWidth={1.5} />, titleKey: 'nav.evaluation' },
  { id: 'chat', icon: <MessageCircle size={18} strokeWidth={1.5} />, titleKey: 'nav.chat' }
];

const ActivityBar: React.FC<ActivityBarProps> = ({
  activeActivity,
  onActivityChange,
  sidebarVisible,
  onToggleSidebar
}) => {
  const { t } = useTranslation();

  const handleActivityClick = (activity: ActivityType) => {
    if (activity === 'settings') {
      onActivityChange('settings');
      if (!sidebarVisible) onToggleSidebar();
      return;
    }
    // For other activities, switch content and ensure sidebar is visible
    onActivityChange(activity);
    if (!sidebarVisible) onToggleSidebar();
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
          <span className="vs-activity-icon" style={{ fontSize: '12px' }}>{sidebarVisible ? '◀' : '▶'}</span>
        </button>
        <button
          className={`vs-activity-item ${activeActivity === 'settings' ? 'active' : ''}`}
          title={t('panel.settings')}
          onClick={() => handleActivityClick('settings')}
        >
          <span className="vs-activity-icon"><Settings size={18} strokeWidth={1.5} /></span>
        </button>
      </div>
    </div>
  );
};

export default ActivityBar;