import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { chatQuery, getLocalModels } from '../services/api';
import './ChatAssistant.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  timestamp: number;
}

const ChatAssistant: React.FC = () => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [useLocalModel, setUseLocalModel] = useState(false);
  const [localModelName, setLocalModelName] = useState('qwen2.5:7b');
  const [localBaseUrl, setLocalBaseUrl] = useState('http://localhost:11434/v1');
  const [availableLocalModels, setAvailableLocalModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (useLocalModel && showSettings) {
      fetchLocalModels();
    }
  }, [useLocalModel, showSettings]);

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
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chatQuery(
        userMessage.content,
        useLocalModel ? 'ollama' : undefined,
        useLocalModel ? localModelName : undefined,
        useLocalModel ? localBaseUrl : undefined
      );
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: t('chat.error') || 'Sorry, I encountered an error processing your request.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-assistant">
      <div className="chat-header" style={{ 
        padding: '8px 16px', 
        borderBottom: '1px solid var(--vs-border)',
        display: 'flex',
        justifyContent: 'flex-end'
      }}>
        <button 
          className="vs-icon-btn" 
          onClick={() => setShowSettings(!showSettings)}
          title="Chat Settings"
          style={{ background: 'none', border: 'none', color: 'var(--vs-text)', cursor: 'pointer' }}
        >
          &#9881;
        </button>
      </div>
      
      {showSettings && (
        <div className="chat-settings" style={{
          padding: '12px',
          borderBottom: '1px solid var(--vs-border)',
          backgroundColor: 'var(--vs-sidebar-bg)',
          fontSize: '12px'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useLocalModel}
                onChange={(e) => setUseLocalModel(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Use Local Model (Ollama)
            </label>
          </div>
          {useLocalModel && (
            <>
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    list="chat-local-models-list"
                    type="text"
                    value={localModelName}
                    onChange={(e) => setLocalModelName(e.target.value)}
                    placeholder="Model Name (e.g. qwen2.5:7b)"
                    style={{ width: '100%', padding: '4px', marginTop: '4px', flex: 1 }}
                  />
                  <datalist id="chat-local-models-list">
                    {availableLocalModels.map(m => <option key={m} value={m} />)}
                  </datalist>
                  <button 
                    onClick={fetchLocalModels}
                    title="Refresh"
                    style={{ 
                      marginTop: '4px', 
                      padding: '0 8px', 
                      background: 'var(--vs-button-secondary-bg)', 
                      color: 'var(--vs-button-secondary-fg)', 
                      border: '1px solid var(--vs-border)', 
                      cursor: 'pointer' 
                    }}
                    disabled={isFetchingModels}
                  >
                    {isFetchingModels ? '...' : '\u21bb'}
                  </button>
                </div>
              </div>
              <div>
                <input
                  type="text"
                  value={localBaseUrl}
                  onChange={(e) => setLocalBaseUrl(e.target.value)}
                  onBlur={() => { if(useLocalModel) fetchLocalModels(); }}
                  placeholder="Base URL"
                  style={{ width: '100%', padding: '4px', marginTop: '4px' }}
                />
              </div>
            </>
          )}
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <p>{t('chat.welcome') || 'How can I help you today?'}</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            <div className="chat-message-content">{msg.content}</div>
            {msg.sources && msg.sources.length > 0 && (
              <div className="chat-message-sources">
                <strong>{t('chat.sources') || 'Sources'}:</strong>
                <ul>
                  {msg.sources.map((source, idx) => (
                    <li key={idx}>
                      Doc {source.document_id} (Chunk {source.chunk_index})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="chat-loading">
            <div className="chat-loading-dots">
              <div className="chat-loading-dot"></div>
              <div className="chat-loading-dot"></div>
              <div className="chat-loading-dot"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.placeholder') || 'Type a message...'}
          disabled={isLoading}
        />
        <button 
          className="chat-send-btn" 
          onClick={handleSendMessage}
          disabled={isLoading || !inputValue.trim()}
        >
          {t('chat.send') || 'Send'}
        </button>
      </div>
    </div>
  );
};

export default ChatAssistant;
