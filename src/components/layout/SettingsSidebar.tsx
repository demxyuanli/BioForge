import React from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsTab } from '../Settings';

interface SettingsSidebarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="vs-sidebar-header">
        <span className="vs-sidebar-title">{t('settings.title')}</span>
      </div>
      <div className="vs-sidebar-content">
        <div className="sidebar-section">
          <div className="sidebar-list">
            <div 
              className={`sidebar-item ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => onTabChange('general')}
              style={{ backgroundColor: activeTab === 'general' ? 'var(--vs-list-hover)' : 'transparent' }}
            >
              <span className="item-name" style={{ paddingLeft: '8px' }}>{t('settings.general.title')}</span>
            </div>
            <div 
              className={`sidebar-item ${activeTab === 'models' ? 'active' : ''}`}
              onClick={() => onTabChange('models')}
              style={{ backgroundColor: activeTab === 'models' ? 'var(--vs-list-hover)' : 'transparent' }}
            >
              <span className="item-name" style={{ paddingLeft: '8px' }}>{t('settings.models.title') || 'Model Configuration'}</span>
            </div>
            <div 
              className={`sidebar-item ${activeTab === 'privacy' ? 'active' : ''}`}
              onClick={() => onTabChange('privacy')}
              style={{ backgroundColor: activeTab === 'privacy' ? 'var(--vs-list-hover)' : 'transparent' }}
            >
              <span className="item-name" style={{ paddingLeft: '8px' }}>{t('settings.privacy.title') || 'Privacy & Rules'}</span>
            </div>
            <div 
              className={`sidebar-item ${activeTab === 'context' ? 'active' : ''}`}
              onClick={() => onTabChange('context')}
              style={{ backgroundColor: activeTab === 'context' ? 'var(--vs-list-hover)' : 'transparent' }}
            >
              <span className="item-name" style={{ paddingLeft: '8px' }}>{t('settings.context.title') || 'Context & Knowledge'}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default React.memo(SettingsSidebar);