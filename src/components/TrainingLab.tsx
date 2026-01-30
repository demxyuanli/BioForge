import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { generateAnnotations, Annotation, getDocuments } from '../services/api';

const TrainingLab: React.FC = () => {
  const { t } = useTranslation();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4');
  const [knowledgePoints, setKnowledgePoints] = useState<string[]>([]);

  useEffect(() => {
    loadKnowledgePoints();
  }, []);

  const loadKnowledgePoints = async () => {
    try {
      const docs = await getDocuments();
      const points: string[] = [];
      docs.forEach(doc => {
        if (doc.chunks) {
          points.push(...doc.chunks);
        }
      });
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
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            <option value="qwen-plus">Qwen Plus</option>
            <option value="deepseek-chat">DeepSeek Chat</option>
          </select>
        </div>
      </div>

      <div className="actions">
        <button onClick={handleGenerateAnnotations} disabled={isGenerating || !apiKey}>
          {isGenerating ? t('trainingLab.generating') : t('trainingLab.generateInstructionPairs')}
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
