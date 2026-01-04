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

const onlineUsers = new Map(); // userId -> socketId
const userGroups = new Map();  // userId -> Set of groupIds

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
    
    console.log(`👤 User ${userId} est maintenant en ligne`);
  }

  // Message privé
  socket.on('private_message', (data) => {
    console.log(`💬 Message privé de ${data.senderId} vers ${data.receiverId}`);
    const receiverSocketId = onlineUsers.get(data.receiverId);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('receive_private_message', data);
      console.log(`Message privé envoyé à ${data.receiverId}`);
    } else {
      console.log(`⚠️ Utilisateur ${data.receiverId} hors ligne`);
    }
  });

  // CORRECTION: Message de groupe
  socket.on('group_message', (data) => {
    console.log(`👥 Message de groupe dans ${data.groupId} par ${data.senderId}`);
    
    // Envoyer le message à TOUS les membres du groupe SAUF l'expéditeur
    socket.to(data.groupId).emit('receive_group_message', data);
    console.log(`Message de groupe diffusé dans ${data.groupId}`);
  });

  // Rejoindre un groupe
  socket.on('join_group', (groupId) => {
    socket.join(groupId);
    
    // Enregistrer que cet utilisateur est dans ce groupe
    if (!userGroups.has(userId)) {
      userGroups.set(userId, new Set());
    }
    userGroups.get(userId).add(groupId);
    
    console.log(`👥 ${userId} (${socket.id}) a rejoint le groupe ${groupId}`);
  });

  // Quitter un groupe
  socket.on('leave_group', (groupId) => {
    socket.leave(groupId);
    
    if (userGroups.has(userId)) {
      userGroups.get(userId).delete(groupId);
    }
    
    console.log(`${userId} a quitté le groupe ${groupId}`);
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

  // Supprimer un message privé
  socket.on('delete_private_message', (data) => {
    console.log(`Suppression message ${data.messageId}`);
    const receiverSocketId = onlineUsers.get(data.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('message_deleted', data);
    }
  });

  // Utilisateur hors ligne (manuel)
  socket.on('user_offline', (userId) => {
    onlineUsers.delete(userId);
    userGroups.delete(userId);
    
    socket.broadcast.emit('user_status_changed', {
      userId,
      isOnline: false,
    });
    
    console.log(`${userId} est maintenant hors ligne`);
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log(`Utilisateur déconnecté: ${socket.id}`);
    
    if (userId) {
      onlineUsers.delete(userId);
      userGroups.delete(userId);
      
      socket.broadcast.emit('user_status_changed', {
        userId,
        isOnline: false,
      });
      
      console.log(`${userId} est maintenant hors ligne (déconnexion)`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur Socket.io démarré sur le port ${PORT}`);
  console.log(`URL: http://localhost:${PORT}`);
});