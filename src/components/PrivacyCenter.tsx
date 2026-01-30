import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { saveApiKey, getApiKeys, getAuditLog, getDesensitizationLog } from '../services/api';

interface APIKey {
  platform: string;
  encrypted: boolean;
}

const PrivacyCenter: React.FC = () => {
  const { t } = useTranslation();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [auditLogEntries, setAuditLogEntries] = useState<any[]>([]);
  const [desensitizationEntries, setDesensitizationEntries] = useState<any[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showDesensitizationLog, setShowDesensitizationLog] = useState(false);

  useEffect(() => {
    loadAPIKeys();
  }, []);

  const loadAPIKeys = async () => {
    try {
      const list = await getApiKeys();
      setApiKeys(list);
    } catch (error) {
      console.error('Load API keys error:', error);
    }
  };

  const handleSaveAPIKey = async () => {
    if (!selectedPlatform || !apiKeyValue) return;
    try {
      await saveApiKey(selectedPlatform, apiKeyValue);
      setApiKeyValue('');
      await loadAPIKeys();
    } catch (error) {
      console.error('Save API key error:', error);
      alert(`Failed to save API key: ${error}`);
    }
  };

  const handleShowAuditLog = async () => {
    try {
      const { entries } = await getAuditLog(200);
      setAuditLogEntries(entries);
      setShowAuditLog(true);
    } catch (error) {
      console.error('Load audit log error:', error);
      setAuditLogEntries([]);
      setShowAuditLog(true);
    }
  };

  const handleShowDesensitizationLog = async () => {
    try {
      const { entries } = await getDesensitizationLog(100);
      setDesensitizationEntries(entries);
      setShowDesensitizationLog(true);
    } catch (error) {
      console.error('Load desensitization log error:', error);
      setDesensitizationEntries([]);
      setShowDesensitizationLog(true);
    }
  };

  const platforms = ['deepseek', 'fireworks', 'together', 'openai'];

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
        <button onClick={handleShowDesensitizationLog}>{t('privacyCenter.viewDesensitizationLog')}</button>
      </div>

      <div className="audit-log-section">
        <h3>{t('privacyCenter.auditLog')}</h3>
        <button onClick={handleShowAuditLog}>{t('privacyCenter.viewAuditLog')}</button>
      </div>

      {showAuditLog && (
        <div className="log-modal">
          <div className="log-modal-content">
            <h3>{t('privacyCenter.auditLog')}</h3>
            <pre className="log-entries">
              {auditLogEntries.length === 0
                ? t('privacyCenter.noEntries')
                : auditLogEntries.map((e, i) => (
                    <div key={i}>{typeof e === 'object' ? JSON.stringify(e, null, 2) : String(e)}</div>
                  ))}
            </pre>
            <button onClick={() => setShowAuditLog(false)}>{t('common.close')}</button>
          </div>
        </div>
      )}

      {showDesensitizationLog && (
        <div className="log-modal">
          <div className="log-modal-content">
            <h3>{t('privacyCenter.viewDesensitizationLog')}</h3>
            <pre className="log-entries">
              {desensitizationEntries.length === 0
                ? t('privacyCenter.noEntries')
                : desensitizationEntries.map((e, i) => (
                    <div key={i}>{typeof e === 'object' ? JSON.stringify(e, null, 2) : String(e)}</div>
                  ))}
            </pre>
            <button onClick={() => setShowDesensitizationLog(false)}>{t('common.close')}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivacyCenter;
