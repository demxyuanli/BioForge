import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getStorageConfig,
  saveStorageConfig,
  getDefaultStoragePaths,
  selectFolder,
  startPythonBackend,
  type StorageConfig
} from '../services/api';
import './Wizard.css';
import './StorageWizard.css';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
}

interface WizardProps {
  onComplete: () => void;
  onStorageComplete?: () => void;
}

const Wizard: React.FC<WizardProps> = ({ onComplete, onStorageComplete }) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<WizardStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsStorageStep, setNeedsStorageStep] = useState(false);
  const [documentsDir, setDocumentsDir] = useState('');
  const [dbDir, setDbDir] = useState('');
  const [storageError, setStorageError] = useState('');
  const [storageSaving, setStorageSaving] = useState(false);

  useEffect(() => {
    getStorageConfig().then((config: StorageConfig | null) => {
      const needStorage = !config?.documentsDir || !config?.dbPath;
      setNeedsStorageStep(needStorage);
      if (config?.documentsDir) setDocumentsDir(config.documentsDir);
      if (config?.dbPath) {
        const dir = config.dbPath.replace(/[/\\](aiforger|privatetune)\.db$/i, '');
        if (dir) setDbDir(dir);
      }
      setLoading(false);
    }).catch(() => {
      setNeedsStorageStep(true);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (loading) return;
    const baseSteps: WizardStep[] = needsStorageStep
      ? [
          {
            id: 'storage',
            title: t('wizard.storage.title'),
            description: t('wizard.storage.description'),
            component: (
              <StorageStepContent
                documentsDir={documentsDir}
                dbDir={dbDir}
                onDocumentsDirChange={setDocumentsDir}
                onDbDirChange={setDbDir}
                onPickDocumentsDir={async () => {
                  const path = await selectFolder();
                  if (path) setDocumentsDir(path);
                }}
                onPickDbDir={async () => {
                  const path = await selectFolder();
                  if (path) setDbDir(path);
                }}
              />
            )
          }
        ]
      : [];
    const restSteps: WizardStep[] = [
      {
        id: 'welcome',
        title: t('wizard.welcome.title'),
        description: t('wizard.welcome.description'),
        component: (
          <div className="wizard-content">
            <p>{t('wizard.welcome.intro')}</p>
            <p>{t('wizard.welcome.steps')}</p>
            <ol>
              <li>{t('wizard.welcome.step1')}</li>
              <li>{t('wizard.welcome.step2')}</li>
              <li>{t('wizard.welcome.step3')}</li>
              <li>{t('wizard.welcome.step4')}</li>
            </ol>
          </div>
        )
      },
      {
        id: 'upload',
        title: t('wizard.upload.title'),
        description: t('wizard.upload.description'),
        component: (
          <div className="wizard-content">
            <p>{t('wizard.upload.instruction')}</p>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('wizard-navigate', { detail: 'datacenter' }));
                setCurrentStep(genIdx);
              }}
            >
              {t('wizard.upload.goToDataCenter')}
            </button>
          </div>
        )
      },
      {
        id: 'generate',
        title: t('wizard.generate.title'),
        description: t('wizard.generate.description'),
        component: (
          <div className="wizard-content">
            <p>{t('wizard.generate.instruction')}</p>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('wizard-navigate', { detail: 'training' }));
                setCurrentStep(genIdx);
              }}
            >
              {t('wizard.generate.goToTrainingLab')}
            </button>
          </div>
        )
      },
      {
        id: 'configure',
        title: t('wizard.configure.title'),
        description: t('wizard.configure.description'),
        component: (
          <div className="wizard-content">
            <p>{t('wizard.configure.instruction')}</p>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('wizard-navigate', { detail: 'production' }));
                setCurrentStep(confIdx);
              }}
            >
              {t('wizard.configure.goToProductionTuning')}
            </button>
          </div>
        )
      },
      {
        id: 'complete',
        title: t('wizard.complete.title'),
        description: t('wizard.complete.description'),
        component: (
          <div className="wizard-content">
            <p>✓ {t('wizard.complete.documentsUploaded')}</p>
            <p>✓ {t('wizard.complete.trainingDataGenerated')}</p>
            <p>✓ {t('wizard.complete.fineTuningConfigured')}</p>
            <p>{t('wizard.complete.instruction')}</p>
          </div>
        )
      }
    ];
    const allSteps = [...baseSteps, ...restSteps];
    const genIdx = allSteps.findIndex((s) => s.id === 'generate');
    const confIdx = allSteps.findIndex((s) => s.id === 'configure');
    setSteps(allSteps);
    setCurrentStep(0);
  }, [loading, needsStorageStep, documentsDir, dbDir, storageError, t]);

  const saveStorageAndAdvance = async () => {
    setStorageError('');
    const docsDir = documentsDir.trim();
    const dbPathDir = dbDir.trim();
    if (!docsDir) {
      setStorageError(t('wizard.storage.documentsDirRequired'));
      return;
    }
    if (!dbPathDir) {
      setStorageError(t('wizard.storage.dbPathRequired'));
      return;
    }
    setStorageSaving(true);
    try {
      const dbPath = dbPathDir.endsWith('aiforger.db') || dbPathDir.endsWith('privatetune.db')
        ? dbPathDir
        : `${dbPathDir.replace(/[/\\]+$/, '')}/aiforger.db`;
      await saveStorageConfig(docsDir, dbPath);
      await startPythonBackend();
      onStorageComplete?.();
      setCurrentStep(1);
    } catch (e) {
      setStorageError(String(e));
    } finally {
      setStorageSaving(false);
    }
  };

  const saveDefaultsAndComplete = async () => {
    try {
      const defaults = await getDefaultStoragePaths();
      await saveStorageConfig(defaults.documentsDir, defaults.dbPath);
      await startPythonBackend();
      onStorageComplete?.();
    } catch {
      /* ignore */
    }
    onComplete();
  };

  const handleNext = async () => {
    if (steps.length === 0) return;
    if (currentStep === 0 && needsStorageStep) {
      await saveStorageAndAdvance();
    } else if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    if (currentStep === 0 && needsStorageStep) {
      await saveDefaultsAndComplete();
    } else {
      onComplete();
    }
  };

  if (loading || steps.length === 0) {
    return (
      <div className="wizard-overlay">
        <div className="wizard-container">
          <div className="wizard-loading">{t('sidebar.loading')}</div>
        </div>
      </div>
    );
  }

  const isStorageStep = currentStep === 0 && needsStorageStep;

  return (
    <div className="wizard-overlay">
      <div className="wizard-container">
        <div className="wizard-header">
          <h2>{steps[currentStep].title}</h2>
          <button className="wizard-close" onClick={handleSkip}>
            ×
          </button>
        </div>

        <div className="wizard-progress">
          {steps.map((step, index) => (
            <div key={step.id} className="wizard-step-indicator">
              <div className={`step-circle ${index <= currentStep ? 'active' : ''}`}>
                {index + 1}
              </div>
              {index < steps.length - 1 && (
                <div className={`step-line ${index < currentStep ? 'active' : ''}`} />
              )}
            </div>
          ))}
        </div>

        <div className="wizard-body">
          <p className="wizard-description">{steps[currentStep].description}</p>
          {steps[currentStep].component}
          {isStorageStep && storageError && (
            <div className="storage-wizard-error">{storageError}</div>
          )}
        </div>

        <div className="wizard-footer">
          <button onClick={handlePrevious} disabled={currentStep === 0}>
            {t('wizard.previous')}
          </button>
          <button onClick={handleSkip}>{t('wizard.skipWizard')}</button>
          <button
            onClick={handleNext}
            className="primary"
            disabled={isStorageStep && storageSaving}
          >
            {isStorageStep && storageSaving
              ? t('wizard.storage.saving')
              : currentStep === steps.length - 1
                ? t('wizard.finish')
                : t('wizard.next')}
          </button>
        </div>
      </div>
    </div>
  );
};

interface StorageStepContentProps {
  documentsDir: string;
  dbDir: string;
  onDocumentsDirChange: (v: string) => void;
  onDbDirChange: (v: string) => void;
  onPickDocumentsDir: () => void;
  onPickDbDir: () => void;
}

const StorageStepContent: React.FC<StorageStepContentProps> = ({
  documentsDir,
  dbDir,
  onDocumentsDirChange,
  onDbDirChange,
  onPickDocumentsDir,
  onPickDbDir
}) => {
  const { t } = useTranslation();
  return (
    <div className="storage-wizard-fields">
      <div className="storage-wizard-field">
        <label>{t('wizard.storage.documentsDir')}</label>
        <div className="storage-wizard-input-row">
          <input
            type="text"
            value={documentsDir}
            onChange={(e) => onDocumentsDirChange(e.target.value)}
            placeholder={t('wizard.storage.documentsDirPlaceholder')}
          />
          <button type="button" onClick={onPickDocumentsDir}>
            {t('wizard.storage.browse')}
          </button>
        </div>
      </div>
      <div className="storage-wizard-field">
        <label>{t('wizard.storage.dbPath')}</label>
        <div className="storage-wizard-input-row">
          <input
            type="text"
            value={dbDir}
            onChange={(e) => onDbDirChange(e.target.value)}
            placeholder={t('wizard.storage.dbPathPlaceholder')}
          />
          <button type="button" onClick={onPickDbDir}>
            {t('wizard.storage.browse')}
          </button>
        </div>
        <span className="storage-wizard-hint">{t('wizard.storage.dbPathHint')}</span>
      </div>
    </div>
  );
};

export default Wizard;
