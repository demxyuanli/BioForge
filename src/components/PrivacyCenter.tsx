import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';

interface APIKey {
  platform: string;
  encrypted: boolean;
}

const PrivacyCenter: React.FC = () => {
  const { t } = useTranslation();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [apiKeyValue, setApiKeyValue] = useState('');

  useEffect(() => {
    loadAPIKeys();
  }, []);

  const loadAPIKeys = async () => {
    setApiKeys([]);
  };

  const handleSaveAPIKey = async () => {
    if (!selectedPlatform || !apiKeyValue) return;
    
    try {
      const response = await invoke('save_api_key', {
        platform: selectedPlatform,
        apiKey: apiKeyValue
      });
      console.log('API key saved:', response);
      setApiKeyValue('');
      await loadAPIKeys();
    } catch (error) {
      console.error('Save API key error:', error);
      alert(`Failed to save API key: ${error}`);
    }
  };

  const platforms = ['dashscope', 'fireworks', 'together', 'openai'];

  return (
    <div className="privacy-center">
      <h2>{t('privacyCenter.title')}</h2>
      
      <div className="api-keys-section">
        <h3>{t('privacyCenter.apiKeysManagement')}</h3>
        <div className="form-group">
          <label>{t('privacyCenter.platform')}:</label>
          <select value={selectedPlatform} onChange={(e) => setSelectedPlatform(e.target.value)}>
            <option value="">{t('privacyCenter.selectPlatform')}</option>
            {platforms.map(platform => (
              <option key={platform} value={platform}>{platform}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{t('privacyCenter.apiKey')}:</label>
          <input
            type="password"
            value={apiKeyValue}
            onChange={(e) => setApiKeyValue(e.target.value)}
            placeholder={t('privacyCenter.enterApiKey')}
          />
        </div>
        <button onClick={handleSaveAPIKey}>{t('privacyCenter.saveApiKey')}</button>
      </div>

      <div className="stored-keys">
        <h3>{t('privacyCenter.storedApiKeys')}</h3>
        {apiKeys.length === 0 ? (
          <p>{t('privacyCenter.noApiKeys')}</p>
        ) : (
          <ul>
            {apiKeys.map((key) => (
              <li key={key.platform}>
                {key.platform}: {key.encrypted ? `✓ ${t('privacyCenter.encrypted')}` : t('privacyCenter.notEncrypted')}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="desensitization-section">
        <h3>{t('privacyCenter.dataDesensitization')}</h3>
        <p>{t('privacyCenter.autoDesensitization')}</p>
        <button>{t('privacyCenter.viewDesensitizationLog')}</button>
      </div>

      <div className="audit-log-section">
        <h3>{t('privacyCenter.auditLog')}</h3>
        <button>{t('privacyCenter.viewAuditLog')}</button>
      </div>
    </div>
  );
};

export default PrivacyCenter;
