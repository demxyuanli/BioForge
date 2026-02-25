import React, { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { FolderOpen, BookOpen, Database, GraduationCap, Settings2, CheckSquare, MessageCircle, LayoutDashboard, Settings, Info, Sparkles } from 'lucide-react';
import ActivityBar from './ActivityBar';
import BottomPanel from './BottomPanel';
import FileExplorer from './FileExplorer';
import MenuBar from './MenuBar';
import Tooltip from '../Tooltip';
import './VSLayout.css';

const ACTIVITY_ICON_PROPS = { size: 18, strokeWidth: 1.5 as const };
const ACTIVITY_ICON_BY_TYPE: Record<ActivityType, React.ReactNode> = {
  fileResources: <FolderOpen {...ACTIVITY_ICON_PROPS} />,
  knowledgeBase: <BookOpen {...ACTIVITY_ICON_PROPS} />,
  datacenter: <Database {...ACTIVITY_ICON_PROPS} />,
  training: <GraduationCap {...ACTIVITY_ICON_PROPS} />,
  production: <Settings2 {...ACTIVITY_ICON_PROPS} />,
  evaluation: <CheckSquare {...ACTIVITY_ICON_PROPS} />,
  chat: <MessageCircle {...ACTIVITY_ICON_PROPS} />,
  skills: <Sparkles {...ACTIVITY_ICON_PROPS} />,
  dashboard: <LayoutDashboard {...ACTIVITY_ICON_PROPS} />,
  settings: <Settings {...ACTIVITY_ICON_PROPS} />,
  explorer: <FolderOpen {...ACTIVITY_ICON_PROPS} />
};

export type ActivityType = 'dashboard' | 'datacenter' | 'fileResources' | 'knowledgeBase' | 'training' | 'production' | 'evaluation' | 'chat' | 'skills' | 'settings' | 'explorer';
export type SidebarViewType = 'files' | 'knowledge';
export type BottomPanelTab = 'output' | 'logs' | 'problems';
export type RightPanelTab = 'details' | 'chat';

const NAV_TITLE_KEY_BY_ACTIVITY: Record<ActivityType, string> = {
  dashboard: 'nav.dashboard',
  datacenter: 'nav.dataCenter',
  fileResources: 'nav.fileResources',
  knowledgeBase: 'nav.knowledgeBase',
  training: 'nav.trainingLab',
  production: 'nav.productionTuning',
  evaluation: 'nav.evaluation',
  chat: 'nav.chat',
  skills: 'nav.skills',
  settings: 'nav.settings',
  explorer: 'nav.fileResources'
};

interface VSLayoutProps {
  children: ReactNode;
  activeActivity: ActivityType;
  onActivityChange: (activity: ActivityType) => void;
  bottomPanelContent?: ReactNode;
  sidebarContent?: ReactNode;
}

const VSLayout: React.FC<VSLayoutProps> = ({
  children,
  activeActivity,
  onActivityChange,
  bottomPanelContent,
  sidebarContent
}) => {
  const { t, i18n } = useTranslation();
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarFloating, setSidebarFloating] = useState(false);
  const [bottomPanelVisible, setBottomPanelVisible] = useState(false);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  const SIDEBAR_MIN_WIDTH = 200;
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_MIN_WIDTH);
  const [bottomPanelTab, setBottomPanelTab] = useState<BottomPanelTab>('output');
  const [isMaximized, setIsMaximized] = useState(false);
  const floatingSidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sidebarFloating || !sidebarVisible) return;
    const handleClickOutside = (e: MouseEvent) => {
      const el = floatingSidebarRef.current;
      if (el && !el.contains(e.target as Node)) {
        setSidebarVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarFloating, sidebarVisible]);

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

  const sidebarWidthRef = useRef(sidebarWidth);
  useEffect(() => { sidebarWidthRef.current = sidebarWidth; }, [sidebarWidth]);
  const bottomPanelHeightRef = useRef(bottomPanelHeight);
  useEffect(() => { bottomPanelHeightRef.current = bottomPanelHeight; }, [bottomPanelHeight]);

  const handleSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (sidebarFloating) return;
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      if (newWidth >= SIDEBAR_MIN_WIDTH && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sidebarFloating]);

  const handleBottomPanelResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = bottomPanelHeightRef.current;

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
  }, []);

  return (
    <div className="vs-layout">
      <MenuBar
        activeActivity={activeActivity}
        onActivityChange={onActivityChange}
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
        onClose={handleClose}
        isMaximized={isMaximized}
        onTitleBarDrag={handleTitleBarDrag}
        onTitleBarDoubleClick={handleTitleBarDoubleClick}
        onToggleSidebar={() => setSidebarVisible((v) => !v)}
        onTogglePanel={() => setBottomPanelVisible((v) => !v)}
        sidebarVisible={sidebarVisible}
        bottomPanelVisible={bottomPanelVisible}
        onLanguageChange={changeLanguage}
        currentLanguage={i18n.language}
      />

      {/* Main Content Area */}
      <div className="vs-main-container">
        {/* Activity Bar (leftmost icons) */}
        <ActivityBar
          activeActivity={activeActivity}
          onActivityChange={onActivityChange}
          sidebarVisible={sidebarVisible}
          onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
        />

        {/* Left Sidebar (in flow when not floating) */}
        {sidebarVisible && !sidebarFloating && (
          <div className="vs-sidebar" style={{ width: sidebarWidth, minWidth: SIDEBAR_MIN_WIDTH }}>
            <div className="vs-sidebar-toolbar">
              <span className="vs-sidebar-toolbar-spacer" />
              <Tooltip title={t('sidebar.float')}>
                <button
                  type="button"
                  className={`vs-sidebar-toolbar-btn ${sidebarFloating ? 'active' : ''}`}
                  onClick={() => setSidebarFloating(true)}
                  aria-label={t('sidebar.float')}
                >
                  <span className="vs-sidebar-toolbar-icon" aria-hidden>{'\u29C9'}</span>
                </button>
              </Tooltip>
              <Tooltip title={t('sidebar.close')}>
                <button
                  type="button"
                  className="vs-sidebar-toolbar-btn vs-sidebar-toolbar-close"
                  onClick={() => setSidebarVisible(false)}
                  aria-label={t('sidebar.close')}
                >
                  <span className="vs-sidebar-toolbar-icon" aria-hidden>{'\u2715'}</span>
                </button>
              </Tooltip>
            </div>
            {sidebarContent ? (
              <>{sidebarContent}</>
            ) : (
              <div className="vs-sidebar-content">
                <FileExplorer />
              </div>
            )}
            <div className="vs-resize-handle vs-resize-horizontal" onMouseDown={handleSidebarResize} />
          </div>
        )}

        {/* Left Sidebar (float = overlay push/pull: sidebar slides in/out, main area never moves) */}
        {sidebarFloating && (
          <div
            ref={floatingSidebarRef}
            className={`vs-sidebar vs-sidebar-floating ${!sidebarVisible ? 'vs-sidebar-pushed' : ''}`}
            style={{ width: sidebarWidth, minWidth: SIDEBAR_MIN_WIDTH }}
          >
            <div className="vs-sidebar-toolbar">
              <span className="vs-sidebar-toolbar-spacer" />
              <Tooltip title={t('sidebar.dock')}>
                <button
                  type="button"
                  className="vs-sidebar-toolbar-btn active"
                  onClick={() => setSidebarFloating(false)}
                  aria-label={t('sidebar.dock')}
                >
                  <span className="vs-sidebar-toolbar-icon" aria-hidden>{'\u29C9'}</span>
                </button>
              </Tooltip>
              <Tooltip title={t('sidebar.close')}>
                <button
                  type="button"
                  className="vs-sidebar-toolbar-btn vs-sidebar-toolbar-close"
                  onClick={() => setSidebarVisible(false)}
                  aria-label={t('sidebar.close')}
                >
                  <span className="vs-sidebar-toolbar-icon" aria-hidden>{'\u2715'}</span>
                </button>
              </Tooltip>
            </div>
            {sidebarContent ? (
              <>{sidebarContent}</>
            ) : (
              <div className="vs-sidebar-content">
                <FileExplorer />
              </div>
            )}
          </div>
        )}

        {/* Center Area */}
        <div className="vs-center-area">
          {/* Editor/Main Content (Top) */}
          <div className="vs-editor-area" style={{ 
            height: bottomPanelVisible ? `calc(100% - ${bottomPanelHeight}px)` : '100%' 
          }}>
            <div className="vs-editor-tabs">
              <Tooltip title={t(NAV_TITLE_KEY_BY_ACTIVITY[activeActivity])}>
                <div className="vs-tab vs-tab-active">
                  <span className="vs-tab-icon">{ACTIVITY_ICON_BY_TYPE[activeActivity]}</span>
                  <span className="vs-tab-title">{t(NAV_TITLE_KEY_BY_ACTIVITY[activeActivity])}</span>
                  <span className="vs-tab-tooltip-icon" aria-hidden>
                    <Info {...ACTIVITY_ICON_PROPS} size={14} />
                  </span>
                </div>
              </Tooltip>
              {['training', 'production', 'evaluation'].includes(activeActivity) && (
                <Tooltip title={t('trainingLab.configHint')}>
                  <span className="vs-tab-help">?</span>
                </Tooltip>
              )}
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
          <span className="vs-status-item">{t('status.utf8')}</span>
          <span className="vs-status-item">{t('status.lnCol', { ln: 1, col: 1 })}</span>
        </div>
      </div>
    </div>
  );
};

export default VSLayout;
