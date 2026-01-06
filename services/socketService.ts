// services/socketService.ts - AVEC VÉRIFICATION STATUT
import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private userId: string | null = null; 
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  // URL de votre serveur Socket.io
  private readonly SERVER_URL = 'http://192.168.1.7:3000';

  connect(userId: string) {
    if (this.socket?.connected) {
      console.log('✅ Socket déjà connecté');
      return this.socket;
    }

    this.userId = userId;
    this.socket = io(this.SERVER_URL, {
      transports: ['websocket', 'polling'],
      query: { userId },
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      console.log('✅ Connecté au serveur Socket.io:', this.socket?.id);
      this.reconnectAttempts = 0;
      
      if (userId) {
        this.socket?.emit('user_online', userId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Déconnecté du serveur Socket.io:', reason);

      if (reason === 'io server disconnect') {
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      console.error(`❌ Erreur connexion Socket.io (${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, error.message);

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('🔴 Nombre maximum de tentatives de reconnexion atteint');
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconnecté après ${attemptNumber} tentative(s)`);
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Tentative de reconnexion ${attemptNumber}...`);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('🔴 Échec de toutes les tentatives de reconnexion');
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      if (this.userId) {
        this.socket.emit('user_offline', this.userId);
      }
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;
      this.reconnectAttempts = 0;
      console.log('🔌 Socket déconnecté');
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // ============ MESSAGES PRIVÉS ============

  sendPrivateMessage(data: {
    senderId: string;
    receiverId: string;
    content: string;
    type?: string;
    fileName?: string;
    fileUrl?: string;
    imageUrl?: string;
    audioUrl?: string;
    timestamp: number;
  }) {
    if (this.socket) {
      const messageData = {
        ...data,
        type: data.type || 'text'
      };
      this.socket.emit('private_message', messageData);
      console.log(`💬 Message privé envoyé à ${data.receiverId}`);
    } else {
      console.error('❌ Socket non connecté - impossible d\'envoyer le message');
    }
  }

  onPrivateMessage(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('receive_private_message', callback);
    }
  }

  offPrivateMessage() {
    if (this.socket) {
      this.socket.off('receive_private_message');
    }
  }

  emitDeleteMessage(data: { messageId: number; receiverId: string }) {
    if (this.socket) {
      this.socket.emit('delete_private_message', data);
      console.log(`🗑️ Suppression du message ${data.messageId}`);
    }
  }

  onMessageDeleted(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('message_deleted', callback);
    }
  }

  offMessageDeleted() {
    if (this.socket) {
      this.socket.off('message_deleted');
    }
  }

  // ============ MESSAGES DE GROUPE ============

  sendGroupMessage(data: {
    groupId: string;
    senderId: string;
    content: string;
    type?: string;
    fileName?: string;
    fileUrl?: string;
    imageUrl?: string;
    audioUrl?: string;
    timestamp: number;
  }) {
    if (this.socket) {
      const messageData = {
        ...data,
        type: data.type || 'text'
      };
      this.socket.emit('group_message', messageData);
      console.log(`💬 Message de groupe envoyé au groupe ${data.groupId}`);
    } else {
      console.error('❌ Socket non connecté - impossible d\'envoyer le message');
    }
  }

  onGroupMessage(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('receive_group_message', callback);
    }
  }

  offGroupMessage() {
    if (this.socket) {
      this.socket.off('receive_group_message');
    }
  }

  joinGroup(groupId: string) {
    if (this.socket) {
      this.socket.emit('join_group', groupId);
      console.log(`👥 Rejoint le groupe ${groupId}`);
    }
  }

  leaveGroup(groupId: string) {
    if (this.socket) {
      this.socket.emit('leave_group', groupId);
      console.log(`👋 Quitté le groupe ${groupId}`);
    }
  }

  // ============ STATUTS UTILISATEUR ============

  setUserOnline(userId: string) {
    if (this.socket) {
      this.socket.emit('user_online', userId);
      console.log(`🟢 Utilisateur ${userId} en ligne`);
    }
  }

  setUserOffline(userId: string) {
    if (this.socket) {
      this.socket.emit('user_offline', userId);
      console.log(`⚫ Utilisateur ${userId} hors ligne`);
    }
  }

  // Vérifier le statut en temps réel
  checkUserStatus(userId: string, callback: (data: { userId: string; isOnline: boolean }) => void) {
    if (this.socket) {
      this.socket.emit('check_user_status', userId);
      this.socket.once('user_status_response', callback);
    }
  }

  onUserStatusChange(callback: (data: { userId: string; isOnline: boolean }) => void) {
    if (this.socket) {
      this.socket.on('user_status_changed', callback);
    }
  }

  offUserStatusChange() {
    if (this.socket) {
      this.socket.off('user_status_changed');
    }
  }

  // ============ STATUT "EN TRAIN D'ÉCRIRE" ============

  emitTyping(receiverId: string, isTyping: boolean) {
    if (this.socket) {
      this.socket.emit('typing', { receiverId, isTyping });
    }
  }

  onTyping(callback: (data: { senderId: string; isTyping: boolean }) => void) {
    if (this.socket) {
      this.socket.on('user_typing', callback);
    }
  }

  offTyping() {
    if (this.socket) {
      this.socket.off('user_typing');
    }
  }

  // ============ UTILITAIRES ============

  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
      console.log('🧹 Tous les listeners supprimés');
    }
  }

  removeBusinessListeners() {
    if (this.socket) {
      this.socket.off('receive_private_message');
      this.socket.off('receive_group_message');
      this.socket.off('user_status_changed');
      this.socket.off('user_typing');
      this.socket.off('message_deleted');
      console.log('🧹 Listeners métier supprimés');
    }
  }


  /**
   * 👥 Écouter les nouveaux groupes publics
   */
  onNewPublicGroup(callback: (group: any) => void) {
    if (this.socket) {
      this.socket.on('new_public_group', callback);
    }
  }

  /**
   * 🚫 Arrêter d'écouter les nouveaux groupes publics
   */
  offNewPublicGroup() {
    if (this.socket) {
      this.socket.off('new_public_group');
    }
  }
  onMessageBlocked(callback: () => void) {
  if (this.socket) {
    this.socket.on('message_blocked', callback);
  }
}

}
// Export singleton
export default new SocketService();