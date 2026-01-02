
export enum RoomType {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  DIRECT = 'DIRECT'
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'busy';
  bio?: string;
  blockedUsers?: string[];
}

export interface Message {
  id: string;
  senderId: string;
  roomId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'audio';
  timestamp: number;
  fileName?: string;
  fileSize?: string;
  isDeleted?: boolean;
}

export interface ChatRoom {
  id: string;
  name: string;
  type: RoomType;
  participants: string[];
  admins: string[];
  lastMessage?: string;
  lastUpdate: number;
  avatar?: string;
  unreadCount?: number;
}

export type AppView = 'AUTH' | 'CHATS' | 'ROOM' | 'PROFILE' | 'CONTACTS' | 'CALL' | 'SETTINGS';
