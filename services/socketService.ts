import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;

  // URL de votre serveur Socket.io (à remplacer par votre serveur)
  private readonly SERVER_URL = 'http://10.120.62.243:3000/';

  connect(userId: string) {
    if (this.socket?.connected) {
      console.log('✅ Socket déjà connecté');
      return;
    }

    this.userId = userId;
    this.socket = io(this.SERVER_URL, {
      transports: ['websocket'],
      query: { userId },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Connecté au serveur Socket.io');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Déconnecté du serveur Socket.io');
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Erreur de connexion Socket.io:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('🔌 Socket déconnecté');
    }
  }

  // Envoyer un message privé
  sendPrivateMessage(data: {
    senderId: string;
    receiverId: string;
    content: string;
    type: string;
    fileName?: string;
    fileUrl?: string;
    imageUrl?: string;
    audioUrl?: string;
    timestamp: number;
  }) {
    if (this.socket) {
      this.socket.emit('private_message', data);
    }
  }
    emitDeleteMessage(data) {
    this.socket.emit('delete_private_message', data);
    }

    onMessageDeleted(callback) {
    this.socket.on('message_deleted', callback);
    }

  // Envoyer un message de groupe
  sendGroupMessage(data: {
    groupId: string;
    senderId: string;
    content: string;
    type: string;
    fileName?: string;
    fileUrl?: string;
    imageUrl?: string;
    audioUrl?: string;
    timestamp: number;
  }) {
    if (this.socket) {
      this.socket.emit('group_message', data);
    }
  }

  // Écouter les messages privés
  onPrivateMessage(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('receive_private_message', callback);
    }
  }

  // Écouter les messages de groupe
  onGroupMessage(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('receive_group_message', callback);
    }
  }

  // Marquer un utilisateur comme en ligne
  setUserOnline(userId: string) {
    if (this.socket) {
      this.socket.emit('user_online', userId);
    }
  }

  // Marquer un utilisateur comme hors ligne
  setUserOffline(userId: string) {
    if (this.socket) {
      this.socket.emit('user_offline', userId);
    }
  }

  // Écouter les changements de statut
  onUserStatusChange(callback: (data: { userId: string; isOnline: boolean }) => void) {
    if (this.socket) {
      this.socket.on('user_status_changed', callback);
    }
  }

  // Notifier qu'on tape un message
  emitTyping(receiverId: string, isTyping: boolean) {
    if (this.socket) {
      this.socket.emit('typing', { receiverId, isTyping });
    }
  }

  // Écouter quand quelqu'un tape
  onTyping(callback: (data: { senderId: string; isTyping: boolean }) => void) {
    if (this.socket) {
      this.socket.on('user_typing', callback);
    }
  }

  // Rejoindre un groupe
  joinGroup(groupId: string) {
    if (this.socket) {
      this.socket.emit('join_group', groupId);
    }
  }

  // Quitter un groupe
  leaveGroup(groupId: string) {
    if (this.socket) {
      this.socket.emit('leave_group', groupId);
    }
  }

  // Nettoyer tous les listeners
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

export default new SocketService();