import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { chatQuery } from '../services/api';
import { getAIConfig } from '../utils/aiConfig';
import { useChat } from '../contexts/ChatContext';
import type { Message } from '../contexts/ChatContext';
import './ChatAssistant.css';

const CHAT_UNTITLED = 'chat.untitled';

const MAX_INPUT_LINES = 10;

const ChatAssistant: React.FC = () => {
  const { t } = useTranslation();
  const { messages, updateConversation, appendUserMessage } = useChat();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const aiConfig = useMemo(() => getAIConfig(), []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const adjustInputHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseInt(getComputedStyle(el).lineHeight, 10) || 21;
    const maxHeight = lineHeight * MAX_INPUT_LINES;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    adjustInputHeight();
  }, [inputValue, adjustInputHeight]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const content = inputValue.trim();
    const conv = appendUserMessage(content, t(CHAT_UNTITLED));
    const conversationId = conv.id;
    setInputValue('');
    setIsLoading(true);

    try {
      const cfg = getAIConfig();
      const response = await chatQuery(
        content,
        cfg.useLocalModel ? 'ollama' : undefined,
        cfg.useLocalModel ? cfg.localModelName : cfg.defaultCloudModel,
        cfg.useLocalModel ? cfg.localBaseUrl : undefined,
        cfg.useLocalModel ? undefined : cfg.defaultPlatform
      );

      const data = response && typeof response === 'object' ? response as Record<string, unknown> : {};
      let answerText = typeof data.answer === 'string' ? data.answer : '';
      if (!answerText && data.answer != null) answerText = String(data.answer);
      const sources = Array.isArray(data.sources) ? data.sources : [];

      if (process.env.NODE_ENV === 'development' && !answerText) {
        console.warn('Chat response missing answer:', Object.keys(data), data);
      }

      const displayContent =
        (answerText && answerText.trim()) || t('chat.error') || 'No response.';
      const assistantMessage: Message = {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: displayContent,
        sources,
        timestamp: Date.now()
      };

      updateConversation(conversationId, (c) => ({
        ...c,
        messages: [...c.messages, assistantMessage]
      }));
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `msg_${Date.now()}_e`,
        role: 'assistant',
        content:
          t('chat.error') ||
          'Sorry, I encountered an error processing your request.',
        timestamp: Date.now()
      };
      updateConversation(conversationId, (c) => ({
        ...c,
        messages: [...c.messages, errorMessage]
      }));
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

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  const handleEditQuestion = useCallback((text: string) => {
    setInputValue(text);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const isEmpty = messages.length === 0;

  return (
    <div className="chat-assistant">
      <div className="chat-main">
        {!isEmpty && (
          <header className="chat-header">
            <span className="chat-header-model">
              {aiConfig.useLocalModel
                ? `${t('trainingLab.useLocalModel')}: ${aiConfig.localModelName}`
                : `${aiConfig.defaultPlatform} / ${aiConfig.defaultCloudModel}`}
            </span>
          </header>
        )}
        <div className="chat-messages-wrap">
          <div className={`chat-messages ${isEmpty ? 'chat-messages-empty' : ''}`}>
            {isEmpty && (
              <div className="chat-welcome">
                <p className="chat-welcome-text">
                  {t('chat.welcome') || 'How can I help you today?'}
                </p>
                <p className="chat-welcome-hint">
                  {aiConfig.useLocalModel
                    ? `Using Local: ${aiConfig.localModelName}`
                    : `Using Cloud: ${aiConfig.defaultPlatform} / ${aiConfig.defaultCloudModel}`}
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                <div className="chat-bubble-avatar" aria-hidden>
                  {msg.role === 'user' ? 'U' : 'A'}
                </div>
                <div className="chat-bubble-body">
                  <div className="chat-bubble-content">{msg.content}</div>
                  <div className="chat-bubble-actions">
                    <button
                      type="button"
                      className="chat-bubble-action chat-bubble-action-copy"
                      onClick={() => handleCopy(msg.content)}
                      title={t('chat.copy')}
                      aria-label={t('chat.copy')}
                    />
                    {msg.role === 'user' && (
                      <button
                        type="button"
                        className="chat-bubble-action chat-bubble-action-edit"
                        onClick={() => handleEditQuestion(msg.content)}
                        title={t('chat.edit')}
                        aria-label={t('chat.edit')}
                      />
                    )}
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="chat-bubble-sources">
                      <strong>{t('chat.sources') || 'Sources'}:</strong>
                      <ul>
                        {msg.sources.map((source: any, idx: number) => (
                          <li key={idx}>
                            Doc {source.document_id} (Chunk{' '}
                            {source.chunk_index})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="chat-bubble assistant">
                <div className="chat-bubble-avatar" aria-hidden>
                  A
                </div>
                <div className="chat-bubble-body">
                  <div className="chat-loading">
                    <div className="chat-loading-dots">
                      <div className="chat-loading-dot" />
                      <div className="chat-loading-dot" />
                      <div className="chat-loading-dot" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className="chat-input-area">
          <div className="chat-input-wrap">
            <textarea
              ref={inputRef}
              className="chat-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.placeholder') || 'Send a message...'}
              disabled={isLoading}
              rows={1}
            />
            <button
              type="button"
              className="chat-send-btn"
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
              title={t('chat.send') || 'Send'}
              aria-label={t('chat.send') || 'Send'}
            >
              <span className="chat-send-arrow" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatAssistant;
