import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomPanelTab } from './VSLayout';
import Tooltip from '../Tooltip';

interface BottomPanelProps {
  activeTab: BottomPanelTab;
  onTabChange: (tab: BottomPanelTab) => void;
  onClose: () => void;
  content?: ReactNode;
}

interface TabItem {
  id: BottomPanelTab;
  titleKey: string;
}

const tabs: TabItem[] = [
  { id: 'output', titleKey: 'panel.output' },
  { id: 'logs', titleKey: 'panel.logs' },
  { id: 'problems', titleKey: 'panel.problems' }
];

const BottomPanel: React.FC<BottomPanelProps> = ({
  activeTab,
  onTabChange,
  onClose,
  content
}) => {
  const { t } = useTranslation();

  return (
    <div className="vs-panel-container">
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
          <Tooltip title={t('panel.clear')}>
            <button className="vs-panel-action">
              &#x2715;
            </button>
          </Tooltip>
          <Tooltip title={t('panel.maximize')}>
            <button className="vs-panel-action">
              &#x25A1;
            </button>
          </Tooltip>
          <Tooltip title={t('panel.close')}>
            <button className="vs-panel-action" onClick={onClose}>
              &#x2715;
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="vs-panel-content">
        {content || (
          <div className="vs-panel-placeholder">
            <div className="vs-output-line">
              <span className="vs-output-time">[{new Date().toLocaleTimeString()}]</span>
              <span className="vs-output-text">{t('panel.noOutput')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BottomPanel;
