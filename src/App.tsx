import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import DataCenter from "./components/DataCenter";
import TrainingLab from "./components/TrainingLab";
import ProductionTuning from "./components/ProductionTuning";
import PrivacyCenter from "./components/PrivacyCenter";
import Dashboard from "./components/Dashboard";
import Evaluation from "./components/Evaluation";
import Wizard from "./components/Wizard";
import { startPythonBackend } from "./services/api";
import "./App.css";

type Tab = "dashboard" | "datacenter" | "training" | "production" | "evaluation" | "privacy";

function App() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [backendStarted, setBackendStarted] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  useEffect(() => {
    // Check if wizard was completed before
    const wizardCompleted = localStorage.getItem('wizardCompleted');
    if (!wizardCompleted) {
      setShowWizard(true);
    }

    // Try to start Python backend on app start
    startPythonBackend().then(() => {
      setBackendStarted(true);
    }).catch((error) => {
      console.warn('Python backend may already be running:', error);
      setBackendStarted(true);
    });

    // Listen for wizard navigation events
    const handleWizardNavigate = (event: CustomEvent) => {
      setActiveTab(event.detail as Tab);
      setShowWizard(false);
    };

    window.addEventListener('wizard-navigate', handleWizardNavigate as EventListener);
    return () => {
      window.removeEventListener('wizard-navigate', handleWizardNavigate as EventListener);
    };
  }, []);

  const handleWizardComplete = () => {
    localStorage.setItem('wizardCompleted', 'true');
    setShowWizard(false);
  };

  return (
    <div className="app-container">
      {showWizard && <Wizard onComplete={handleWizardComplete} />}
      
      <header className="app-header">
        <h1>{t("app.title")}</h1>
        {!backendStarted && (
          <div className="backend-status">{t("app.startingBackend")}</div>
        )}
        <div className="language-selector">
          <select
            value={i18n.language}
            onChange={(e) => changeLanguage(e.target.value)}
            className="language-select"
          >
            <option value="en">{t("common.english")}</option>
            <option value="zh">{t("common.chinese")}</option>
          </select>
        </div>
        <nav className="main-nav">
          <button
            className={activeTab === "dashboard" ? "active" : ""}
            onClick={() => setActiveTab("dashboard")}
          >
            {t("nav.dashboard")}
          </button>
          <button
            className={activeTab === "datacenter" ? "active" : ""}
            onClick={() => setActiveTab("datacenter")}
          >
            {t("nav.dataCenter")}
          </button>
          <button
            className={activeTab === "training" ? "active" : ""}
            onClick={() => setActiveTab("training")}
          >
            {t("nav.trainingLab")}
          </button>
          <button
            className={activeTab === "production" ? "active" : ""}
            onClick={() => setActiveTab("production")}
          >
            {t("nav.productionTuning")}
          </button>
          <button
            className={activeTab === "evaluation" ? "active" : ""}
            onClick={() => setActiveTab("evaluation")}
          >
            {t("nav.evaluation")}
          </button>
          <button
            className={activeTab === "privacy" ? "active" : ""}
            onClick={() => setActiveTab("privacy")}
          >
            {t("nav.privacyCenter")}
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "datacenter" && <DataCenter />}
        {activeTab === "training" && <TrainingLab />}
        {activeTab === "production" && <ProductionTuning />}
        {activeTab === "evaluation" && <Evaluation />}
        {activeTab === "privacy" && <PrivacyCenter />}
      </main>
    </div>
  );
}

export default App;
