/**
 * Centralized AI config - read from Settings (localStorage).
 * All AI features use this config; no per-component API key/model selection.
 */

const KEY_USE_LOCAL = 'ai_use_local_model';
const KEY_PLATFORM = 'ai_default_platform';
const KEY_CLOUD_MODEL = 'ai_default_cloud_model';
const KEY_OLLAMA_MODEL = 'ollama_model';
const KEY_OLLAMA_BASE_URL = 'ollama_base_url';

export interface AIConfig {
  useLocalModel: boolean;
  defaultPlatform: string;
  defaultCloudModel: string;
  localModelName: string;
  localBaseUrl: string;
}

export function getAIConfig(): AIConfig {
  return {
    useLocalModel: localStorage.getItem(KEY_USE_LOCAL) === 'true',
    defaultPlatform: localStorage.getItem(KEY_PLATFORM) || 'deepseek',
    defaultCloudModel: localStorage.getItem(KEY_CLOUD_MODEL) || 'deepseek-chat',
    localModelName: localStorage.getItem(KEY_OLLAMA_MODEL) || 'qwen2.5:7b',
    localBaseUrl: localStorage.getItem(KEY_OLLAMA_BASE_URL) || 'http://localhost:11434/v1',
  };
}

export function setAIConfig(config: Partial<AIConfig>): void {
  if (config.useLocalModel !== undefined) {
    localStorage.setItem(KEY_USE_LOCAL, String(config.useLocalModel));
  }
  if (config.defaultPlatform !== undefined) {
    localStorage.setItem(KEY_PLATFORM, config.defaultPlatform);
  }
  if (config.defaultCloudModel !== undefined) {
    localStorage.setItem(KEY_CLOUD_MODEL, config.defaultCloudModel);
  }
  if (config.localModelName !== undefined) {
    localStorage.setItem(KEY_OLLAMA_MODEL, config.localModelName);
  }
  if (config.localBaseUrl !== undefined) {
    localStorage.setItem(KEY_OLLAMA_BASE_URL, config.localBaseUrl);
  }
}
