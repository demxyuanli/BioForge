import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RightPanelTab } from './VSLayout';

interface RightPanelProps {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  onClose: () => void;
  content?: ReactNode;
}

interface TabItem {
  id: RightPanelTab;
  titleKey: string;
}

const tabs: TabItem[] = [
  { id: 'properties', titleKey: 'panel.properties' },
  { id: 'details', titleKey: 'panel.details' },
  { id: 'help', titleKey: 'panel.help' }
];

const RightPanel: React.FC<RightPanelProps> = ({
  activeTab,
  onTabChange,
  onClose,
  content
}) => {
  const { t } = useTranslation();

  return (
    <div className="vs-panel-container vs-right-panel-container">
      <div className="vs-panel-header">
        <div className="vs-panel-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`vs-panel-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {t(tab.titleKey)}
            </button>
          ))}
        </div>
        <div className="vs-panel-actions">
          <button className="vs-panel-action" onClick={onClose} title={t('panel.close')}>
            &#x2715;
          </button>
        </div>
      </div>
      <div className="vs-panel-content">
        {content || (
          <div className="vs-properties-list">
            <div className="vs-property-group">
              <div className="vs-property-group-header">{t('panel.generalProperties')}</div>
              <div className="vs-property-item">
                <span className="vs-property-label">{t('panel.name')}</span>
                <span className="vs-property-value">-</span>
              </div>
              <div className="vs-property-item">
                <span className="vs-property-label">{t('panel.type')}</span>
                <span className="vs-property-value">-</span>
              </div>
              <div className="vs-property-item">
                <span className="vs-property-label">{t('panel.status')}</span>
                <span className="vs-property-value">-</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RightPanel;
