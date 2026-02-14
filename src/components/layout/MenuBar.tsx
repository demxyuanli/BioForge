import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityType } from './VSLayout';
import Tooltip from '../Tooltip';
import './MenuBar.css';

interface MenuBarProps {
  activeActivity: ActivityType;
  onActivityChange: (a: ActivityType) => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  isMaximized: boolean;
  onTitleBarDrag: (e: React.MouseEvent) => void;
  onTitleBarDoubleClick: () => void;
  onToggleSidebar?: () => void;
  onTogglePanel?: () => void;
  sidebarVisible?: boolean;
  bottomPanelVisible?: boolean;
  onLanguageChange?: (lng: string) => void;
  currentLanguage?: string;
}

type MenuId = 'file' | 'knowledge' | 'training' | 'production' | 'view' | 'layout' | 'settings' | 'help';

const MenuBar: React.FC<MenuBarProps> = ({
  activeActivity,
  onActivityChange,
  onMinimize,
  onMaximize,
  onClose,
  isMaximized,
  onTitleBarDrag,
  onTitleBarDoubleClick,
  onToggleSidebar,
  onTogglePanel,
  sidebarVisible = true,
  bottomPanelVisible = true,
  onLanguageChange,
  currentLanguage = 'en'
}) => {
  const { t } = useTranslation();
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ left: 0, top: 32 });
  const [showDocumentation, setShowDocumentation] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
      if (e.altKey && ['f', 'k', 't', 'p', 'v', 'l', 's', 'h'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        const map: Record<string, MenuId> = {
          f: 'file', k: 'knowledge', t: 'training', p: 'production',
          v: 'view', l: 'layout', s: 'settings', h: 'help'
        };
        setOpenMenu((m) => (m === map[e.key.toLowerCase()] ? null : map[e.key.toLowerCase()]));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const menuItems: { id: MenuId; key: string; labelKey: string }[] = [
    { id: 'file', key: 'F', labelKey: 'menu.file' },
    { id: 'knowledge', key: 'K', labelKey: 'menu.knowledge' },
    { id: 'training', key: 'T', labelKey: 'menu.training' },
    { id: 'production', key: 'P', labelKey: 'menu.production' },
    { id: 'view', key: 'V', labelKey: 'menu.view' },
    { id: 'layout', key: 'L', labelKey: 'menu.layout' },
    { id: 'settings', key: 'S', labelKey: 'menu.settings' },
    { id: 'help', key: 'H', labelKey: 'menu.help' }
  ];

  const handleNavBack = () => {
    const order: ActivityType[] = ['dashboard', 'fileResources', 'knowledgeBase', 'datacenter', 'training', 'production', 'evaluation', 'chat'];
    const idx = order.indexOf(activeActivity);
    if (idx > 0) onActivityChange(order[idx - 1]);
  };

  const handleNavForward = () => {
    const order: ActivityType[] = ['dashboard', 'fileResources', 'knowledgeBase', 'datacenter', 'training', 'production', 'evaluation', 'chat'];
    const idx = order.indexOf(activeActivity);
    if (idx >= 0 && idx < order.length - 1) onActivityChange(order[idx + 1]);
  };

  const getMenuItems = (id: MenuId) => {
    switch (id) {
      case 'file':
        return [
          { key: 'openWizard', action: () => window.dispatchEvent(new CustomEvent('open-wizard')) },
          { key: 'uploadDocument', action: () => {} },
          { key: 'importKnowledge', action: () => {} },
          { key: 'exportData', action: () => {} }
        ];
      case 'knowledge':
        return [
          { key: 'createKnowledgePoint', action: () => {} },
          { key: 'manageKnowledgeBase', action: () => onActivityChange('knowledgeBase') },
          { key: 'knowledgeGraph', action: () => {} },
          { key: 'dataCenter', action: () => onActivityChange('datacenter') }
        ];
      case 'training':
        return [
          { key: 'startTraining', action: () => {} },
          { key: 'trainingJobs', action: () => onActivityChange('training') },
          { key: 'exportDataset', action: () => {} }
        ];
      case 'production':
        return [
          { key: 'deployModel', action: () => {} },
          { key: 'productionJobs', action: () => onActivityChange('production') },
          { key: 'monitor', action: () => {} }
        ];
      case 'view':
        return [
          { key: 'dashboard', action: () => onActivityChange('dashboard') },
          { key: 'fileResources', action: () => onActivityChange('fileResources') },
          { key: 'knowledgeBase', action: () => onActivityChange('knowledgeBase') },
          { key: 'dataCenter', action: () => onActivityChange('datacenter') },
          { key: 'trainingLab', action: () => onActivityChange('training') },
          { key: 'productionTuning', action: () => onActivityChange('production') },
          { key: 'evaluation', action: () => onActivityChange('evaluation') },
          { key: 'chat', action: () => onActivityChange('chat') }
        ];
      case 'layout':
        return [
          { key: 'toggleSidebar', action: () => onToggleSidebar?.(), checked: sidebarVisible },
          { key: 'togglePanel', action: () => onTogglePanel?.(), checked: bottomPanelVisible },
          { key: 'language', action: () => onLanguageChange?.(currentLanguage === 'zh' ? 'en' : 'zh') }
        ];
      case 'settings':
        return [
          { 
            key: 'general', 
            action: () => {
              onActivityChange('settings');
              window.dispatchEvent(new CustomEvent('settings-tab-change', { detail: 'general' }));
            }
          },
          { 
            key: 'models', 
            action: () => {
              onActivityChange('settings');
              window.dispatchEvent(new CustomEvent('settings-tab-change', { detail: 'models' }));
            }
          },
          { 
            key: 'privacy', 
            action: () => {
              onActivityChange('settings');
              window.dispatchEvent(new CustomEvent('settings-tab-change', { detail: 'privacy' }));
            }
          },
          { 
            key: 'context', 
            action: () => {
              onActivityChange('settings');
              window.dispatchEvent(new CustomEvent('settings-tab-change', { detail: 'context' }));
            }
          }
        ];
      case 'help':
        return [
          { key: 'documentation', action: () => setShowDocumentation(true) },
          { key: 'about', action: () => setShowAbout(true) }
        ];
      default:
        return [];
    }
  };

  return (
    <div
      className="menubar"
      ref={menuRef}
      onMouseDown={onTitleBarDrag}
      onDoubleClick={onTitleBarDoubleClick}
    >
      <div className="menubar-left" onMouseDown={(e) => e.stopPropagation()}>
        <span className="menubar-icon">&#9830;</span>
        {menuItems.map((item) => (
          <div
            key={item.id}
            className={`menubar-item ${openMenu === item.id ? 'active' : ''}`}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setDropdownPos({ left: rect.left, top: rect.bottom });
              setOpenMenu(openMenu === item.id ? null : item.id);
            }}
          >
            {t(item.labelKey)}({item.key})
          </div>
        ))}
        <div className="menubar-nav" onMouseDown={(e) => e.stopPropagation()}>
          <Tooltip title={t('menu.back')}>
            <button className="menubar-nav-btn" onClick={handleNavBack}>
              {'\u2190'}
            </button>
          </Tooltip>
          <Tooltip title={t('menu.forward')}>
            <button className="menubar-nav-btn" onClick={handleNavForward}>
              {'\u2192'}
            </button>
          </Tooltip>
        </div>
        <span className="menubar-title">{t('app.title')}</span>
      </div>

      {openMenu && getMenuItems(openMenu).length > 0 && (
        <div
          className="menubar-dropdown"
          style={{ left: `${dropdownPos.left}px`, top: `${dropdownPos.top}px` }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {getMenuItems(openMenu).map((sub) => {
            const checked = 'checked' in sub ? sub.checked : undefined;
            return (
              <div
                key={sub.key}
                className="menubar-dropdown-item"
                onClick={() => {
                  sub.action();
                  setOpenMenu(null);
                }}
              >
                {checked === true ? '\u2713 ' : checked === false ? '\u2003 ' : ''}
                {t(`menu.${sub.key}`)}
              </div>
            );
          })}
        </div>
      )}

      <div className="menubar-right" onMouseDown={(e) => e.stopPropagation()}>
        <Tooltip title={t('menu.toggleSidebar')}>
          <button
            className={`menubar-layout-btn ${sidebarVisible ? 'active' : ''}`}
            onClick={() => onToggleSidebar?.()}
          >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="0.5" y="0.5" width="11" height="11" rx="0.5" />
            <line x1="3" y1="1" x2="3" y2="11" strokeWidth="1.5" />
          </svg>
        </button>
        </Tooltip>
        <Tooltip title={t('panel.output')}>
          <button
            className={`menubar-layout-btn ${bottomPanelVisible ? 'active' : ''}`}
            onClick={() => onTogglePanel?.()}
          >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="0.5" y="0.5" width="11" height="11" rx="0.5" />
            <line x1="1" y1="9" x2="11" y2="9" strokeWidth="1.5" />
          </svg>
        </button>
        </Tooltip>
        <Tooltip title={t('panel.settings')}>
          <button
            className="menubar-btn menubar-settings"
            onClick={() => onActivityChange('settings')}
          >
          &#x2699;
        </button>
        </Tooltip>
        <Tooltip title={t('menu.language')}>
          <button
            className="menubar-btn menubar-lang"
            onClick={() => onLanguageChange?.(currentLanguage === 'zh' ? 'en' : 'zh')}
          >
          {currentLanguage === 'zh' ? 'EN' : '\u4E2D'}
        </button>
        </Tooltip>
        <Tooltip title={t('menu.minimize')}>
          <button className="menubar-btn menubar-minimize" onClick={onMinimize}>
          &#x2212;
        </button>
        </Tooltip>
        <Tooltip title={isMaximized ? t('menu.restore') : t('menu.maximize')}>
          <button
            className="menubar-btn menubar-maximize"
            onClick={onMaximize}
          >
          {isMaximized ? '\u2752' : '\u25A1'}
        </button>
        </Tooltip>
        <Tooltip title={t('panel.close')}>
          <button className="menubar-btn menubar-close" onClick={onClose}>
          &#x2715;
        </button>
        </Tooltip>
      </div>

      {showDocumentation && (
        <div
          className="menubar-help-overlay"
          onClick={() => setShowDocumentation(false)}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            className="menubar-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t('helpDocs.title')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="menubar-help-header">
              <div>
                <h3>{t('helpDocs.title')}</h3>
                <p>{t('helpDocs.subtitle')}</p>
              </div>
              <button type="button" onClick={() => setShowDocumentation(false)}>
                {t('common.close')}
              </button>
            </div>
            <div className="menubar-help-body">
              <section>
                <h4>{t('helpDocs.quickStartTitle')}</h4>
                <ol>
                  <li>{t('helpDocs.quickStart1')}</li>
                  <li>{t('helpDocs.quickStart2')}</li>
                  <li>{t('helpDocs.quickStart3')}</li>
                  <li>{t('helpDocs.quickStart4')}</li>
                  <li>{t('helpDocs.quickStart5')}</li>
                </ol>
              </section>

              <section>
                <h4>{t('helpDocs.setupDetailTitle')}</h4>
                <ul>
                  <li>{t('helpDocs.setupDetail1')}</li>
                  <li>{t('helpDocs.setupDetail2')}</li>
                  <li>{t('helpDocs.setupDetail3')}</li>
                  <li>{t('helpDocs.setupDetail4')}</li>
                </ul>
              </section>

              <section>
                <h4>{t('helpDocs.workspaceTitle')}</h4>
                <ul>
                  <li>{t('helpDocs.workspaceFileResources')}</li>
                  <li>{t('helpDocs.workspaceKnowledgeBase')}</li>
                  <li>{t('helpDocs.workspaceDataCenter')}</li>
                  <li>{t('helpDocs.workspaceTrainingLab')}</li>
                  <li>{t('helpDocs.workspaceProduction')}</li>
                  <li>{t('helpDocs.workspaceEvaluation')}</li>
                  <li>{t('helpDocs.workspaceChat')}</li>
                </ul>
              </section>

              <section>
                <h4>{t('helpDocs.operationTitle')}</h4>
                <ol>
                  <li>{t('helpDocs.operationDocument')}</li>
                  <li>{t('helpDocs.operationKnowledge')}</li>
                  <li>{t('helpDocs.operationAnnotation')}</li>
                  <li>{t('helpDocs.operationFinetuning')}</li>
                  <li>{t('helpDocs.operationEvaluation')}</li>
                </ol>
              </section>

              <section>
                <h4>{t('helpDocs.acceptanceTitle')}</h4>
                <ul>
                  <li>{t('helpDocs.acceptance1')}</li>
                  <li>{t('helpDocs.acceptance2')}</li>
                  <li>{t('helpDocs.acceptance3')}</li>
                  <li>{t('helpDocs.acceptance4')}</li>
                  <li>{t('helpDocs.acceptance5')}</li>
                </ul>
              </section>

              <section>
                <h4>{t('helpDocs.retryTitle')}</h4>
                <ul>
                  <li>{t('helpDocs.retry1')}</li>
                  <li>{t('helpDocs.retry2')}</li>
                  <li>{t('helpDocs.retry3')}</li>
                  <li>{t('helpDocs.retry4')}</li>
                </ul>
              </section>

              <section>
                <h4>{t('helpDocs.shortcutTitle')}</h4>
                <ul>
                  <li>{t('helpDocs.shortcutOpenHelp')}</li>
                  <li>{t('helpDocs.shortcutMenu')}</li>
                  <li>{t('helpDocs.shortcutEscape')}</li>
                  <li>{t('helpDocs.shortcutLanguage')}</li>
                </ul>
              </section>

              <section>
                <h4>{t('helpDocs.troubleshootTitle')}</h4>
                <ul>
                  <li>{t('helpDocs.troubleshootBackend')}</li>
                  <li>{t('helpDocs.troubleshootModel')}</li>
                  <li>{t('helpDocs.troubleshootGenerate')}</li>
                  <li>{t('helpDocs.troubleshootJob')}</li>
                </ul>
              </section>

              <section>
                <h4>{t('helpDocs.dataSafetyTitle')}</h4>
                <ul>
                  <li>{t('helpDocs.dataSafety1')}</li>
                  <li>{t('helpDocs.dataSafety2')}</li>
                  <li>{t('helpDocs.dataSafety3')}</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}

      {showAbout && (
        <div
          className="menubar-help-overlay"
          onClick={() => setShowAbout(false)}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            className="menubar-help-dialog menubar-about-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t('aboutDialog.title')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="menubar-help-header">
              <h3>{t('aboutDialog.title')}</h3>
              <button type="button" onClick={() => setShowAbout(false)}>
                {t('common.close')}
              </button>
            </div>
            <div className="menubar-help-body">
              <p><strong>{t('aboutDialog.product')}</strong></p>
              <p>{t('aboutDialog.description')}</p>
              <h4>{t('aboutDialog.capabilitiesTitle')}</h4>
              <ul>
                <li>{t('aboutDialog.capability1')}</li>
                <li>{t('aboutDialog.capability2')}</li>
                <li>{t('aboutDialog.capability3')}</li>
                <li>{t('aboutDialog.capability4')}</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuBar;
