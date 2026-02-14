import { useState, useEffect, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import DataCenter from "./components/DataCenter";
import FileResourcesWorkspace from "./components/FileResourcesWorkspace";
import KnowledgeBaseWorkspace from "./components/KnowledgeBaseWorkspace";
import TrainingLab from "./components/TrainingLab";
import ProductionTuning from "./components/ProductionTuning";
import Dashboard from "./components/Dashboard";
import Evaluation from "./components/Evaluation";
import ChatAssistant from "./components/ChatAssistant";
import { ChatProvider } from "./contexts/ChatContext";
import Settings, { SettingsTab } from "./components/Settings";
import Wizard from "./components/Wizard";
import { VSLayout, ActivityType } from "./components/layout";
import ResourceSidebar from "./components/layout/ResourceSidebar";
import SettingsSidebar from "./components/layout/SettingsSidebar";
import { startPythonBackend, getDocuments, getFinetuningJobs, getStorageConfig, Document, FinetuningJob } from "./services/api";
import "./App.css";

function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActivityType>("fileResources");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [sidebarSubItem, setSidebarSubItem] = useState<string>('overview');
  const [backendStarted, setBackendStarted] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [jobs, setJobs] = useState<FinetuningJob[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const wizardCompleted = localStorage.getItem('wizardCompleted');
    getStorageConfig().then((config) => {
      const hasConfig = config?.documentsDir && config?.dbPath;
      if (!wizardCompleted || !hasConfig) {
        setShowWizard(true);
      }
      if (hasConfig) {
        startPythonBackend().then(() => {
          setBackendStarted(true);
          addLog(t('logs.backendStarted'));
        }).catch((error) => {
          console.warn('Python backend may already be running:', error);
          setBackendStarted(true);
          addLog(t('logs.backendAlreadyRunning'));
        });
      }
    }).catch(() => setShowWizard(true));

    const handleWizardNavigate = (event: CustomEvent) => {
    const tab = event.detail as ActivityType;
    setActiveTab(tab);
    // If navigating to settings via wizard, default to general
    if (tab === 'settings') {
      setSettingsTab('general');
    }
    setShowWizard(false);
  };

    window.addEventListener('wizard-navigate', handleWizardNavigate as EventListener);
    return () => {
      window.removeEventListener('wizard-navigate', handleWizardNavigate as EventListener);
    };
  }, []);

  useEffect(() => {
    loadSidebarData();
    const interval = setInterval(loadSidebarData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleSettingsTabChange = (event: CustomEvent) => {
      const tab = event.detail as SettingsTab;
      setSettingsTab(tab);
    };
    window.addEventListener('settings-tab-change', handleSettingsTabChange as EventListener);
    return () => {
      window.removeEventListener('settings-tab-change', handleSettingsTabChange as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleOpenWizard = () => setShowWizard(true);
    window.addEventListener('open-wizard', handleOpenWizard);
    return () => window.removeEventListener('open-wizard', handleOpenWizard);
  }, []);

  const loadSidebarData = async () => {
    try {
      const [docsData, jobsData] = await Promise.all([
        getDocuments(),
        getFinetuningJobs()
      ]);
      setDocuments(docsData);
      setJobs(jobsData);
    } catch (error) {
      console.error('Failed to load sidebar data:', error);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleWizardComplete = () => {
    localStorage.setItem('wizardCompleted', 'true');
    setShowWizard(false);
    addLog(t('logs.wizardCompleted'));
  };

  const handleStorageComplete = () => {
    setBackendStarted(true);
    addLog(t('logs.storageConfigured'));
    addLog(t('logs.backendStarted'));
  };

  const renderMainContent = () => {
    switch (activeTab) {
      case "dashboard":
      case "explorer": {
        const processedCount = documents.filter((d) => d.processed).length;
        const activeJobsCount = jobs.filter((j) => j.status === 'running' || j.status === 'submitted').length;
        return (
          <Dashboard
            backendStarted={backendStarted}
            documentsCount={documents.length}
            processedCount={processedCount}
            jobsCount={jobs.length}
            activeJobsCount={activeJobsCount}
          />
        );
      }
      case "fileResources":
        return <FileResourcesWorkspace />;
      case "datacenter":
        return <DataCenter />;
      case "knowledgeBase":
        return <KnowledgeBaseWorkspace />;
      case "training":
        return <TrainingLab />;
      case "production":
        return <ProductionTuning activeSubItem={sidebarSubItem} />;
      case "evaluation":
        return <Evaluation />;
      case "chat":
        return <ChatAssistant />;
      case "settings":
        return <Settings activeTab={settingsTab} />;
      default:
        return <Dashboard />;
    }
  };

  const firstSubItemByActivity: Record<string, string> = {
    datacenter: 'knowledgeCreation',
    knowledgeBase: 'knowledgeTree',
    training: 'knowledgePoints',
    production: 'datasetAndCost',
    evaluation: 'templates',
    chat: 'conversation'
  };
  useEffect(() => {
    const first = firstSubItemByActivity[activeTab];
    if (first) setSidebarSubItem(first);
  }, [activeTab]);

  const renderSidebarContent = () => {
    if (activeTab === 'settings') {
      return (
        <SettingsSidebar 
          activeTab={settingsTab} 
          onTabChange={setSettingsTab} 
        />
      );
    }
    return (
      <ResourceSidebar
        documents={documents}
        jobs={jobs}
        activity={activeTab}
        selectedSubItem={sidebarSubItem}
        onSubItemChange={setSidebarSubItem}
      />
    );
  };

  const renderBottomPanelContent = (): ReactNode => {
    return (
      <div className="output-content">
        {logs.length === 0 ? (
          <div className="vs-output-line">
            <span className="vs-output-time">[{new Date().toLocaleTimeString()}]</span>
            <span className="vs-output-text">{t('panel.noOutput')}</span>
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="vs-output-line">
              <span className="vs-output-text">{log}</span>
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <>
      {showWizard && (
        <Wizard
          onComplete={handleWizardComplete}
          onStorageComplete={handleStorageComplete}
        />
      )}
      <ChatProvider>
        <VSLayout
          activeActivity={activeTab}
          onActivityChange={setActiveTab}
          bottomPanelContent={renderBottomPanelContent()}
          sidebarContent={renderSidebarContent()}
        >
          {renderMainContent()}
        </VSLayout>
      </ChatProvider>
    </>
  );
}

export default App;
