import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useChat } from '../contexts/ChatContext';
import type { Conversation } from '../contexts/ChatContext';
import './ChatHistorySidebar.css';

const MS_DAY = 24 * 60 * 60 * 1000;

function getGroupKey(createdAt: number): string {
  const d = new Date(createdAt);
  const todayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const nowDayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
  const diffDays = Math.floor((nowDayStart - todayStart) / MS_DAY);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays <= 7) return 'last7';
  if (diffDays <= 30) return 'within30';
  return `month:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const ChatHistorySidebar: React.FC = () => {
  const { t } = useTranslation();
  const {
    conversations,
    currentId,
    historyLoaded,
    newChat,
    selectConversation,
    deleteConversation
  } = useChat();

  const grouped = useMemo(() => {
    const sorted = [...conversations].sort((a, b) => b.createdAt - a.createdAt);
    const map = new Map<string, Conversation[]>();
    for (const c of sorted) {
      const key = getGroupKey(c.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    const order: Record<string, number> = {
      today: 0,
      yesterday: 1,
      last7: 2,
      within30: 3
    };
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a.startsWith('month:') && b.startsWith('month:')) return b.localeCompare(a);
      return (order[a] ?? 100) - (order[b] ?? 100);
    });
    return keys.map((key) => ({
      key,
      label: key === 'today' ? t('chat.historyToday')
        : key === 'yesterday' ? t('chat.historyYesterday')
        : key === 'last7' ? t('chat.historyLast7Days')
        : key === 'within30' ? t('chat.historyWithin30Days')
        : key.replace('month:', ''),
      conversations: map.get(key)!
    }));
  }, [conversations, t]);

  return (
    <div className="chat-history-sidebar-in-menu">
      <button type="button" className="chat-history-sidebar-new" onClick={newChat}>
        <span className="chat-history-sidebar-new-icon">+</span>
        {t('chat.startNewChat')}
      </button>
      <div className="chat-history-sidebar-list">
        {!historyLoaded ? (
          <div className="chat-history-sidebar-loading">{t('status.loading')}</div>
        ) : (
          grouped.map(({ key, label, conversations: list }) => (
            <div key={key} className="chat-history-sidebar-group">
              <div className="chat-history-sidebar-group-title">{label}</div>
              {list.map((c) => (
                <div
                  key={c.id}
                  className={`chat-history-sidebar-item ${currentId === c.id ? 'active' : ''}`}
                  onClick={() => selectConversation(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectConversation(c.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="chat-history-sidebar-item-title" title={c.title}>
                    {c.title}
                  </span>
                  <button
                    type="button"
                    className="chat-history-sidebar-item-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(c.id);
                    }}
                    title={t('chat.deleteConversation')}
                    aria-label={t('chat.deleteConversation')}
                  />
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatHistorySidebar;
