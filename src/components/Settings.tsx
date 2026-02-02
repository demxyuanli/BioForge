import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  getStorageConfig, 
  saveApiKey, 
  getApiKeys, 
  getAuditLog, 
  getDesensitizationLog,
  getLocalModels
} from '../services/api';
import { getStoredTheme, applyTheme, AppTheme } from '../utils/theme';
import './Settings.css';

export type SettingsTab = 'general' | 'models' | 'privacy' | 'context';

interface APIKey {
  platform: string;
  encrypted: boolean;
}

interface SettingsProps {
  activeTab?: SettingsTab;
}

const Settings: React.FC<SettingsProps> = ({ activeTab: propActiveTab }) => {
  const { t } = useTranslation();
  // If controlled via props (from App.tsx sidebar), use it. Otherwise default to internal state (fallback).
  // Default to 'general' if no prop is provided
  const activeTab = propActiveTab || 'general';
  
  const [loading, setLoading] = useState(true);

  // General Settings State
  const [documentsDir, setDocumentsDir] = useState<string | null>(null);
  const [dbPath, setDbPath] = useState<string | null>(null);
  const [theme, setTheme] = useState<AppTheme>(getStoredTheme());

  // Model Settings State
  const [localModelName, setLocalModelName] = useState(localStorage.getItem('ollama_model') || 'qwen2.5:7b');
  const [localBaseUrl, setLocalBaseUrl] = useState(localStorage.getItem('ollama_base_url') || 'http://localhost:11434/v1');
  const [availableLocalModels, setAvailableLocalModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [apiKeyValue, setApiKeyValue] = useState('');

  // Privacy Settings State
  const [auditLogEntries, setAuditLogEntries] = useState<any[]>([]);
  const [desensitizationEntries, setDesensitizationEntries] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const config = await getStorageConfig();
        setDocumentsDir(config?.documentsDir ?? null);
        setDbPath(config?.dbPath ?? null);
        
        await loadAPIKeys();
      } catch (error) {
        console.error('Settings initialization error:', error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Save local model settings when changed
  useEffect(() => {
    localStorage.setItem('ollama_model', localModelName);
    localStorage.setItem('ollama_base_url', localBaseUrl);
  }, [localModelName, localBaseUrl]);

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
      alert(t('settings.models.apiKeySaved') || 'API Key saved successfully');
    } catch (error) {
      console.error('Save API key error:', error);
      alert(`Failed to save API key: ${error}`);
    }
  };

  const fetchLocalModels = async () => {
    setIsFetchingModels(true);
    try {
      const models = await getLocalModels(localBaseUrl);
      setAvailableLocalModels(models);
      if (models.length > 0 && !models.includes(localModelName)) {
        if (localModelName === 'qwen2.5:7b') {
          setLocalModelName(models[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch local models:', error);
      alert('Failed to connect to Ollama. Please check if it is running.');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const loadAuditLog = async () => {
    setLoadingLogs(true);
    try {
      const { entries } = await getAuditLog(200);
      setAuditLogEntries(entries);
    } catch (error) {
      console.error('Load audit log error:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const loadDesensitizationLog = async () => {
    setLoadingLogs(true);
    try {
      const { entries } = await getDesensitizationLog(100);
      setDesensitizationEntries(entries);
    } catch (error) {
      console.error('Load desensitization log error:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const platforms = ['deepseek', 'fireworks', 'together', 'openai'];

  if (loading) {
    return (
      <div className="settings-container">
        <div className="settings-loading">{t('sidebar.loading')}</div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      {/* Sidebar removed here, moved to SettingsSidebar.tsx */}

      <div className="settings-content">
        <h1>
          {activeTab === 'general' && t('settings.general.title')}
          {activeTab === 'models' && (t('settings.models.title') || 'Model Configuration')}
          {activeTab === 'privacy' && (t('settings.privacy.title') || 'Privacy & Rules')}
          {activeTab === 'context' && (t('settings.context.title') || 'Context & Knowledge')}
        </h1>

        {activeTab === 'general' && (
          <>
            <section className="settings-section">
              <h2>{t('settings.general.appearance') || 'Appearance'}</h2>
              <div className="settings-field-group">
                <div className="settings-field">
                  <label>{t('settings.general.theme')}</label>
                  <select
                    className="settings-select"
                    value={theme}
                    onChange={(e) => {
                      const v = e.target.value as AppTheme;
                      setTheme(v);
                      applyTheme(v);
                    }}
                  >
                    <option value="system">{t('settings.general.themeSystem')}</option>
                    <option value="light">{t('settings.general.themeLight')}</option>
                    <option value="dark">{t('settings.general.themeDark')}</option>
                  </select>
                </div>
                <div className="settings-field">
                  <label>{t('settings.general.language')}</label>
                  <div className="settings-input" style={{ backgroundColor: 'var(--settings-input-bg)', border: '1px solid var(--settings-input-border)', color: 'var(--settings-muted)' }}>
                    {t('settings.general.languageDesc')}
                  </div>
                </div>
              </div>
            </section>

            <section className="settings-section">
              <h2>{t('settings.storage.title')}</h2>
              <p className="settings-section-desc">{t('settings.storage.description')}</p>
              {documentsDir !== null && dbPath !== null ? (
                <div className="settings-field-group">
                  <div className="settings-field">
                    <label>{t('settings.storage.documentsDir')}</label>
                    <div className="settings-readonly">{documentsDir}</div>
                  </div>
                  <div className="settings-field">
                    <label>{t('settings.storage.dbPath')}</label>
                    <div className="settings-readonly">{dbPath}</div>
                  </div>
                  <p className="settings-hint">{t('settings.storage.readonlyHint')}</p>
                </div>
              ) : (
                <p className="settings-empty">{t('settings.storage.notConfigured')}</p>
              )}
            </section>
          </>
        )}

        {activeTab === 'models' && (
          <>
            <section className="settings-section">
              <h2>Local LLM (Ollama)</h2>
              <p className="settings-section-desc">Configure your local Ollama instance for privacy-preserving inference.</p>
              <div className="settings-field-group">
                <div className="settings-field">
                  <label>Base URL</label>
                  <input
                    className="settings-input"
                    type="text"
                    value={localBaseUrl}
                    onChange={(e) => setLocalBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434/v1"
                  />
                </div>
                <div className="settings-field">
                  <label>Model Name</label>
                  <div style={{ display: 'flex', gap: '8px', maxWidth: '400px' }}>
                    <input
                      className="settings-input"
                      list="local-models-list"
                      type="text"
                      value={localModelName}
                      onChange={(e) => setLocalModelName(e.target.value)}
                      placeholder="e.g. qwen2.5:7b"
                    />
                    <datalist id="local-models-list">
                      {availableLocalModels.map(m => <option key={m} value={m} />)}
                    </datalist>
                    <button 
                      className="settings-btn"
                      onClick={fetchLocalModels}
                      disabled={isFetchingModels}
                    >
                      {isFetchingModels ? '...' : 'Refresh'}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="settings-section">
              <h2>Cloud Providers & API Keys</h2>
              <p className="settings-section-desc">Manage API keys for cloud-based models (DeepSeek, OpenAI, etc.). Keys are stored encrypted.</p>
              <div className="settings-field-group">
                <div className="settings-field">
                  <label>{t('privacyCenter.platform')}</label>
                  <select 
                    className="settings-select"
                    value={selectedPlatform} 
                    onChange={(e) => setSelectedPlatform(e.target.value)}
                  >
                    <option value="">{t('privacyCenter.selectPlatform')}</option>
                    {platforms.map(platform => (
                      <option key={platform} value={platform}>{platform}</option>
                    ))}
                  </select>
                </div>
                <div className="settings-field">
                  <label>{t('privacyCenter.apiKey')}</label>
                  <input
                    className="settings-input"
                    type="password"
                    value={apiKeyValue}
                    onChange={(e) => setApiKeyValue(e.target.value)}
                    placeholder={t('privacyCenter.enterApiKey')}
                  />
                </div>
                <div>
                  <button className="settings-btn" onClick={handleSaveAPIKey}>{t('privacyCenter.saveApiKey')}</button>
                </div>

                <div className="stored-keys" style={{ marginTop: '16px' }}>
                  <label>{t('privacyCenter.storedApiKeys')}</label>
                  {apiKeys.length === 0 ? (
                    <p className="settings-empty">{t('privacyCenter.noApiKeys')}</p>
                  ) : (
                    <ul style={{ paddingLeft: '20px', marginTop: '8px', color: 'var(--vs-fg)' }}>
                      {apiKeys.map((key) => (
                        <li key={key.platform}>
                          {key.platform}: {key.encrypted ? `✓ ${t('privacyCenter.encrypted')}` : t('privacyCenter.notEncrypted')}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {activeTab === 'privacy' && (
          <>
            <section className="settings-section">
              <h2>{t('privacyCenter.dataDesensitization')}</h2>
              <p className="settings-section-desc">{t('privacyCenter.autoDesensitization')}</p>
              <button className="settings-btn" onClick={loadDesensitizationLog}>
                {loadingLogs ? 'Loading...' : t('privacyCenter.viewDesensitizationLog')}
              </button>
              
              {desensitizationEntries.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div className="settings-log-view">
                    {desensitizationEntries.map((e, i) => (
                      <div key={i} className="settings-log-entry">
                        {typeof e === 'object' ? JSON.stringify(e, null, 2) : String(e)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="settings-section">
              <h2>{t('privacyCenter.auditLog')}</h2>
              <p className="settings-section-desc">View system audit logs for security and compliance.</p>
              <button className="settings-btn" onClick={loadAuditLog}>
                {loadingLogs ? 'Loading...' : t('privacyCenter.viewAuditLog')}
              </button>

              {auditLogEntries.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div className="settings-log-view">
                    {auditLogEntries.map((e, i) => (
                      <div key={i} className="settings-log-entry">
                        {typeof e === 'object' ? JSON.stringify(e, null, 2) : String(e)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'context' && (
          <section className="settings-section">
            <h2>RAG & Context Management</h2>
            <p className="settings-section-desc">Configure retrieval augmented generation parameters.</p>
            <div className="settings-field-group">
              <div className="settings-field">
                <label>Chunk Size</label>
                <input className="settings-input" type="number" defaultValue={500} />
              </div>
              <div className="settings-field">
                <label>Context Window (Top K)</label>
                <input className="settings-input" type="number" defaultValue={5} />
              </div>
              <p className="settings-hint">These settings will be applied to new queries.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Settings;