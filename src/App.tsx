import { useState, useEffect, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import DataCenter from "./components/DataCenter";
import TrainingLab from "./components/TrainingLab";
import ProductionTuning from "./components/ProductionTuning";
import PrivacyCenter from "./components/PrivacyCenter";
import Dashboard from "./components/Dashboard";
import Evaluation from "./components/Evaluation";
import Wizard from "./components/Wizard";
import { VSLayout, ActivityType } from "./components/layout";
import { startPythonBackend, getDocuments, getFinetuningJobs, Document, FinetuningJob } from "./services/api";
import "./App.css";

function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActivityType>("dashboard");
  const [backendStarted, setBackendStarted] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [jobs, setJobs] = useState<FinetuningJob[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const wizardCompleted = localStorage.getItem('wizardCompleted');
    if (!wizardCompleted) {
      setShowWizard(true);
    }

    startPythonBackend().then(() => {
      setBackendStarted(true);
      addLog(t('logs.backendStarted'));
    }).catch((error) => {
      console.warn('Python backend may already be running:', error);
      setBackendStarted(true);
      addLog(t('logs.backendAlreadyRunning'));
    });

    const handleWizardNavigate = (event: CustomEvent) => {
      setActiveTab(event.detail as ActivityType);
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

  const renderMainContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "datacenter":
        return <DataCenter />;
      case "training":
        return <TrainingLab />;
      case "production":
        return <ProductionTuning />;
      case "evaluation":
        return <Evaluation />;
      case "privacy":
        return <PrivacyCenter />;
      default:
        return <Dashboard />;
    }
  };

  const renderSidebarContent = (): ReactNode => {
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="sidebar-overview">
            <div className="sidebar-section">
              <h4>{t('sidebar.quickStats')}</h4>
              <div className="sidebar-stat">
                <span>{t('sidebar.documents')}</span>
                <span className="stat-badge">{documents.length}</span>
              </div>
              <div className="sidebar-stat">
                <span>{t('sidebar.jobs')}</span>
                <span className="stat-badge">{jobs.length}</span>
              </div>
              <div className="sidebar-stat">
                <span>{t('sidebar.activeJobs')}</span>
                <span className="stat-badge">{jobs.filter(j => j.status === 'running').length}</span>
              </div>
            </div>
          </div>
        );
      case "datacenter":
        return (
          <div className="sidebar-explorer">
            <div className="sidebar-section">
              <h4>{t('sidebar.recentDocuments')}</h4>
              {documents.length === 0 ? (
                <p className="sidebar-empty">{t('sidebar.noDocuments')}</p>
              ) : (
                <ul className="sidebar-list">
                  {documents.slice(0, 10).map((doc) => (
                    <li key={doc.id} className="sidebar-item">
                      <span className="item-icon">&#128196;</span>
                      <span className="item-name">{doc.filename}</span>
                      <span className={`item-status ${doc.processed ? 'processed' : 'pending'}`}>
                        {doc.processed ? '\u2713' : '\u25CB'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      case "training":
      case "production":
        return (
          <div className="sidebar-jobs">
            <div className="sidebar-section">
              <h4>{t('sidebar.finetuningJobs')}</h4>
              {jobs.length === 0 ? (
                <p className="sidebar-empty">{t('sidebar.noJobs')}</p>
              ) : (
                <ul className="sidebar-list">
                  {jobs.slice(0, 10).map((job) => (
                    <li key={job.id} className="sidebar-item">
                      <span className="item-icon">&#9881;</span>
                      <span className="item-name">{job.id.slice(0, 12)}...</span>
                      <span className={`item-status status-${job.status}`}>
                        {job.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      default:
        return (
          <div className="sidebar-default">
            <p className="sidebar-empty">{t('sidebar.selectActivity')}</p>
          </div>
        );
    }
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

  const renderRightPanelContent = (): ReactNode => {
    const activeJobsCount = jobs.filter(j => j.status === 'running' || j.status === 'submitted').length;
    const processedDocsCount = documents.filter(d => d.processed).length;
    
    return (
      <div className="vs-properties-list">
        <div className="vs-property-group">
          <div className="vs-property-group-header">{t('panel.currentView')}</div>
          <div className="vs-property-item">
            <span className="vs-property-label">{t('panel.name')}</span>
            <span className="vs-property-value">{t(`nav.${activeTab}`)}</span>
          </div>
          <div className="vs-property-item">
            <span className="vs-property-label">{t('panel.status')}</span>
            <span className="vs-property-value">{backendStarted ? t('status.ready') : t('status.loading')}</span>
          </div>
        </div>
        <div className="vs-property-group">
          <div className="vs-property-group-header">{t('panel.statistics')}</div>
          <div className="vs-property-item">
            <span className="vs-property-label">{t('panel.totalDocuments')}</span>
            <span className="vs-property-value">{documents.length}</span>
          </div>
          <div className="vs-property-item">
            <span className="vs-property-label">{t('panel.processedDocuments')}</span>
            <span className="vs-property-value">{processedDocsCount}</span>
          </div>
          <div className="vs-property-item">
            <span className="vs-property-label">{t('panel.totalJobs')}</span>
            <span className="vs-property-value">{jobs.length}</span>
          </div>
          <div className="vs-property-item">
            <span className="vs-property-label">{t('panel.activeJobs')}</span>
            <span className="vs-property-value">{activeJobsCount}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {showWizard && <Wizard onComplete={handleWizardComplete} />}
      <VSLayout
        activeActivity={activeTab}
        onActivityChange={setActiveTab}
        sidebarTitle={t(`nav.${activeTab}`)}
        sidebarContent={renderSidebarContent()}
        bottomPanelContent={renderBottomPanelContent()}
        rightPanelContent={renderRightPanelContent()}
      >
        {renderMainContent()}
      </VSLayout>
    </>
  );
}

export default App;
