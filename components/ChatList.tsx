import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Image, Modal, Alert
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { createGroup, getAllUsers, getPrivateChats, getPrivateMessages, getUnreadCounts, getUserGroups } from '../services/api';
import { API_URL } from '../config/api';
import socketService from '../services/socketService';

const RoomType = {
  PUBLIC: 'public',
  PRIVATE: 'private'
};

const ChatList = ({ me, onNavigate, onOpenPrivateChat, onToggleDarkMode, isDarkMode }) => {
  const [rooms, setRooms] = useState([]);
  const [privateChats, setPrivateChats] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [publicGroups, setPublicGroups] = useState([]);
  const [activeTab, setActiveTab] = useState('PRIVATE');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState(RoomType.PUBLIC);
  const [loading, setLoading] = useState(false);

  // 🔹 FONCTION DE RÉCUPÉRATION DE DONNÉES
  const fetchData = async () => {
    setLoading(true);
    try {
      const groupsResponse = await getUserGroups(me.id);
      if (groupsResponse.success) {
        const roomsWithMembers = await Promise.all(
          groupsResponse.groups.map(async (room) => {
            try {
              const membersResponse = await fetch(`${API_URL}/groups/${room.id}/members`);
              const membersData = await membersResponse.json();
              if (membersData.success) {
                const memberIds = membersData.members.map((m) => m.id);
                const isAdmin = membersData.members.some((m) => m.id === me.id && m.role === 'admin');
                return { ...room, members: memberIds, isAdmin };
              }
              return { ...room, members: [], isAdmin: false };
            } catch {
              return { ...room, members: [], isAdmin: false };
            }
          })
        );
        setRooms(roomsWithMembers);
      }

      const usersResponse = await getAllUsers();
      if (usersResponse.success) setAllUsers(usersResponse.users);

      const chatsResponse = await getPrivateChats(me.id);
      if (chatsResponse.success) {
        const privateChatsWithUser = await Promise.all(
          chatsResponse.conversations.map(async (conv) => {
            const otherUser = usersResponse.users.find((u) => u.id === conv.other_user_id);
            if (!otherUser) return null;

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
              lastMessage: lastMessage?.content ? `${messagePrefix}${lastMessage.content}` : 'Démarrez la conversation',
              lastTimestamp: conv.max_timestamp,
              unreadCount: 0, // Sera mis à jour par fetchUnreadCounts
            };
          })
        );

        const filtered = privateChatsWithUser.filter(Boolean);
        filtered.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
        setPrivateChats(filtered);
      }

      // ✅ Récupérer les comptages APRÈS avoir créé les chats
      await fetchUnreadCounts();

      const publicRes = await fetch(`${API_URL}/groupes`);
      if (publicRes.ok) {
        const data = await publicRes.json();
        if (data.success) setPublicGroups(data.groups);
      }
    } catch (error) {
      console.error('❌ Erreur fetchData:', error);
      Alert.alert('Erreur', 'Impossible de charger les données.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FONCTION: Récupérer le comptage des messages non lus depuis la BDD
  const fetchUnreadCounts = async () => {
    try {
      console.log('🔄 Récupération des messages non lus pour:', me.id);
      const response = await getUnreadCounts(me.id);
      
      if (response && response.counts && Array.isArray(response.counts)) {
        console.log('📊 Comptages reçus:', response.counts);
        
        setPrivateChats(prev => prev.map(chat => {
          const unreadData = response.counts.find(c => c.sender_id === chat.id);
          const unreadCount = unreadData ? parseInt(unreadData.unread_count, 10) : 0;
          
          console.log(`👤 ${chat.username} (${chat.id}): ${unreadCount} messages non lus`);
          
          return {
            ...chat,
            unreadCount: unreadCount
          };
        }));
      } else {
        console.warn('⚠️ Aucun comptage reçu ou format invalide');
      }
    } catch (error) {
      console.error('❌ Erreur fetchUnreadCounts:', error);
    }
  };

  // ✅ FONCTION: Ouvrir un chat et marquer TOUS ses messages comme lus
  const handleOpenPrivateChat = async (chat) => {
    console.log('📂 Ouverture du chat avec:', chat.username);
    
    // 1️⃣ Ouvrir la conversation
    onOpenPrivateChat(chat);

    // 2️⃣ Mise à jour locale immédiate du badge
    setPrivateChats(prev => prev.map(c => {
      if (c.id === chat.id) {
        console.log(`✅ Badge supprimé pour ${c.username}`);
        return { ...c, unreadCount: 0 };
      }
      return c;
    }));

    // 3️⃣ Marquer TOUS les messages de cet expéditeur comme lus dans la BDD
    try {
      console.log('📝 Marquage comme lu dans la BDD:', {
        senderId: chat.id,
        receiverId: me.id
      });

      const response = await fetch(`${API_URL}/messages/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: chat.id,
          receiverId: me.id
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log(`✅ ${result.markedCount} messages marqués comme lus dans la BDD`);
      } else {
        console.error('❌ Erreur lors du marquage:', result);
      }
    } catch (error) {
      console.error('❌ Erreur handleOpenPrivateChat:', error);
    }
  };

  const fetchPublicGroups = async () => {
    try {
      const res = await fetch(`${API_URL}/groupes`);
      if (!res.ok) {
        console.error('Erreur HTTP:', res.status);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setPublicGroups(data.groups);
      }
    } catch (error) {
      console.error('❌ Impossible de récupérer les groupes publics:', error);
    }
  };

  // ✅ Polling automatique des messages non lus toutes les 3 secondes
  useEffect(() => {
    let intervalDiscover;
    let intervalUnread;

    if (activeTab === 'DISCOVER') {
      intervalDiscover = setInterval(() => {
        fetchPublicGroups();
      }, 3000);
    }

    // ✅ Vérifier les messages non lus toutes les 3 secondes
    if (activeTab === 'PRIVATE') {
      intervalUnread = setInterval(() => {
        console.log('🔄 Polling automatique des messages non lus...');
        fetchUnreadCounts();
      }, 3000);
    }

    return () => {
      if (intervalDiscover) clearInterval(intervalDiscover);
      if (intervalUnread) clearInterval(intervalUnread);
    };
  }, [activeTab, me.id]);

  // 🔹 INIT ET SOCKET.IO
  useEffect(() => {
    fetchData();

    if (!socketService.isConnected()) socketService.connect(me.id);

    const handleNewPublicGroup = (group) => {
      setPublicGroups(prev => [...prev.filter(g => g.id !== group.id), group]);
    };

    // ✅ Quand un nouveau message arrive, recharger les comptages depuis la BDD
    const handlePrivateMessage = (message) => {
      console.log('📨 Nouveau message reçu:', message);
      
      // Si le message n'est pas de moi, mettre à jour le dernier message
      if (message.senderId !== me.id) {
        setPrivateChats(prev => prev.map(chat => {
          if (chat.id === message.senderId) {
            return {
              ...chat,
              lastMessage: message.content,
              lastTimestamp: Date.now() / 1000
            };
          }
          return chat;
        }));
        
        // ✅ Recharger les comptages depuis la BDD
        fetchUnreadCounts();
      }
    };

    const handleGroupMessage = () => {
      // Optionnel: recharger les données des groupes
    };

    const handleUserStatus = () => {
      // Optionnel: mettre à jour le statut en ligne
    };

    socketService.onNewPublicGroup(handleNewPublicGroup);
    socketService.onPrivateMessage(handlePrivateMessage);
    socketService.onGroupMessage(handleGroupMessage);
    socketService.onUserStatusChange(handleUserStatus);

    return () => {
      socketService.offNewPublicGroup(handleNewPublicGroup);
      socketService.offPrivateMessage();
      socketService.offGroupMessage();
      socketService.offUserStatusChange();
    };
  }, [me.id]);

  // 🔹 FILTRAGE
  const filteredPrivate = privateChats.filter(chat =>
    chat.username.toLowerCase().includes(search.toLowerCase())
  );
  const filteredGroups = rooms.filter(room =>
    room.name.toLowerCase().includes(search.toLowerCase()) && room.members.includes(me.id)
  );
  const filteredDiscover = publicGroups.filter(room =>
    room.name.toLowerCase().includes(search.toLowerCase())
  );

  // 🔹 HANDLERS
  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return Alert.alert('Erreur', 'Veuillez entrer un nom de groupe');
    try {
      const response = await createGroup(newRoomName.trim(), me.id, newRoomType === RoomType.PRIVATE);
      if (response.success) {
        socketService.joinGroup(response.group.id);
        setPublicGroups(prev => [...prev, response.group]);
        fetchData();
        setIsModalOpen(false);
        setNewRoomName('');
        Alert.alert('Succès', 'Groupe créé !');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de créer le groupe.');
    }
  };

  const handleJoinRoom = async (room) => {
    try {
      const res = await fetch(`${API_URL}/groups/${room.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: me.id, role: 'member' })
      });
      if (res.ok) {
        socketService.joinGroup(room.id);
        fetchData();
        Alert.alert('Succès', `Vous avez rejoint "${room.name}"`);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de rejoindre le groupe.');
    }
  };

  // 🔹 RENDUS
  const renderPrivateItem = (chat) => {
    return (
      <TouchableOpacity
        key={chat.id}
        onPress={() => handleOpenPrivateChat(chat)}
        style={[styles.item, { backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}
      >
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: chat.avatar || `https://i.pravatar.cc/150?u=${chat.id}` }}
            style={styles.avatar}
          />
          {chat.is_online === 1 && <View style={styles.onlineIndicator} />}
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: isDarkMode ? '#fff' : '#1e293b' }]}>
            {chat.username}
          </Text>
          <Text style={styles.lastMsg} numberOfLines={1}>
            {chat.lastMessage}
          </Text>
        </View>

        {/* ✅ Badge basé sur is_read de la table private_messages */}
        {chat.unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderGroupItem = (room, isDiscover = false) => {
    const memberCount = room.members?.length || 0;
    return (
      <TouchableOpacity
        key={room.id}
        onPress={() => isDiscover ? handleJoinRoom(room) : onNavigate(room)}
        style={[styles.item, { backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}
      >
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: room.avatar || `https://ui-avatars.com/api/?name=${room.name}` }}
            style={styles.avatar}
          />
          {room.is_private === 1 && (
            <View style={styles.lock}>
              <Ionicons name="lock-closed" size={10} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: isDarkMode ? '#fff' : '#1e293b' }]}>
            {room.name}
          </Text>
          <Text style={styles.lastMsg}>
            {isDiscover ? 'Description' : `${memberCount} membres`}
          </Text>
        </View>
        {isDiscover && (
          <TouchableOpacity
            onPress={() => handleJoinRoom(room)}
            style={styles.joinButton}
          >
            <Text style={styles.joinButtonText}>Rejoindre</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#000' }]}>Messages</Text>
        <TouchableOpacity onPress={onToggleDarkMode}>
          <Ionicons
            name={isDarkMode ? 'sunny' : 'moon'}
            size={20}
            color={isDarkMode ? '#eab308' : '#64748b'}
          />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['PRIVATE', 'GROUPS', 'DISCOVER']).map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
          >
            <Text style={{
              color: activeTab === tab ? '#fff' : '#64748b',
              fontWeight: 'bold'
            }}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={styles.search}>
        <Feather name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          placeholder="Rechercher..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          style={[styles.searchInput, { color: isDarkMode ? '#fff' : '#000' }]}
        />
      </View>

      {/* Listes */}
      <ScrollView contentContainerStyle={styles.list}>
        {loading && <Text style={styles.empty}>Chargement...</Text>}
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

      {/* FAB + Modal */}
      <TouchableOpacity style={styles.fab} onPress={() => setIsModalOpen(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40
  },
  title: { fontSize: 28, fontWeight: '900' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 15
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 15,
    backgroundColor: '#f1f5f9'
  },
  activeTab: { backgroundColor: '#2563eb' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 15,
    backgroundColor: '#fff',
    borderRadius: 15,
    elevation: 1
  },
  searchIcon: { position: 'absolute', left: 15, zIndex: 1 },
  searchInput: {
    flex: 1,
    paddingLeft: 45,
    paddingVertical: 12,
    fontSize: 16
  },
  list: { paddingHorizontal: 15, paddingBottom: 100 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 25,
    marginBottom: 10,
    elevation: 1
  },
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
  lock: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    padding: 4,
    borderWidth: 2,
    borderColor: '#fff'
  },
  info: { flex: 1, marginLeft: 15 },
  name: { fontSize: 16, fontWeight: 'bold' },
  lastMsg: { fontSize: 13, color: '#64748b', marginTop: 4 },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    fontStyle: 'italic',
    padding: 50
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#2563eb',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modal: { width: '90%', borderRadius: 30, padding: 25 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  input: {
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    fontSize: 16
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30
  },
  typeBtn: { alignItems: 'center' },
  typeActive: {
    backgroundColor: 'rgba(37,99,235,0.1)',
    padding: 15,
    borderRadius: 20
  },
  typeText: { marginTop: 8, fontSize: 14, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between' },
  cancel: { padding: 15 },
  create: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 15
  },
  joinButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  }
});

export default ChatList;