const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log(`Utilisateur connecté: ${socket.id}`);
  
  const userId = socket.handshake.query.userId;
  if (userId) {
    onlineUsers.set(userId, socket.id);
    
    // Notifier tous les autres qu'un utilisateur est en ligne
    socket.broadcast.emit('user_status_changed', {
      userId,
      isOnline: true,
    });
  }

  // Message privé
  socket.on('private_message', (data) => {
    const receiverSocketId = onlineUsers.get(data.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('receive_private_message', data);
    }
  });

  // Message de groupe
  socket.on('group_message', (data) => {
    socket.to(data.groupId).emit('receive_group_message', data);
  });

  // Rejoindre un groupe
  socket.on('join_group', (groupId) => {
    socket.join(groupId);
    console.log(`👥 ${userId} a rejoint le groupe ${groupId}`);
  });

  // Quitter un groupe
  socket.on('leave_group', (groupId) => {
    socket.leave(groupId);
  });

  // Utilisateur en train d'écrire
  socket.on('typing', (data) => {
    const receiverSocketId = onlineUsers.get(data.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_typing', {
        senderId: userId,
        isTyping: data.isTyping,
      });
    }
  });

  // Utilisateur hors ligne
  socket.on('user_offline', (userId) => {
    onlineUsers.delete(userId);
    socket.broadcast.emit('user_status_changed', {
      userId,
      isOnline: false,
    });
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log(`❌ Utilisateur déconnecté: ${socket.id}`);
    if (userId) {
      onlineUsers.delete(userId);
      socket.broadcast.emit('user_status_changed', {
        userId,
        isOnline: false,
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur Socket.io démarré sur le port ${PORT}`);
});