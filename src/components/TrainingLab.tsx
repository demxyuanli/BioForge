import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { generateAnnotations, Annotation, getKnowledgePoints, saveTrainingSet } from '../services/api';

const TrainingLab: React.FC = () => {
  const { t } = useTranslation();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [knowledgePoints, setKnowledgePoints] = useState<string[]>([]);
  const [savingForFinetuning, setSavingForFinetuning] = useState(false);

  useEffect(() => {
    loadKnowledgePoints();
  }, []);

  const loadKnowledgePoints = async () => {
    try {
      const points = await getKnowledgePoints();
      setKnowledgePoints(points);
    } catch (error) {
      console.error('Failed to load knowledge points:', error);
    }
  };

  const handleGenerateAnnotations = async () => {
    if (!apiKey) {
      alert(t('trainingLab.pleaseEnterApiKey'));
      return;
    }

    if (knowledgePoints.length === 0) {
      alert(t('trainingLab.noKnowledgePoints'));
      return;
    }

    setIsGenerating(true);
    try {
      const generated = await generateAnnotations(
        knowledgePoints.slice(0, 10),
        apiKey,
        selectedModel
      );
      setAnnotations(generated);
    } catch (error) {
      console.error('Generation error:', error);
      alert(`${t('trainingLab.failedToGenerate')}: ${error}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveForFinetuning = async () => {
    if (annotations.length === 0) {
      alert(t('trainingLab.noAnnotations'));
      return;
    }
    setSavingForFinetuning(true);
    try {
      await saveTrainingSet(annotations);
      alert(t('trainingLab.savedForFinetuning'));
    } catch (error) {
      console.error('Save for finetuning error:', error);
      alert(`${t('trainingLab.failedToGenerate')}: ${error}`);
    } finally {
      setSavingForFinetuning(false);
    }
  };

  const handleExportJSONL = () => {
    const jsonl = annotations
      .map(ann => JSON.stringify(ann))
      .join('\n');
    
    const blob = new Blob([jsonl], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annotations.jsonl';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleScoreChange = (index: number, score: number) => {
    const updated = [...annotations];
    updated[index] = { ...updated[index], score };
    setAnnotations(updated);
  };

  return (
    <div className="training-lab">
      <h2>{t('trainingLab.title')}</h2>

      <div className="training-lab-usage">
        <h4>{t('trainingLab.howToUse')}</h4>
        <ol className="training-lab-usage-steps">
          <li>{t('trainingLab.usageStep1')}</li>
          <li>{t('trainingLab.usageStep2')}</li>
          <li>{t('trainingLab.usageStep3')}</li>
          <li>{t('trainingLab.usageStep4')}</li>
          <li>{t('trainingLab.usageStep5')}</li>
        </ol>
      </div>

      <div className="config-section">
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
          <label>{t('trainingLab.model')}:</label>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            <option value="deepseek-chat">DeepSeek Chat</option>
            <option value="deepseek-r1">DeepSeek R1</option>
          </select>
        </div>
      </div>

      <div className="actions">
        <button onClick={loadKnowledgePoints}>
          {t('trainingLab.refreshKnowledgePoints')}
        </button>
        <button onClick={handleGenerateAnnotations} disabled={isGenerating || !apiKey}>
          {isGenerating ? t('trainingLab.generating') : t('trainingLab.generateInstructionPairs')}
        </button>
        <button onClick={handleSaveForFinetuning} disabled={annotations.length === 0 || savingForFinetuning}>
          {savingForFinetuning ? t('trainingLab.saving') : t('trainingLab.saveForFinetuning')}
        </button>
        <button onClick={handleExportJSONL} disabled={annotations.length === 0}>
          {t('trainingLab.exportJSONL')} ({annotations.length} {t('trainingLab.items')})
        </button>
      </div>

      {knowledgePoints.length > 0 && (
        <div className="info-section">
          <p>{t('trainingLab.availableKnowledgePoints')}: {knowledgePoints.length}</p>
        </div>
      )}

      <div className="annotations-list">
        <h3>{t('trainingLab.annotations')}</h3>
        {annotations.length === 0 ? (
          <p>{t('trainingLab.noAnnotations')}</p>
        ) : (
          <div className="annotation-items">
            {annotations.map((ann, index) => (
              <div key={index} className="annotation-item">
                <div className="instruction">
                  <strong>{t('trainingLab.instruction')}:</strong> {ann.instruction}
                </div>
                <div className="response">
                  <strong>{t('trainingLab.response')}:</strong> {ann.response}
                </div>
                <div className="scoring">
                  <label>{t('trainingLab.score')}:</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={ann.score || ''}
                    onChange={(e) => handleScoreChange(index, parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingLab;
