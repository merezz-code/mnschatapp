const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const routes = require('./routes');
const { query } = require('./databases/db');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({ message: 'Chat API Server Running', status: 'OK' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const onlineUsers = new Map();
const userGroups = new Map();

//HELPER pour vérifier si un user est en ligne
function isUserOnline(userId) {
  return onlineUsers.has(userId.toString());
}

io.on('connection', async (socket) => {
  console.log(`Utilisateur connecté: ${socket.id}`);
  
  const userId = socket.handshake.query.userId;
  
  if (userId) {
    onlineUsers.set(userId, socket.id);
    
    try {
      await query('UPDATE users SET is_online = 1 WHERE id = $1', [userId]);
    } catch (error) {
      console.error('Erreur mise à jour BDD:', error);
    }
    
    io.emit('user_status_changed', {
      userId,
      isOnline: true,
    });
    
    console.log(`User ${userId} est maintenant en ligne`);
  }

  socket.on('private_message', (data) => {
    console.log(`Message privé de ${data.senderId} vers ${data.receiverId}`);
    io.emit('receive_private_message', data);
    console.log(`Message privé diffusé`);
  });

  socket.on('group_message', (data) => {
    console.log(`👥 Message de groupe dans ${data.groupId} par ${data.senderId}`);
    io.to(data.groupId).emit('receive_group_message', data);
    socket.emit('receive_group_message', data);
    console.log(`Message de groupe diffusé dans ${data.groupId}`);
  });

  socket.on('join_group', (groupId) => {
    socket.join(groupId);
    if (!userGroups.has(userId)) {
      userGroups.set(userId, new Set());
    }
    userGroups.get(userId).add(groupId);
    console.log(`${userId} (${socket.id}) a rejoint le groupe ${groupId}`);
  });

  socket.on('leave_group', (groupId) => {
    socket.leave(groupId);
    if (userGroups.has(userId)) {
      userGroups.get(userId).delete(groupId);
    }
    console.log(` ${userId} a quitté le groupe ${groupId}`);
  });

  socket.on('typing', (data) => {
    const receiverSocketId = onlineUsers.get(data.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_typing', {
        senderId: userId,
        isTyping: data.isTyping,
      });
    }
  });

  socket.on('delete_private_message', (data) => {
    console.log(`Suppression message ${data.messageId}`);
    io.emit('message_deleted', data);
    console.log(`Suppression diffusée`);
  });

  socket.on('user_online', async (onlineUserId) => {
    console.log(`Réception user_online pour: ${onlineUserId}`);
    onlineUsers.set(onlineUserId, socket.id);
    
    try {
      await query('UPDATE users SET is_online = 1 WHERE id = $1', [onlineUserId]);
      console.log(`BDD: ${onlineUserId} marqué en ligne (manuel)`);
      
      io.emit('user_status_changed', {
        userId: onlineUserId,
        isOnline: true,
      });
      
      console.log(`Statut en ligne diffusé pour ${onlineUserId}`);
    } catch (error) {
      console.error('Erreur user_online:', error);
    }
  });

  socket.on('user_offline', async (offlineUserId) => {
    onlineUsers.delete(offlineUserId);
    userGroups.delete(offlineUserId);
    
    try {
      await query('UPDATE users SET is_online = 0 WHERE id = $1', [offlineUserId]);
      console.log(`BDD: ${offlineUserId} marqué hors ligne`);
    } catch (error) {
      console.error('Erreur mise à jour BDD:', error);
    }
    
    io.emit('user_status_changed', {
      userId: offlineUserId,
      isOnline: false,
    });
    
    console.log(`${offlineUserId} est maintenant hors ligne`);
  });

  // Vérifier le statut d'un utilisateur
  socket.on('check_user_status', (targetUserId) => {
    const status = isUserOnline(targetUserId);
    console.log(`Vérification statut de ${targetUserId}: ${status ? 'EN LIGNE' : 'HORS LIGNE'}`);
    
    socket.emit('user_status_response', {
      userId: targetUserId,
      isOnline: status
    });
  });

  socket.on('disconnect', async () => {
    console.log(`🔌 Utilisateur déconnecté: ${socket.id}`);
    
    if (userId) {
      onlineUsers.delete(userId);
      userGroups.delete(userId);
      
      try {
        await query('UPDATE users SET is_online = 0 WHERE id = $1', [userId]);
        console.log(`BDD: ${userId} marqué hors ligne (déconnexion)`);
      } catch (error) {
        console.error('Erreur mise à jour BDD:', error);
      }
      
      io.emit('user_status_changed', {
        userId,
        isOnline: false,
      });
      
      console.log(`⚫ ${userId} est maintenant hors ligne (déconnexion)`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur Socket.io + API démarré sur le port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
  console.log(`🔌 Socket.io: http://localhost:${PORT}`);
});