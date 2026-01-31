import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RightPanelTab, ActivityType } from './VSLayout';
import ChatAssistant from '../ChatAssistant';

interface RightPanelProps {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  onClose: () => void;
  content?: ReactNode;
  activeActivity: ActivityType;
}

interface TabItem {
  id: RightPanelTab;
  titleKey: string;
}

const tabs: TabItem[] = [
  { id: 'chat', titleKey: 'panel.chat' },
  { id: 'properties', titleKey: 'panel.properties' },
  { id: 'details', titleKey: 'panel.details' },
  { id: 'help', titleKey: 'panel.help' }
];

const HelpContent: React.FC<{ activity: ActivityType }> = ({ activity }) => {
  const { t } = useTranslation();

  const getHelpContent = () => {
    switch (activity) {
      case 'training':
        return (
          <>
            <p>{t('trainingLab.usageStep1')}</p>
            <p>{t('trainingLab.usageStep2')}</p>
            <p>{t('trainingLab.usageStep3')}</p>
            <p>{t('trainingLab.usageStep4')}</p>
            <p>{t('trainingLab.usageStep5')}</p>
          </>
        );
      case 'datacenter':
        return (
          <>
            <p>{t('wizard.upload.description')}</p>
            <p>{t('dataCenter.noKnowledgePoints')}</p>
          </>
        );
      case 'production':
        return <p>{t('wizard.configure.description')}</p>;
      case 'privacy':
        return <p>{t('privacyCenter.autoDesensitization')}</p>;
      default:
        return <p>{t('wizard.welcome.intro')}</p>;
    }
  };

  return (
    <div className="vs-help-content" style={{ padding: '16px', lineHeight: '1.6', fontSize: '13px' }}>
      <h3 style={{ marginBottom: '12px', fontSize: '14px', borderBottom: '1px solid var(--vs-border)', paddingBottom: '8px' }}>
        {t(`nav.${activity}`)}
      </h3>
      {getHelpContent()}
    </div>
  );
};

const RightPanel: React.FC<RightPanelProps> = ({
  activeTab,
  onTabChange,
  onClose,
  content,
  activeActivity
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
        {activeTab === 'chat' && <ChatAssistant />}
        {activeTab === 'help' && <HelpContent activity={activeActivity} />}
        {(activeTab === 'properties' || activeTab === 'details') && (
          content ? content : (
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
          )
        )}
      </div>
    </div>
  );
};

export default RightPanel;
