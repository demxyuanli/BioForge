import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { generateAnnotations, Annotation, getKnowledgePoints, saveTrainingSet, getLocalModels } from '../services/api';

const TrainingLab: React.FC = () => {
  const { t } = useTranslation();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [localModelName, setLocalModelName] = useState('qwen2.5:7b');
  const [localBaseUrl, setLocalBaseUrl] = useState('http://localhost:11434/v1');
  const [useLocalModel, setUseLocalModel] = useState(false);
  const [availableLocalModels, setAvailableLocalModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [knowledgePoints, setKnowledgePoints] = useState<string[]>([]);
  const [savingForFinetuning, setSavingForFinetuning] = useState(false);

  useEffect(() => {
    loadKnowledgePoints();
  }, []);

  useEffect(() => {
    if (useLocalModel) {
      fetchLocalModels();
    }
  }, [useLocalModel]);

  const fetchLocalModels = async () => {
    setIsFetchingModels(true);
    try {
      const models = await getLocalModels(localBaseUrl);
      setAvailableLocalModels(models);
      if (models.length > 0 && !models.includes(localModelName)) {
        // If current name is default and not in list, switch to first available
        if (localModelName === 'qwen2.5:7b') {
             setLocalModelName(models[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch local models:', error);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const loadKnowledgePoints = async () => {
    try {
      const points = await getKnowledgePoints();
      setKnowledgePoints(points);
    } catch (error) {
      console.error('Failed to load knowledge points:', error);
    }
  };

  const handleGenerateAnnotations = async () => {
    if (!useLocalModel && !apiKey) {
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
        useLocalModel ? 'ollama' : apiKey,
        useLocalModel ? localModelName : selectedModel,
        useLocalModel ? localBaseUrl : undefined
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
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={useLocalModel}
              onChange={(e) => setUseLocalModel(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            {t('trainingLab.useLocalModel') || 'Use Local Model (Ollama)'}
          </label>
        </div>

        {!useLocalModel ? (
          <>
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
          </>
        ) : (
          <>
            <div className="form-group">
              <label>{t('trainingLab.localModelName') || 'Local Model Name'}:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  list="local-models-list"
                  type="text"
                  value={localModelName}
                  onChange={(e) => setLocalModelName(e.target.value)}
                  placeholder="e.g., qwen2.5:7b"
                  style={{ flex: 1 }}
                />
                <datalist id="local-models-list">
                  {availableLocalModels.map(m => <option key={m} value={m} />)}
                </datalist>
                <button 
                  onClick={fetchLocalModels} 
                  title="Refresh Models"
                  style={{ padding: '0 8px', minWidth: '32px' }}
                  disabled={isFetchingModels}
                >
                  {isFetchingModels ? '...' : '\u21bb'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>{t('trainingLab.localBaseUrl') || 'Local Base URL'}:</label>
              <input
                type="text"
                value={localBaseUrl}
                onChange={(e) => setLocalBaseUrl(e.target.value)}
                onBlur={() => { if(useLocalModel) fetchLocalModels(); }}
                placeholder="e.g., http://localhost:11434/v1"
              />
            </div>
          </>
        )}
      </div>

      <div className="actions">
        <button onClick={loadKnowledgePoints}>
          {t('trainingLab.refreshKnowledgePoints')}
        </button>
        <button onClick={handleGenerateAnnotations} disabled={isGenerating || (!useLocalModel && !apiKey)}>
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
