import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { chatQuery } from '../services/api';
import { getAIConfig } from '../utils/aiConfig';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      const cfg = getAIConfig();
      const response = await chatQuery(
        userMessage.content,
        cfg.useLocalModel ? 'ollama' : undefined,
        cfg.useLocalModel ? cfg.localModelName : cfg.defaultCloudModel,
        cfg.useLocalModel ? cfg.localBaseUrl : undefined,
        cfg.useLocalModel ? undefined : cfg.defaultPlatform
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
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--vs-fg)' }}>
          {t('nav.chatAssistant') || 'Chat Assistant'}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--vs-muted)' }}>
          {getAIConfig().useLocalModel
            ? `${t('trainingLab.useLocalModel')}: ${getAIConfig().localModelName}`
            : `${getAIConfig().defaultPlatform} / ${getAIConfig().defaultCloudModel}`}
        </div>
      </div>
      
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome" style={{ padding: '20px', textAlign: 'center', color: 'var(--vs-muted)' }}>
            <p>{t('chat.welcome') || 'How can I help you today?'}</p>
            <p style={{ fontSize: '11px', marginTop: '8px' }}>
              {getAIConfig().useLocalModel 
                ? `Using Local: ${getAIConfig().localModelName}`
                : `Using Cloud: ${getAIConfig().defaultPlatform} / ${getAIConfig().defaultCloudModel}`}
            </p>
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