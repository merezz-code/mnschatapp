
import { User, ChatRoom, Message, RoomType } from './types';

// Initial Mock Data
export const MOCK_ME: User = {
  id: 'me',
  name: 'Alex Johnson',
  avatar: 'https://picsum.photos/seed/me/200',
  status: 'online',
  bio: 'Software engineer & UI lover.'
};

export const MOCK_USERS: User[] = [
  { id: 'user1', name: 'Sarah Chen', avatar: 'https://picsum.photos/seed/user1/200', status: 'online' },
  { id: 'user2', name: 'Mark Wilson', avatar: 'https://picsum.photos/seed/user2/200', status: 'offline' },
  { id: 'user3', name: 'Elena Rodriguez', avatar: 'https://picsum.photos/seed/user3/200', status: 'online' },
];

export const MOCK_ROOMS: ChatRoom[] = [
  {
    id: 'room-public-1',
    name: 'General Discussion',
    type: RoomType.PUBLIC,
    participants: ['me', 'user1', 'user2', 'user3'],
    admins: ['user1'],
    lastMessage: 'Welcome everyone!',
    lastUpdate: Date.now(),
    avatar: 'https://picsum.photos/seed/general/200',
    unreadCount: 0
  },
  {
    id: 'room-private-1',
    name: 'Project Alpha',
    type: RoomType.PRIVATE,
    participants: ['me', 'user1'],
    admins: ['me'],
    lastMessage: 'Check the new designs.',
    lastUpdate: Date.now() - 3600000,
    avatar: 'https://picsum.photos/seed/project/200',
    unreadCount: 3
  },
  {
    id: 'room-direct-1',
    name: 'Sarah Chen',
    type: RoomType.DIRECT,
    participants: ['me', 'user1'],
    admins: [],
    lastMessage: 'Are we meeting today?',
    lastUpdate: Date.now() - 7200000,
    avatar: 'https://picsum.photos/seed/user1/200',
    unreadCount: 1
  },
  {
    id: 'room-discover-1',
    name: 'Crypto & Web3',
    type: RoomType.PUBLIC,
    participants: ['user1', 'user2'],
    admins: ['user1'],
    lastMessage: 'Bitcoin just hit new ATH!',
    lastUpdate: Date.now() - 50000,
    avatar: 'https://picsum.photos/seed/crypto/200',
    unreadCount: 0
  }
];

export const MOCK_MESSAGES: Message[] = [
  { id: 'm1', senderId: 'user1', roomId: 'room-public-1', content: 'Hello everyone!', type: 'text', timestamp: Date.now() - 10000000 },
  { id: 'm2', senderId: 'me', roomId: 'room-public-1', content: 'Hey Sarah! Glad to be here.', type: 'text', timestamp: Date.now() - 9000000 },
];
