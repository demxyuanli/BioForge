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
import { 
  getStoredTheme, 
  applyTheme, 
  AppTheme,
  getStoredFontFamily,
  getStoredFontScale,
  applyFontFamily,
  applyFontScale,
  setupThemeListener,
  FONT_FAMILY_OPTIONS,
  FONT_SCALE_OPTIONS
} from '../utils/theme';
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
  const [fontFamily, setFontFamily] = useState<string>(getStoredFontFamily());
  const [fontScale, setFontScale] = useState<number>(getStoredFontScale());

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
      alert(t('settings.models.apiKeySaveFailedWithReason', { error: String(error) }));
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
      alert(t('settings.models.ollamaConnectFailed'));
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
          {activeTab === 'models' && t('settings.models.title')}
          {activeTab === 'privacy' && t('settings.privacy.title')}
          {activeTab === 'context' && t('settings.context.title')}
        </h1>

        {activeTab === 'general' && (
          <>
            <section className="settings-section">
              <h2>{t('settings.general.appearance')}</h2>
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
                      setupThemeListener();
                    }}
                  >
                    <option value="system">{t('settings.general.themeSystem')}</option>
                    <option value="light">{t('settings.general.themeLight')}</option>
                    <option value="dark">{t('settings.general.themeDark')}</option>
                  </select>
                </div>
                <div className="settings-field">
                  <label>{t('settings.general.fontFamily')}</label>
                  <select
                    className="settings-select"
                    value={fontFamily}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFontFamily(v);
                      applyFontFamily(v);
                    }}
                  >
                    {FONT_FAMILY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="settings-field">
                  <label>{t('settings.general.fontSize')}</label>
                  <select
                    className="settings-select"
                    value={fontScale}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setFontScale(v);
                      applyFontScale(v);
                    }}
                  >
                    {FONT_SCALE_OPTIONS.map(scale => (
                      <option key={scale} value={scale}>
                        {scale}%
                      </option>
                    ))}
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
              <h2>{t('settings.models.ollamaTitle')}</h2>
              <p className="settings-section-desc">{t('settings.models.ollamaDesc')}</p>
              <div className="settings-field-group">
                <div className="settings-field">
                  <label>{t('settings.models.baseUrl')}</label>
                  <input
                    className="settings-input"
                    type="text"
                    value={localBaseUrl}
                    onChange={(e) => setLocalBaseUrl(e.target.value)}
                    placeholder={t('settings.models.baseUrlPlaceholder')}
                  />
                </div>
                <div className="settings-field">
                  <label>{t('settings.models.modelName')}</label>
                  <div style={{ display: 'flex', gap: '8px', maxWidth: '400px' }}>
                    <input
                      className="settings-input"
                      list="local-models-list"
                      type="text"
                      value={localModelName}
                      onChange={(e) => setLocalModelName(e.target.value)}
                      placeholder={t('settings.models.modelPlaceholder')}
                    />
                    <datalist id="local-models-list">
                      {availableLocalModels.map(m => <option key={m} value={m} />)}
                    </datalist>
                    <button 
                      className="settings-btn"
                      onClick={fetchLocalModels}
                      disabled={isFetchingModels}
                    >
                      {isFetchingModels ? t('sidebar.loading') : t('settings.models.refresh')}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="settings-section">
              <h2>{t('settings.models.cloudTitle')}</h2>
              <p className="settings-section-desc">{t('settings.models.cloudDesc')}</p>
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
                {loadingLogs ? t('sidebar.loading') : t('privacyCenter.viewDesensitizationLog')}
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
              <p className="settings-section-desc">{t('settings.privacy.viewAuditDesc')}</p>
              <button className="settings-btn" onClick={loadAuditLog}>
                {loadingLogs ? t('sidebar.loading') : t('privacyCenter.viewAuditLog')}
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
            <h2>{t('settings.context.ragTitle')}</h2>
            <p className="settings-section-desc">{t('settings.context.ragDesc')}</p>
            <div className="settings-field-group">
              <div className="settings-field">
                <label>{t('settings.context.chunkSize')}</label>
                <input className="settings-input" type="number" defaultValue={500} />
              </div>
              <div className="settings-field">
                <label>{t('settings.context.contextWindow')}</label>
                <input className="settings-input" type="number" defaultValue={5} />
              </div>
              <p className="settings-hint">{t('settings.context.hint')}</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Settings;