// components/ChatList.tsx

import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, TextInput, 
  ScrollView, Image, Modal, Alert
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { db } from '../services/database';
import { RoomType } from '../types';

const ChatList = ({ 
  me, 
  onNavigate,           // Pour ouvrir un groupe (ChatRoomView)
  onOpenPrivateChat,    // Pour ouvrir un chat privé (ChatPrivateView)
  onToggleDarkMode, 
  isDarkMode 
}) => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [privateChats, setPrivateChats] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'PRIVATE' | 'GROUPS' | 'DISCOVER'>('PRIVATE');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState(RoomType.PUBLIC);

  // Récupérer groupes + conversations privées
  const fetchData = () => {
    try {
      // 1. Groupes
      const allRooms = db.getAllSync('SELECT * FROM groups ORDER BY lastUpdate DESC');
      const roomsWithMembers = allRooms.map(room => {
        const members = db.getAllSync('SELECT user_id FROM group_members WHERE group_id = ?', [room.id])
                          .map(m => m.user_id);
        return { ...room, members, type: 'group' };
      });
      setRooms(roomsWithMembers);

      // 2. Conversations privées
      const lastTimestamps = db.getAllSync(`
        SELECT 
          CASE 
            WHEN sender_id = ? THEN receiver_id 
            ELSE sender_id 
          END AS other_user_id,
          MAX(timestamp) AS max_timestamp
        FROM private_messages
        WHERE sender_id = ? OR receiver_id = ?
        GROUP BY other_user_id
      `, [me.id, me.id, me.id]);

      const privateChatsWithUser = lastTimestamps.map(conv => {
        const lastMessageRow = db.getFirstSync(`
          SELECT content
          FROM private_messages
          WHERE timestamp = ?
            AND (
              (sender_id = ? AND receiver_id = ?) OR
              (sender_id = ? AND receiver_id = ?)
            )
          LIMIT 1
        `, [conv.max_timestamp, me.id, conv.other_user_id, conv.other_user_id, me.id]);

        const otherUser = db.getFirstSync('SELECT id, username, avatar, is_online FROM users WHERE id = ?', [conv.other_user_id]);

        if (!otherUser) return null;

        return {
          id: otherUser.id,
          username: otherUser.username,
          avatar: otherUser.avatar,
          is_online: otherUser.is_online,
          type: 'private',
          lastMessage: lastMessageRow?.content || 'Démarrez la conversation',
          lastTimestamp: conv.max_timestamp,
        };
      }).filter(Boolean);

      privateChatsWithUser.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
      setPrivateChats(privateChatsWithUser);
    } catch (error) {
      console.error('Erreur récupération données:', error);
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
    !room.members.includes(me.id) && 
    room.is_private === 0
  );

  // Créer un groupe
  const handleCreateRoom = () => {
    if (!newRoomName.trim()) return;

    try {
      db.runSync(
        'INSERT INTO groups (name, avatar, is_private, created_by, lastUpdate) VALUES (?, ?, ?, ?, ?)',
        [
          newRoomName,
          `https://picsum.photos/seed/${newRoomName}/200`,
          newRoomType === RoomType.PRIVATE ? 1 : 0,
          me.id,
          Date.now()
        ]
      );

      const lastId = db.getFirstSync('SELECT id FROM groups ORDER BY ROWID DESC LIMIT 1').id;
      db.runSync('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [lastId, me.id, 'admin']);

      fetchData();
      setIsModalOpen(false);
      setNewRoomName('');
    } catch (error) {
      console.error('Erreur création groupe:', error);
      Alert.alert('Erreur', 'Impossible de créer le groupe.');
    }
  };

  // Rejoindre un groupe public
  const handleJoinRoom = (room) => {
    try {
      const alreadyMember = db.getFirstSync('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [room.id, me.id]);
      if (!alreadyMember) {
        db.runSync('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [room.id, me.id, 'member']);
        Alert.alert('Succès', `Vous avez rejoint "${room.name}"`);
        fetchData();
      } else {
        Alert.alert('Info', 'Vous êtes déjà membre de ce groupe');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de rejoindre le groupe');
    }
  };

  // Rendu item privé
  const renderPrivateItem = (chat) => {
    const time = chat.lastTimestamp 
      ? new Date(chat.lastTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <TouchableOpacity
        key={chat.id}
        onPress={() => onOpenPrivateChat(chat)}
        style={[styles.item, { backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}
      >
        <Image 
          source={{ uri: chat.avatar || `https://i.pravatar.cc/150?u=${chat.id}` }} 
          style={styles.avatar} 
        />
        <View style={styles.info}>
          <Text style={[styles.name, { color: isDarkMode ? '#fff' : '#1e293b' }]}>{chat.username}</Text>
          <Text style={styles.lastMsg} numberOfLines={1}>{chat.lastMessage}</Text>
        </View>
        {time ? <Text style={styles.time}>{time}</Text> : null}
      </TouchableOpacity>
    );
  };

  // Rendu item groupe
  const renderGroupItem = (room, isDiscover = false) => {
    const memberCount = room.members?.length || 0;

    return (
      <TouchableOpacity
        key={room.id}
        onPress={() => isDiscover ? handleJoinRoom(room) : onNavigate(room)}
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
          style={[styles.searchInput, { color: isDarkMode ? '#fff' : '#000' }]}
        />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {activeTab === 'PRIVATE' && (
          filteredPrivate.length > 0 
            ? filteredPrivate.map(renderPrivateItem)
            : <Text style={styles.empty}>Aucune conversation privée</Text>
        )}
        {activeTab === 'GROUPS' && filteredGroups.map(room => renderGroupItem(room))}
        {activeTab === 'DISCOVER' && (
          filteredDiscover.length > 0
            ? filteredDiscover.map(room => renderGroupItem(room, true))
            : <Text style={styles.empty}>Aucun groupe public disponible</Text>
        )}
      </ScrollView>

      {activeTab !== 'DISCOVER' && (
        <TouchableOpacity style={styles.fab} onPress={() => setIsModalOpen(true)}>
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal visible={isModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#000' }]}>Nouveau Groupe</Text>
            <TextInput
              placeholder="Nom du groupe"
              value={newRoomName}
              onChangeText={setNewRoomName}
              style={[styles.input, { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', color: isDarkMode ? '#fff' : '#000' }]}
            />
            <View style={styles.typeRow}>
              <TouchableOpacity
                onPress={() => setNewRoomType(RoomType.PUBLIC)}
                style={[styles.typeBtn, newRoomType === RoomType.PUBLIC && styles.typeActive]}
              >
                <Ionicons name="globe-outline" size={24} color={newRoomType === RoomType.PUBLIC ? '#2563eb' : '#94a3b8'} />
                <Text style={styles.typeText}>Public</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setNewRoomType(RoomType.PRIVATE)}
                style={[styles.typeBtn, newRoomType === RoomType.PRIVATE && styles.typeActive]}
              >
                <Ionicons name="lock-closed-outline" size={24} color={newRoomType === RoomType.PRIVATE ? '#2563eb' : '#94a3b8'} />
                <Text style={styles.typeText}>Privé</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setIsModalOpen(false)} style={styles.cancel}>
                <Text style={{ color: isDarkMode ? '#fff' : '#000' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateRoom} style={styles.create}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Créer</Text>
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
  lock: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#2563eb', borderRadius: 10, padding: 4, borderWidth: 2, borderColor: '#fff' },
  info: { flex: 1, marginLeft: 15 },
  name: { fontSize: 16, fontWeight: 'bold' },
  lastMsg: { fontSize: 13, color: '#64748b', marginTop: 4 },
  time: { fontSize: 12, color: '#94a3b8', alignSelf: 'flex-start' },
  joinBtn: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  joinText: { color: '#fff', fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 30, right: 25, backgroundColor: '#2563eb', width: 65, height: 65, borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  empty: { textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', padding: 50 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal: { width: '90%', borderRadius: 30, padding: 25 },
  modalTitle: { fontSize: 22, fontWeight: '900', marginBottom: 20, textAlign: 'center' },
  input: { borderRadius: 15, padding: 15, marginBottom: 20 },
  typeRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 30 },
  typeBtn: { alignItems: 'center' },
  typeActive: { backgroundColor: 'rgba(37,99,235,0.1)', padding: 15, borderRadius: 20 },
  typeText: { marginTop: 8, fontSize: 14 },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between' },
  cancel: { padding: 15 },
  create: { backgroundColor: '#2563eb', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 15 }
});

export default ChatList;