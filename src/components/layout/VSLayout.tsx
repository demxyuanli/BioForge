import React, { useState, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentWindow } from '@tauri-apps/api/window';
import ActivityBar from './ActivityBar';
import BottomPanel from './BottomPanel';
import RightPanel from './RightPanel';
import './VSLayout.css';

export type ActivityType = 'dashboard' | 'datacenter' | 'training' | 'production' | 'evaluation' | 'privacy';
export type BottomPanelTab = 'output' | 'logs' | 'problems';
export type RightPanelTab = 'properties' | 'details' | 'help' | 'chat';

interface VSLayoutProps {
  children: ReactNode;
  activeActivity: ActivityType;
  onActivityChange: (activity: ActivityType) => void;
  sidebarTitle?: string;
  sidebarContent?: ReactNode;
  rightPanelContent?: ReactNode;
  bottomPanelContent?: ReactNode;
}

const VSLayout: React.FC<VSLayoutProps> = ({
  children,
  activeActivity,
  onActivityChange,
  sidebarTitle,
  sidebarContent,
  rightPanelContent,
  bottomPanelContent
}) => {
  const { t, i18n } = useTranslation();
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [bottomPanelVisible, setBottomPanelVisible] = useState(true);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [rightPanelWidth, setRightPanelWidth] = useState(300);
  const [bottomPanelTab, setBottomPanelTab] = useState<BottomPanelTab>('output');
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('properties');
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const appWindow = getCurrentWindow();
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (error) {
        console.warn('Failed to check maximized state:', error);
      }
    };
    checkMaximized();

    const handleResize = () => {
      checkMaximized();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const handleMinimize = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.minimize();
    } catch (error) {
      console.warn('Failed to minimize window:', error);
    }
  };

  const handleMaximize = async () => {
    try {
      const appWindow = getCurrentWindow();
      if (isMaximized) {
        await appWindow.unmaximize();
        setIsMaximized(false);
      } else {
        await appWindow.maximize();
        setIsMaximized(true);
      }
    } catch (error) {
      console.warn('Failed to maximize/unmaximize window:', error);
    }
  };

  const handleClose = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (error) {
      console.warn('Failed to close window:', error);
    }
  };

  const handleTitleBarDrag = async (e: React.MouseEvent) => {
    if (e.buttons === 1) {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.startDragging();
      } catch (error) {
        console.warn('Failed to start dragging:', error);
      }
    }
  };

  const handleTitleBarDoubleClick = async () => {
    await handleMaximize();
  };

  const handleSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      if (newWidth >= 200 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleRightPanelResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightPanelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth - (moveEvent.clientX - startX);
      if (newWidth >= 200 && newWidth <= 500) {
        setRightPanelWidth(newWidth);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleBottomPanelResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = bottomPanelHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newHeight = startHeight - (moveEvent.clientY - startY);
      if (newHeight >= 100 && newHeight <= 400) {
        setBottomPanelHeight(newHeight);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="vs-layout">
      {/* Title Bar */}
      <div 
        className="vs-titlebar"
        onMouseDown={handleTitleBarDrag}
        onDoubleClick={handleTitleBarDoubleClick}
      >
        <div className="vs-titlebar-left">
          <span className="vs-app-icon">&#9830;</span>
          <span className="vs-app-title">{t('app.title')}</span>
        </div>
        <div className="vs-titlebar-center">
          <div className="vs-menu-items">
            <span className="vs-menu-item">{t('menu.file')}</span>
            <span className="vs-menu-item">{t('menu.edit')}</span>
            <span className="vs-menu-item">{t('menu.view')}</span>
            <span className="vs-menu-item">{t('menu.tools')}</span>
            <span className="vs-menu-item">{t('menu.help')}</span>
          </div>
        </div>
        <div className="vs-titlebar-right">
          <select
            value={i18n.language}
            onChange={(e) => changeLanguage(e.target.value)}
            className="vs-language-select"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <option value="en">{t('common.english')}</option>
            <option value="zh">{t('common.chinese')}</option>
          </select>
          <div className="vs-window-controls" onMouseDown={(e) => e.stopPropagation()}>
            <button className="vs-window-btn vs-minimize" onClick={handleMinimize} title="Minimize">
              &#x2212;
            </button>
            <button className="vs-window-btn vs-maximize" onClick={handleMaximize} title={isMaximized ? "Restore" : "Maximize"}>
              {isMaximized ? '\u2752' : '\u25A1'}
            </button>
            <button className="vs-window-btn vs-close" onClick={handleClose} title="Close">
              &#x2715;
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="vs-main-container">
        {/* Activity Bar (leftmost icons) */}
        <ActivityBar
          activeActivity={activeActivity}
          onActivityChange={onActivityChange}
          sidebarVisible={sidebarVisible}
          onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
        />

        {/* Left Sidebar */}
        {sidebarVisible && (
          <div className="vs-sidebar" style={{ width: sidebarWidth }}>
            <div className="vs-sidebar-header">
              <span className="vs-sidebar-title">{sidebarTitle || t(`nav.${activeActivity}`)}</span>
              <button className="vs-sidebar-close" onClick={() => setSidebarVisible(false)}>
                &#x2715;
              </button>
            </div>
            <div className="vs-sidebar-content">
              {sidebarContent}
            </div>
            <div className="vs-resize-handle vs-resize-horizontal" onMouseDown={handleSidebarResize} />
          </div>
        )}

        {/* Center Area */}
        <div className="vs-center-area">
          {/* Editor/Main Content (Top) */}
          <div className="vs-editor-area" style={{ 
            height: bottomPanelVisible ? `calc(100% - ${bottomPanelHeight}px)` : '100%' 
          }}>
            <div className="vs-editor-tabs">
              <div className="vs-tab vs-tab-active">
                <span className="vs-tab-icon">&#128196;</span>
                <span className="vs-tab-title">{t(`nav.${activeActivity}`)}</span>
                <button className="vs-tab-close">&#x2715;</button>
              </div>
            </div>
            <div className="vs-editor-content">
              {children}
            </div>
          </div>

          {/* Bottom Panel */}
          {bottomPanelVisible && (
            <div className="vs-bottom-panel" style={{ height: bottomPanelHeight }}>
              <div className="vs-resize-handle vs-resize-vertical" onMouseDown={handleBottomPanelResize} />
              <BottomPanel
                activeTab={bottomPanelTab}
                onTabChange={setBottomPanelTab}
                onClose={() => setBottomPanelVisible(false)}
                content={bottomPanelContent}
              />
            </div>
          )}
        </div>

        {/* Right Panel */}
        {rightPanelVisible && (
          <div className="vs-right-panel" style={{ width: rightPanelWidth }}>
            <div className="vs-resize-handle vs-resize-horizontal-left" onMouseDown={handleRightPanelResize} />
            <RightPanel
              activeTab={rightPanelTab}
              onTabChange={setRightPanelTab}
              onClose={() => setRightPanelVisible(false)}
              content={rightPanelContent}
              activeActivity={activeActivity}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="vs-statusbar">
        <div className="vs-statusbar-left">
          <span className="vs-status-item vs-status-branch">
            <span className="vs-icon">&#9733;</span> main
          </span>
          <span className="vs-status-item">
            {t('status.ready')}
          </span>
        </div>
        <div className="vs-statusbar-right">
          <button 
            className={`vs-status-item vs-status-btn ${bottomPanelVisible ? 'active' : ''}`}
            onClick={() => setBottomPanelVisible(!bottomPanelVisible)}
          >
            {t('panel.output')}
          </button>
          <button 
            className={`vs-status-item vs-status-btn ${rightPanelVisible ? 'active' : ''}`}
            onClick={() => setRightPanelVisible(!rightPanelVisible)}
          >
            {t('panel.properties')}
          </button>
          <span className="vs-status-item">UTF-8</span>
          <span className="vs-status-item">Ln 1, Col 1</span>
        </div>
      </div>
    </div>
  );
};

export default VSLayout;
