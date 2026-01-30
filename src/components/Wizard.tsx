import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Wizard.css';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
}

const Wizard: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);

  const steps: WizardStep[] = [
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
          <button onClick={() => {
            window.dispatchEvent(new CustomEvent('wizard-navigate', { detail: 'datacenter' }));
            setCurrentStep(2);
          }}>
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
          <button onClick={() => {
            window.dispatchEvent(new CustomEvent('wizard-navigate', { detail: 'training' }));
            setCurrentStep(3);
          }}>
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
          <button onClick={() => {
            window.dispatchEvent(new CustomEvent('wizard-navigate', { detail: 'production' }));
            setCurrentStep(4);
          }}>
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

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
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

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="wizard-overlay">
      <div className="wizard-container">
        <div className="wizard-header">
          <h2>{steps[currentStep].title}</h2>
          <button className="wizard-close" onClick={handleSkip}>×</button>
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
        </div>

        <div className="wizard-footer">
          <button onClick={handlePrevious} disabled={currentStep === 0}>
            {t('wizard.previous')}
          </button>
          <button onClick={handleSkip}>{t('wizard.skipWizard')}</button>
          <button onClick={handleNext} className="primary">
            {currentStep === steps.length - 1 ? t('wizard.finish') : t('wizard.next')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Wizard;
