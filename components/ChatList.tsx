import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, TextInput, 
  ScrollView, Image, Modal, Alert
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { RoomType } from '../types';
import socketService from '../services/socketService';
import { getUserGroups, createGroup, getAllUsers, getPrivateChats, getPrivateMessages } from '../services/api';

const ChatList = ({ 
  me, 
  onNavigate,           
  onOpenPrivateChat,    
  onToggleDarkMode, 
  isDarkMode 
}) => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [privateChats, setPrivateChats] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'PRIVATE' | 'GROUPS' | 'DISCOVER'>('PRIVATE');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState(RoomType.PUBLIC);
  const [loading, setLoading] = useState(false);

  // Écouter les nouveaux messages pour mettre à jour la liste
  useEffect(() => {
    // Écouter les messages privés
    socketService.onPrivateMessage((message) => {
      console.log('📩 Nouveau message privé reçu dans la liste:', message);
      fetchData();
    });

    // Écouter les messages de groupe
    socketService.onGroupMessage((message) => {
      console.log('📩 Nouveau message de groupe reçu dans la liste:', message);
      fetchData();
    });

    // Écouter les changements de statut en ligne
    socketService.onUserStatusChange((data) => {
      console.log('👤 Statut utilisateur changé:', data);
      fetchData();
    });

    return () => {
      // Socket.io est un singleton, pas besoin de nettoyer
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Récupérer les groupes de l'utilisateur
      const groupsResponse = await getUserGroups(me.id);
      if (groupsResponse.success) {
        // Récupérer les membres pour chaque groupe
        const roomsWithMembers = await Promise.all(
          groupsResponse.groups.map(async (room) => {
            try {
              const membersResponse = await fetch(`http://10.120.62.243:3000/api/groups/${room.id}/members`);
              const membersData = await membersResponse.json();
              
              if (membersData.success) {
                const memberIds = membersData.members.map((m: any) => m.id);
                const isAdmin = membersData.members.some((m: any) => m.id === me.id && m.role === 'admin');
                
                return {
                  ...room,
                  members: memberIds,
                  isAdmin
                };
              }
              return { ...room, members: [], isAdmin: false };
            } catch (error) {
              console.error('Erreur récupération membres:', error);
              return { ...room, members: [], isAdmin: false };
            }
          })
        );
        
        setRooms(roomsWithMembers);
      }

      // 2. Récupérer tous les utilisateurs pour les conversations privées
      const usersResponse = await getAllUsers();
      if (usersResponse.success) {
        setAllUsers(usersResponse.users);
      }

      // 3. Récupérer les conversations privées
      const chatsResponse = await getPrivateChats(me.id);
      if (chatsResponse.success) {
        const privateChatsWithUser = await Promise.all(
          chatsResponse.conversations.map(async (conv) => {
            const otherUser = usersResponse.users.find((u: any) => u.id === conv.other_user_id);
            
            if (!otherUser) return null;

            // Récupérer le dernier message
            try {
              const messagesResponse = await getPrivateMessages(me.id, conv.other_user_id);
              const messages = messagesResponse.messages || [];
              const lastMessage = messages[messages.length - 1];

              const isMyMessage = lastMessage?.senderId === me.id;
              const messagePrefix = isMyMessage ? 'Vous: ' : '';

              return {
                id: otherUser.id,
                username: otherUser.username,
                avatar: otherUser.avatar,
                is_online: otherUser.is_online,
                type: 'private',
                lastMessage: lastMessage?.content 
                  ? `${messagePrefix}${lastMessage.content}` 
                  : 'Démarrez la conversation',
                lastTimestamp: conv.max_timestamp,
              };
            } catch (error) {
              console.error('Erreur récupération messages:', error);
              return {
                id: otherUser.id,
                username: otherUser.username,
                avatar: otherUser.avatar,
                is_online: otherUser.is_online,
                type: 'private',
                lastMessage: 'Démarrez la conversation',
                lastTimestamp: conv.max_timestamp,
              };
            }
          })
        );

        const filtered = privateChatsWithUser.filter(Boolean);
        filtered.sort((a: any, b: any) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
        setPrivateChats(filtered);
      }
    } catch (error) {
      console.error('Erreur récupération données:', error);
      Alert.alert('Erreur', 'Impossible de charger les données. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [me.id]);

  // Filtrage
  const filteredPrivate = privateChats.filter(chat =>
    chat.username.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGroups = rooms.filter(room =>
    room.name.toLowerCase().includes(search.toLowerCase()) && 
    room.members.includes(me.id)
  );

  const filteredDiscover = rooms.filter(room =>
    room.name.toLowerCase().includes(search.toLowerCase()) && 
    room.is_private === 0
  );

  // Supprimer une conversation privée
  const handleLongPressPrivate = (chat) => {
    Alert.alert(
      "Supprimer la conversation",
      `Voulez-vous supprimer toute la conversation avec ${chat.username} ? Cette action est irréversible.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              // Supprimer via API
              const messagesResponse = await getPrivateMessages(me.id, chat.id);
              const messages = messagesResponse.messages || [];
              
              for (const msg of messages) {
                await fetch('http://10.120.62.243:3000/api/private-messages/delete-local', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: me.id, messageId: msg.id })
                });
              }
              
              fetchData();
              Alert.alert('Supprimée', `Conversation avec ${chat.username} supprimée`);
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer la conversation');
            }
          }
        }
      ]
    );
  };

  // Quitter/Supprimer un groupe
  const handleLongPressGroup = (room) => {
    const options = [
      { text: "Annuler", style: "cancel" },
      {
        text: "Quitter le groupe",
        style: "default",
        onPress: async () => {
          try {
            await fetch(`http://10.120.62.243:3000/api/groups/${room.id}/members/${me.id}`, {
              method: 'DELETE'
            });
            
            socketService.leaveGroup(room.id);
            fetchData();
            Alert.alert('Quitter', `Vous avez quitté "${room.name}"`);
          } catch (error) {
            Alert.alert('Erreur', 'Impossible de quitter le groupe');
          }
        }
      }
    ];

    if (room.isAdmin) {
      options.splice(1, 0, {
        text: "Supprimer le groupe",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Supprimer le groupe",
            "Cette action est irréversible et supprimera le groupe pour tous les membres.",
            [
              { text: "Annuler", style: "cancel" },
              {
                text: "Supprimer définitivement",
                style: "destructive",
                onPress: async () => {
                  try {
                    await fetch(`http://10.120.62.243:3000/api/groups/${room.id}`, {
                      method: 'DELETE'
                    });
                    
                    socketService.leaveGroup(room.id);
                    fetchData();
                    Alert.alert('Supprimé', `Le groupe "${room.name}" a été supprimé`);
                  } catch (error) {
                    Alert.alert('Erreur', 'Impossible de supprimer le groupe');
                  }
                }
              }
            ]
          );
        }
      });
    }

    Alert.alert(room.name, "Que voulez-vous faire ?", options);
  };

  // Créer un groupe
  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom de groupe');
      return;
    }

    try {
      const response = await createGroup(
        newRoomName.trim(),
        me.id,
        newRoomType === RoomType.PRIVATE
      );

      if (response.success) {
        // Rejoindre le groupe Socket.io automatiquement
        socketService.joinGroup(response.group.id);
        console.log(`Groupe créé et rejoint: ${response.group.id}`);

        fetchData();
        setIsModalOpen(false);
        setNewRoomName('');
        Alert.alert('Succès', 'Groupe créé avec succès!');
      }
    } catch (error) {
      console.error('Erreur création groupe:', error);
      Alert.alert('Erreur', 'Impossible de créer le groupe.');
    }
  };

  // Rejoindre un groupe public
  const handleJoinRoom = async (room) => {
    try {
      const response = await fetch(`http://10.120.62.243:3000/api/groups/${room.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: me.id, role: 'member' })
      });

      if (response.ok) {
        socketService.joinGroup(room.id);
        console.log(`Groupe rejoint: ${room.id}`);
        
        Alert.alert('Succès', `Vous avez rejoint "${room.name}"`);
        fetchData();
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de rejoindre le groupe');
    }
  };

  // Rendu conversation privée
  const renderPrivateItem = (chat) => {
    const time = chat.lastTimestamp 
      ? new Date(chat.lastTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <TouchableOpacity
        key={chat.id}
        onPress={() => onOpenPrivateChat(chat)}
        onLongPress={() => handleLongPressPrivate(chat)}
        delayLongPress={600}
        style={[styles.item, { backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}
      >
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: chat.avatar || `https://i.pravatar.cc/150?u=${chat.id}` }} 
            style={styles.avatar} 
          />
          {chat.is_online === 1 && (
            <View style={styles.onlineIndicator} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: isDarkMode ? '#fff' : '#1e293b' }]}>
            {chat.username}
          </Text>
          <Text style={styles.lastMsg} numberOfLines={1}>{chat.lastMessage}</Text>
        </View>
        {time ? <Text style={styles.time}>{time}</Text> : null}
      </TouchableOpacity>
    );
  };

  // Rendu groupe
  const renderGroupItem = (room, isDiscover = false) => {
    const memberCount = room.members?.length || 0;

    return (
      <TouchableOpacity
        key={room.id}
        onPress={() => isDiscover ? handleJoinRoom(room) : onNavigate(room)}
        onLongPress={() => !isDiscover && handleLongPressGroup(room)}
        delayLongPress={600}
        style={[styles.item, { backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}
      >
        <View style={styles.avatarContainer}>
          <Image source={{ uri: room.avatar || `https://ui-avatars.com/api/?name=${room.name}` }} style={styles.avatar} />
          {room.is_private === 1 && <View style={styles.lock}><Ionicons name="lock-closed" size={10} color="#fff" /></View>}
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: isDarkMode ? '#fff' : '#1e293b' }]}>{room.name}</Text>
          <Text style={styles.lastMsg}>
            {isDiscover ? `Rejoindre • ${memberCount} membres` : `${memberCount} membres`}
          </Text>
        </View>
        {isDiscover && (
          <View style={styles.joinBtn}>
            <Text style={styles.joinText}>Rejoindre</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#000' }]}>Messages</Text>
        <TouchableOpacity onPress={onToggleDarkMode} style={styles.themeBtn}>
          <Ionicons name={isDarkMode ? "sunny" : "moon"} size={20} color={isDarkMode ? "#eab308" : "#64748b"} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(['PRIVATE', 'GROUPS', 'DISCOVER'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
          >
            <Text style={{ color: activeTab === tab ? '#fff' : '#64748b', fontWeight: 'bold' }}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.search}>
        <Feather name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          placeholder="Rechercher..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          style={[styles.searchInput, { color: isDarkMode ? '#fff' : '#000'  }]}
        />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {loading && (
          <Text style={styles.empty}>Chargement...</Text>
        )}
        
        {!loading && activeTab === 'PRIVATE' && (
          filteredPrivate.length > 0 
            ? filteredPrivate.map(renderPrivateItem)
            : <Text style={styles.empty}>Aucune conversation privée</Text>
        )}
        
        {!loading && activeTab === 'GROUPS' && (
          filteredGroups.length > 0
            ? filteredGroups.map(room => renderGroupItem(room))
            : <Text style={styles.empty}>Aucun groupe</Text>
        )}
        
        {!loading && activeTab === 'DISCOVER' && (
          filteredDiscover.length > 0
            ? filteredDiscover.map(room => renderGroupItem(room, true))
            : <Text style={styles.empty}>Aucun groupe public disponible</Text>
        )}
      </ScrollView>

      {activeTab !== 'DISCOVER' && (
        <TouchableOpacity 
          style={styles.fab} 
          onPress={() => {
            console.log('🔵 Bouton FAB pressé, ouverture modal');
            setIsModalOpen(true);
          }}
        >
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal création groupe */}
      <Modal 
        visible={isModalOpen} 
        transparent 
        animationType="fade"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
              Nouveau {activeTab === 'PRIVATE' ? 'Chat' : 'Groupe'}
            </Text>
            
            <TextInput
              placeholder="Nom du groupe"
              placeholderTextColor="#94a3b8"
              value={newRoomName}
              onChangeText={setNewRoomName}
              style={[
                styles.input, 
                { 
                  backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9',
                  color: isDarkMode ? '#fff' : '#000'
                }
              ]}
            />

            <View style={styles.typeRow}>
              <TouchableOpacity 
                onPress={() => setNewRoomType(RoomType.PUBLIC)}
                style={[styles.typeBtn, newRoomType === RoomType.PUBLIC && styles.typeActive]}
              >
                <Ionicons 
                  name="globe-outline" 
                  size={32} 
                  color={newRoomType === RoomType.PUBLIC ? '#2563eb' : '#94a3b8'} 
                />
                <Text style={[
                  styles.typeText,
                  { color: newRoomType === RoomType.PUBLIC ? '#2563eb' : '#94a3b8' }
                ]}>
                  Public
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setNewRoomType(RoomType.PRIVATE)}
                style={[styles.typeBtn, newRoomType === RoomType.PRIVATE && styles.typeActive]}
              >
                <Ionicons 
                  name="lock-closed-outline" 
                  size={32} 
                  color={newRoomType === RoomType.PRIVATE ? '#2563eb' : '#94a3b8'} 
                />
                <Text style={[
                  styles.typeText,
                  { color: newRoomType === RoomType.PRIVATE ? '#2563eb' : '#94a3b8' }
                ]}>
                  Privé
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity 
                onPress={() => {
                  setIsModalOpen(false);
                  setNewRoomName('');
                }} 
                style={styles.cancel}
              >
                <Text style={{ color: '#94a3b8', fontSize: 16 }}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleCreateRoom} style={styles.create}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: '900' },
  themeBtn: { padding: 10, borderRadius: 20 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 15 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 15, backgroundColor: '#f1f5f9' },
  activeTab: { backgroundColor: '#2563eb' },
  search: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 15, backgroundColor: '#fff', borderRadius: 15, elevation: 1 },
  searchIcon: { position: 'absolute', left: 15, zIndex: 1 },
  searchInput: { flex: 1, paddingLeft: 45, paddingVertical: 12, fontSize: 16 },
  list: { paddingHorizontal: 15, paddingBottom: 100 },
  item: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 25, marginBottom: 10, elevation: 1 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    borderWidth: 3,
    borderColor: '#fff'
  },
  lock: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#2563eb', borderRadius: 10, padding: 4, borderWidth: 2, borderColor: '#fff' },
  info: { flex: 1, marginLeft: 15 },
  name: { fontSize: 16, fontWeight: 'bold' },
  lastMsg: { fontSize: 13, color: '#64748b', marginTop: 4 },
  time: { fontSize: 12, color: '#94a3b8', alignSelf: 'flex-start' },
  joinBtn: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  joinText: { color: '#fff', fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 30, right: 25, backgroundColor: '#2563eb', width: 65, height: 65, borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  empty: { textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', padding: 50 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal: { width: '90%', borderRadius: 30, padding: 25 },
  modalTitle: { fontSize: 22, fontWeight: '900', marginBottom: 20, textAlign: 'center' },
  input: { borderRadius: 15, padding: 15, marginBottom: 20, fontSize: 16 },
  typeRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 30 },
  typeBtn: { alignItems: 'center' },
  typeActive: { backgroundColor: 'rgba(37,99,235,0.1)', padding: 15, borderRadius: 20 },
  typeText: { marginTop: 8, fontSize: 14, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between' },
  cancel: { padding: 15 },
  create: { backgroundColor: '#2563eb', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 15 }
});

export default ChatList;