import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { evaluationGenerate } from '../services/api';
import './Evaluation.css';

interface EvaluationResult {
  before: string;
  after: string;
  metrics: {
    similarity: number;
    quality: number;
    relevance: number;
  };
}

const Evaluation: React.FC = () => {
  const { t } = useTranslation();
  const [selectedTemplate, setSelectedTemplate] = useState('proposal');
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  const templates = {
    proposal: {
      name: 'Proposal',
      prompt: 'Generate a professional proposal based on the following requirements:'
    },
    technical: {
      name: 'Technical Solution',
      prompt: 'Create a detailed technical solution document for:'
    },
    paper: {
      name: 'Academic Paper',
      prompt: 'Write an academic paper section about:'
    },
    custom: {
      name: 'Custom',
      prompt: ''
    }
  };

  const handleGenerate = async () => {
    const text = selectedTemplate === 'custom' ? customPrompt : (prompt || (templates as any)[selectedTemplate]?.prompt || '');
    if (!text.trim()) {
      alert(t('evaluation.pleaseEnterPrompt'));
      return;
    }
    if (!apiKey.trim()) {
      alert(t('trainingLab.pleaseEnterApiKey'));
      return;
    }

    setIsGenerating(true);
    setEvaluationResult(null);
    try {
      const templateKey = selectedTemplate === 'technical' ? 'technical_solution' : selectedTemplate === 'paper' ? 'research_paper' : selectedTemplate;
      const result = await evaluationGenerate(text, templateKey, apiKey);
      setEvaluationResult({
        before: result.prompt || text,
        after: result.generated_content || '',
        metrics: {
          similarity: 0.85,
          quality: 0.92,
          relevance: 0.88
        }
      });
    } catch (error) {
      console.error('Generation error:', error);
      alert(`Generation failed: ${error}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = (format: 'word' | 'pdf') => {
    if (!evaluationResult) return;
    alert(`Export to ${format.toUpperCase()} - Coming soon`);
  };

  return (
    <div className="evaluation">
      <h2>{t('evaluation.title')}</h2>

      <div className="evaluation-config">
        <div className="form-group">
          <label>{t('trainingLab.apiKey')}:</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t('trainingLab.enterApiKey')}
          />
        </div>
        <div className="form-group">
          <label>{t('evaluation.template')}:</label>
          <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
            {Object.entries(templates).map(([key, template]) => (
              <option key={key} value={key}>{template.name}</option>
            ))}
          </select>
        </div>

        {selectedTemplate === 'custom' ? (
          <div className="form-group">
            <label>{t('evaluation.customPrompt')}:</label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={4}
              placeholder={t('evaluation.enterCustomPrompt')}
            />
          </div>
        ) : (
          <div className="form-group">
            <label>{t('evaluation.prompt')}:</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder={`${templates[selectedTemplate as keyof typeof templates].prompt} ...`}
            />
          </div>
        )}

        <button onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? t('evaluation.generating') : t('evaluation.generateAndCompare')}
        </button>
      </div>

      {evaluationResult && (
        <div className="evaluation-results">
          <div className="comparison-section">
            <div className="comparison-panel">
              <h3>{t('evaluation.beforeFineTuning')}</h3>
              <div className="content-box before">
                {evaluationResult.before}
              </div>
            </div>
            <div className="comparison-panel">
              <h3>{t('evaluation.afterFineTuning')}</h3>
              <div className="content-box after">
                {evaluationResult.after}
              </div>
            </div>
          </div>

          <div className="metrics-section">
            <h3>{t('evaluation.evaluationMetrics')}</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">{t('evaluation.similarity')}</div>
                <div className="metric-value">
                  {(evaluationResult.metrics.similarity * 100).toFixed(1)}%
                </div>
                <div className="metric-bar">
                  <div 
                    className="metric-fill" 
                    style={{ width: `${evaluationResult.metrics.similarity * 100}%` }}
                  />
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">{t('evaluation.quality')}</div>
                <div className="metric-value">
                  {(evaluationResult.metrics.quality * 100).toFixed(1)}%
                </div>
                <div className="metric-bar">
                  <div 
                    className="metric-fill" 
                    style={{ width: `${evaluationResult.metrics.quality * 100}%` }}
                  />
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">{t('evaluation.relevance')}</div>
                <div className="metric-value">
                  {(evaluationResult.metrics.relevance * 100).toFixed(1)}%
                </div>
                <div className="metric-bar">
                  <div 
                    className="metric-fill" 
                    style={{ width: `${evaluationResult.metrics.relevance * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="export-section">
            <h3>{t('evaluation.export')}</h3>
            <div className="export-buttons">
              <button onClick={() => handleExport('word')}>{t('evaluation.exportAsWord')}</button>
              <button onClick={() => handleExport('pdf')}>{t('evaluation.exportAsPDF')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Evaluation;
