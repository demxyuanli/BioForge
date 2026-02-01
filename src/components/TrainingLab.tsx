import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { generateAnnotations, Annotation, getKnowledgePoints, saveTrainingSet, getLocalModels, type KnowledgePoint } from '../services/api';
import { getAIConfig } from '../utils/aiConfig';

const TrainingLab: React.FC = () => {
  const { t } = useTranslation();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [availableLocalModels, setAvailableLocalModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [savingForFinetuning, setSavingForFinetuning] = useState(false);

  useEffect(() => {
    loadKnowledgePoints();
  }, []);

  useEffect(() => {
    const cfg = getAIConfig();
    if (cfg.useLocalModel) {
      fetchLocalModels();
    }
  }, []);

  const fetchLocalModels = async () => {
    const cfg = getAIConfig();
    setIsFetchingModels(true);
    try {
      const models = await getLocalModels(cfg.localBaseUrl);
      setAvailableLocalModels(models);
    } catch (error) {
      console.error('Failed to fetch local models:', error);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const loadKnowledgePoints = async () => {
    try {
      const resp = await getKnowledgePoints();
      setKnowledgePoints(resp.knowledge_points || []);
    } catch (error) {
      console.error('Failed to load knowledge points:', error);
    }
  };

  const handleGenerateAnnotations = async () => {
    const cfg = getAIConfig();
    if (!cfg.useLocalModel && !cfg.defaultPlatform) {
      alert(t('trainingLab.configureInSettings'));
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
        cfg.useLocalModel ? 'ollama' : '',
        cfg.useLocalModel ? cfg.localModelName : cfg.defaultCloudModel,
        cfg.useLocalModel ? cfg.localBaseUrl : undefined,
        cfg.useLocalModel ? undefined : cfg.defaultPlatform
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
      {getAIConfig().useLocalModel && (
      <div className="config-section">
          <div className="form-group">
            <label>{t('trainingLab.localModelName')}:</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                list="local-models-list"
                type="text"
                value={getAIConfig().localModelName}
                readOnly
                style={{ flex: 1, backgroundColor: 'var(--vs-input-bg)', color: 'var(--vs-muted)' }}
              />
              <datalist id="local-models-list">
                {availableLocalModels.map(m => <option key={m} value={m} />)}
              </datalist>
              <button 
                onClick={fetchLocalModels} 
                title={t('trainingLab.refreshModels')}
                style={{ padding: '0 8px', minWidth: '32px' }}
                disabled={isFetchingModels}
              >
                {isFetchingModels ? '...' : '\u21bb'}
              </button>
            </div>
          </div>
      </div>
      )}

      <div className="actions">
        <button onClick={loadKnowledgePoints}>
          {t('trainingLab.refreshKnowledgePoints')}
        </button>
        <button onClick={handleGenerateAnnotations} disabled={isGenerating}>
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
