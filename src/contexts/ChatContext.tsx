import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { readChatHistory, writeChatHistory } from '../services/api';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

const DEFAULT_UNTITLED = 'New chat';
const MAX_TITLE_LEN = 32;

function generateId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

interface ChatContextValue {
  conversations: Conversation[];
  currentId: string | null;
  historyLoaded: boolean;
  currentConversation: Conversation | null;
  messages: Message[];
  setCurrentId: (id: string | null) => void;
  newChat: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  updateConversation: (id: string, updater: (c: Conversation) => Conversation) => void;
  appendUserMessage: (content: string, titleForNew?: string) => Conversation;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const PERSIST_DEBOUNCE_MS = 400;

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const conversationsRef = useRef<Conversation[]>([]);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentConversation = currentId
    ? conversations.find((c) => c.id === currentId) ?? null
    : null;
  const messages = currentConversation?.messages ?? [];

  conversationsRef.current = conversations;

  const flushPersist = useCallback(() => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    const list = conversationsRef.current;
    const json = JSON.stringify(
      list.map((c) => ({
        id: c.id,
        title: c.title,
        messages: c.messages,
        createdAt: c.createdAt
      }))
    );
    writeChatHistory(json).catch((e) => console.error('Failed to save chat history:', e));
  }, []);

  const schedulePersist = useCallback(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(flushPersist, PERSIST_DEBOUNCE_MS);
  }, [flushPersist]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await readChatHistory();
        const list: Conversation[] = JSON.parse(raw || '[]');
        if (!Array.isArray(list)) return;
        if (cancelled) return;
        setConversations(list);
        conversationsRef.current = list;
      } catch (e) {
        console.error('Failed to load chat history:', e);
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      const list = conversationsRef.current;
      if (list.length > 0) {
        const json = JSON.stringify(
          list.map((c) => ({
            id: c.id,
            title: c.title,
            messages: c.messages,
            createdAt: c.createdAt
          }))
        );
        writeChatHistory(json).catch(() => {});
      }
    };
  }, []);

  const setConversationsAndPersist = useCallback(
    (updater: (prev: Conversation[]) => Conversation[]) => {
      setConversations((prev) => {
        const next = updater(prev);
        conversationsRef.current = next;
        schedulePersist();
        return next;
      });
    },
    [schedulePersist]
  );

  const newChat = useCallback(() => {
    setCurrentId(null);
  }, []);

  const selectConversation = useCallback((id: string) => {
    setCurrentId(id);
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversationsAndPersist((prev) => prev.filter((c) => c.id !== id));
      setCurrentId((prev) => (prev === id ? null : prev));
    },
    [setConversationsAndPersist]
  );

  const appendUserMessage = useCallback(
    (content: string, titleForNew?: string): Conversation => {
      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now()
      };
      let created: Conversation | null = null;
      let newId: string | null = null;
      setConversationsAndPersist((prev) => {
        let conv = currentId ? prev.find((c) => c.id === currentId) : null;
        if (!conv) {
          const firstTitle = content.trim().slice(0, MAX_TITLE_LEN) || titleForNew || DEFAULT_UNTITLED;
          created = {
            id: generateId(),
            title: firstTitle,
            messages: [userMessage],
            createdAt: Date.now()
          };
          newId = created.id;
          return [created, ...prev];
        }
        const title =
          conv.messages.length === 0
            ? (content.slice(0, MAX_TITLE_LEN) || titleForNew || DEFAULT_UNTITLED)
            : conv.title;
        return prev.map((c) =>
          c.id === conv!.id
            ? { ...c, title, messages: [...c.messages, userMessage] }
            : c
        );
      });
      if (newId !== null) setCurrentId(newId);
      if (created) return created;
      return {
        id: currentId!,
        title: DEFAULT_UNTITLED,
        messages: [userMessage],
        createdAt: Date.now()
      };
    },
    [currentId, setConversationsAndPersist]
  );

  const updateConversation = useCallback(
    (id: string, updater: (c: Conversation) => Conversation) => {
      setConversationsAndPersist((prev) =>
        prev.map((c) => (c.id === id ? updater(c) : c))
      );
    },
    [setConversationsAndPersist]
  );

  const value: ChatContextValue = {
    conversations,
    currentId,
    historyLoaded,
    currentConversation,
    messages,
    setCurrentId,
    newChat,
    selectConversation,
    deleteConversation,
    updateConversation,
    appendUserMessage
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}

export function useChatOptional(): ChatContextValue | null {
  return useContext(ChatContext);
}

export { MAX_TITLE_LEN };
