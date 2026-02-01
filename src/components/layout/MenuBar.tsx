import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityType } from './VSLayout';
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

type MenuId = 'file' | 'edit' | 'selection' | 'view' | 'layout' | 'goTo' | 'run' | 'terminal' | 'help';

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
  const [dropdownPos, setDropdownPos] = useState({ left: 0 });
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
      if (e.altKey && ['f', 'e', 's', 'v', 'l', 'g', 'r', 't', 'h'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        const map: Record<string, MenuId> = {
          f: 'file', e: 'edit', s: 'selection', v: 'view', l: 'layout',
          g: 'goTo', r: 'run', t: 'terminal', h: 'help'
        };
        setOpenMenu((m) => (m === map[e.key.toLowerCase()] ? null : map[e.key.toLowerCase()]));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const menuItems: { id: MenuId; key: string; labelKey: string }[] = [
    { id: 'file', key: 'F', labelKey: 'menu.file' },
    { id: 'edit', key: 'E', labelKey: 'menu.edit' },
    { id: 'selection', key: 'S', labelKey: 'menu.selection' },
    { id: 'view', key: 'V', labelKey: 'menu.view' },
    { id: 'layout', key: 'L', labelKey: 'menu.layout' },
    { id: 'goTo', key: 'G', labelKey: 'menu.goTo' },
    { id: 'run', key: 'R', labelKey: 'menu.run' },
    { id: 'terminal', key: 'T', labelKey: 'menu.terminal' },
    { id: 'help', key: 'H', labelKey: 'menu.help' }
  ];

  const handleNavBack = () => {
    const order: ActivityType[] = ['fileResources', 'knowledgeBase', 'dashboard', 'datacenter', 'training', 'production', 'evaluation', 'chat'];
    const idx = order.indexOf(activeActivity);
    if (idx > 0) onActivityChange(order[idx - 1]);
  };

  const handleNavForward = () => {
    const order: ActivityType[] = ['fileResources', 'knowledgeBase', 'dashboard', 'datacenter', 'training', 'production', 'evaluation', 'chat'];
    const idx = order.indexOf(activeActivity);
    if (idx >= 0 && idx < order.length - 1) onActivityChange(order[idx + 1]);
  };

  const getMenuItems = (id: MenuId) => {
    switch (id) {
      case 'file':
        return [
          { key: 'newFile', action: () => {} },
          { key: 'open', action: () => {} },
          { key: 'save', action: () => {} }
        ];
      case 'edit':
        return [
          { key: 'undo', action: () => {} },
          { key: 'redo', action: () => {} },
          { key: 'cut', action: () => {} },
          { key: 'copy', action: () => {} },
          { key: 'paste', action: () => {} }
        ];
      case 'selection':
        return [{ key: 'selectAll', action: () => {} }];
      case 'view':
        return [
          { key: 'zoomIn', action: () => {} },
          { key: 'zoomOut', action: () => {} },
          { key: 'resetZoom', action: () => {} },
          { key: 'language', action: () => onLanguageChange?.(currentLanguage === 'zh' ? 'en' : 'zh') }
        ];
      case 'layout':
        return [
          { key: 'toggleSidebar', action: () => onToggleSidebar?.(), checked: sidebarVisible },
          { key: 'togglePanel', action: () => onTogglePanel?.(), checked: bottomPanelVisible }
        ];
      case 'goTo':
        return [
          { key: 'dashboard', action: () => onActivityChange('dashboard') },
          { key: 'dataCenter', action: () => onActivityChange('datacenter') },
          { key: 'fileResources', action: () => onActivityChange('fileResources') },
          { key: 'knowledgeBase', action: () => onActivityChange('knowledgeBase') },
          { key: 'trainingLab', action: () => onActivityChange('training') },
          { key: 'productionTuning', action: () => onActivityChange('production') },
          { key: 'evaluation', action: () => onActivityChange('evaluation') },
          { key: 'chat', action: () => onActivityChange('chat') },
          { key: 'settings', action: () => onActivityChange('settings') }
        ];
      case 'run':
        return [{ key: 'runCurrent', action: () => {} }];
      case 'terminal':
        return [{ key: 'newTerminal', action: () => {} }];
      case 'help':
        return [
          { key: 'documentation', action: () => {} },
          { key: 'about', action: () => {} }
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
      <div className="menubar-left">
        <span className="menubar-icon">&#9830;</span>
        {menuItems.map((item) => (
          <div
            key={item.id}
            className={`menubar-item ${openMenu === item.id ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              const rect = (e.target as HTMLElement).getBoundingClientRect();
        setDropdownPos({ left: rect.left });
        setOpenMenu(openMenu === item.id ? null : item.id);
            }}
          >
            {t(item.labelKey)}({item.key})
          </div>
        ))}
        <div className="menubar-nav" onMouseDown={(e) => e.stopPropagation()}>
          <button className="menubar-nav-btn" onClick={handleNavBack} title={t('menu.back')}>
            &#x25C0;
          </button>
          <button className="menubar-nav-btn" onClick={handleNavForward} title={t('menu.forward')}>
            &#x25B6;
          </button>
        </div>
        <span className="menubar-title">{t('app.title')}</span>
      </div>

      {openMenu && getMenuItems(openMenu).length > 0 && (
        <div
          className="menubar-dropdown"
          style={{ left: dropdownPos.left }}
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
        <button
          className={`menubar-layout-btn ${sidebarVisible ? 'active' : ''}`}
          onClick={() => onToggleSidebar?.()}
          title={t('menu.toggleSidebar')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="0.5" y="0.5" width="11" height="11" rx="0.5" />
            <line x1="3" y1="1" x2="3" y2="11" strokeWidth="1.5" />
          </svg>
        </button>
        <button
          className={`menubar-layout-btn ${bottomPanelVisible ? 'active' : ''}`}
          onClick={() => onTogglePanel?.()}
          title={t('panel.output')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="0.5" y="0.5" width="11" height="11" rx="0.5" />
            <line x1="1" y1="9" x2="11" y2="9" strokeWidth="1.5" />
          </svg>
        </button>
        <button
          className="menubar-btn menubar-settings"
          onClick={() => onActivityChange('settings')}
          title={t('panel.settings')}
        >
          &#x2699;
        </button>
        <button
          className="menubar-btn menubar-lang"
          onClick={() => onLanguageChange?.(currentLanguage === 'zh' ? 'en' : 'zh')}
          title={t('menu.language')}
        >
          {currentLanguage === 'zh' ? 'EN' : '\u4E2D'}
        </button>
        <button className="menubar-btn menubar-minimize" onClick={onMinimize} title={t('menu.minimize')}>
          &#x2212;
        </button>
        <button
          className="menubar-btn menubar-maximize"
          onClick={onMaximize}
          title={isMaximized ? t('menu.restore') : t('menu.maximize')}
        >
          {isMaximized ? '\u2752' : '\u25A1'}
        </button>
        <button className="menubar-btn menubar-close" onClick={onClose} title={t('panel.close')}>
          &#x2715;
        </button>
      </div>
    </div>
  );
};

export default MenuBar;
