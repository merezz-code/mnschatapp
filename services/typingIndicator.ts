import { db } from './database';

export interface TypingStatus {
  userId: string;
  chatId: string; // groupId ou receiverId
  isTyping: boolean;
  timestamp: number;
}

// Simuler un état temporaire en mémoire (temps réel simulé)
const typingStates = new Map<string, TypingStatus>();
const listeners = new Set<(status: TypingStatus) => void>();

export const setTyping = (userId: string, chatId: string, isTyping: boolean) => {
  const key = `${chatId}_${userId}`;
  const status: TypingStatus = { userId, chatId, isTyping, timestamp: Date.now() };
  
  typingStates.set(key, status);
  listeners.forEach(listener => listener(status));
  
  // Auto-clear après 3 secondes d'inactivité
  if (isTyping) {
    setTimeout(() => {
      const current = typingStates.get(key);
      if (current && current.timestamp === status.timestamp) {
        setTyping(userId, chatId, false);
      }
    }, 3000);
  }
};

export const subscribeToTyping = (chatId: string, callback: (status: TypingStatus) => void) => {
  const wrappedCallback = (status: TypingStatus) => {
    if (status.chatId === chatId) callback(status);
  };
  listeners.add(wrappedCallback);
  return () => listeners.delete(wrappedCallback);
};

export const getTypingUsers = (chatId: string, excludeUserId?: string): string[] => {
  const now = Date.now();
  return Array.from(typingStates.values())
    .filter(s => 
      s.chatId === chatId && 
      s.isTyping && 
      s.userId !== excludeUserId &&
      (now - s.timestamp) < 5000 // Expire après 5s
    )
    .map(s => s.userId);
};