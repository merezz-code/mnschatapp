import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, TextInput, 
  ScrollView, Image, Modal, Alert
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { db } from '../services/database';
import { RoomType } from '../types';

const ChatList = ({ me, onNavigate, onToggleDarkMode, isDarkMode }) => {
  const [rooms, setRooms] = useState([]);
  const [activeTab, setActiveTab] = useState('PRIVATE');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState(RoomType.PUBLIC);

  // --- Récupère les salons et ajoute la liste des membres pour chaque salon
  const fetchRooms = () => {
    try {
      const allRooms = db.getAllSync('SELECT * FROM groups ORDER BY lastUpdate DESC');
      const roomsWithMembers = allRooms.map(room => {
        const members = db.getAllSync('SELECT user_id FROM group_members WHERE group_id = ?', [room.id])
                          .map(m => m.user_id);
        return { ...room, members };
      });
      setRooms(roomsWithMembers);
    } catch (error) {
      console.error('Erreur récupération salons:', error);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  // --- Filtrage par onglet
  const privateRooms = rooms.filter(r => r.is_private === 1 && r.members.includes(me.id));
  const groupRooms   = rooms.filter(r => r.members.includes(me.id));
  const discoverRooms = rooms.filter(r => r.is_private === 0 && !r.members.includes(me.id));

  // --- Créer un salon
  const handleCreateRoom = () => {
    if (!newRoomName.trim()) return;

    const room = {
      name: newRoomName,
      avatar: `https://picsum.photos/seed/${newRoomName}/200`,
      is_private: newRoomType === RoomType.PRIVATE ? 1 : 0,
      created_by: me.id,
      lastUpdate: Date.now()
    };

    try {
      // Insert dans groups
      db.runSync(
        'INSERT INTO groups (name, avatar, is_private, created_by, lastUpdate) VALUES (?, ?, ?, ?, ?)',
        [room.name, room.avatar, room.is_private, room.created_by, room.lastUpdate]
      );

      // Récupère l'id du dernier salon créé
      const lastId = db.getFirstSync('SELECT id FROM groups ORDER BY ROWID DESC LIMIT 1').id;

      // Ajoute le créateur comme membre
      db.runSync('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [lastId, me.id, 'admin']);

      fetchRooms(); // recharge les salons
      setIsModalOpen(false);
      setNewRoomName('');
    } catch (error) {
      console.error('Erreur création salon:', error);
      Alert.alert('Erreur', 'Impossible de créer le salon.');
    }
  };

  // --- Rejoindre un salon public
  const handleJoinRoom = (room) => {
    try {
      const member = db.getFirstSync(
        'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
        [room.id, me.id]
      );
      if (!member) {
        db.runSync(
          'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
          [room.id, me.id, 'member']
        );
        Alert.alert('Succès', `Vous avez rejoint "${room.name}"`);
        fetchRooms();
      } else {
        Alert.alert('Info', `Vous êtes déjà membre de "${room.name}"`);
      }
    } catch (error) {
      console.error('Erreur rejoindre salon:', error);
      Alert.alert('Erreur', 'Impossible de rejoindre le salon.');
    }
  };

  // --- Rendu d’un salon
  const renderRoomItem = (room, isDiscover = false) => {
    const memberCount = room.members?.length || 0;

    return (
      <TouchableOpacity
        key={room.id}
        onPress={() => isDiscover ? handleJoinRoom(room) : onNavigate(room)}
        style={[styles.roomItem, { backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}
      >
        <View style={styles.avatarContainer}>
          <Image source={{ uri: room.avatar || `https://ui-avatars.com/api/?name=${room.name}` }} style={styles.avatar} />
          {room.is_private === 1 && (
            <View style={styles.lockBadge}><Ionicons name="lock-closed" size={10} color="white" /></View>
          )}
        </View>

        <View style={styles.roomInfo}>
          <Text style={[styles.roomName, { color: isDarkMode ? '#fff' : '#1e293b' }]} numberOfLines={1}>
            {room.name}
          </Text>
          <Text style={styles.lastMsg} numberOfLines={1}>
            {isDiscover ? `Rejoindre ${memberCount} membres` : 'Démarrer une conversation'}
          </Text>
        </View>

        {isDiscover && (
          <TouchableOpacity style={styles.joinBtn} onPress={() => handleJoinRoom(room)}>
            <Text style={styles.joinBtnText}>Rejoindre</Text>
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
        <TouchableOpacity onPress={onToggleDarkMode} style={styles.iconBtn}>
          <Ionicons name={isDarkMode ? "sunny" : "moon"} size={20} color={isDarkMode ? "#eab308" : "#64748b"} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['PRIVATE','GROUPS','DISCOVER'].map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.activeTab, { backgroundColor: activeTab === tab ? '#2563eb' : '#fff' }]}
          >
            <Text style={{ color: activeTab === tab ? '#fff' : '#64748b', fontWeight: 'bold' }}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
        <TextInput 
          style={[styles.searchInput, { backgroundColor: isDarkMode ? '#1e293b' : '#fff', color: isDarkMode ? '#fff' : '#000' }]}
          placeholder="Rechercher..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Liste des salons */}
      <ScrollView contentContainerStyle={styles.scrollList}>
        {activeTab === 'PRIVATE' && privateRooms.map(r => renderRoomItem(r))}
        {activeTab === 'GROUPS' && groupRooms.map(r => renderRoomItem(r))}
        {activeTab === 'DISCOVER' && discoverRooms.map(r => renderRoomItem(r, true))}
      </ScrollView>

      {/* FAB */}
      {activeTab !== 'DISCOVER' && (
        <TouchableOpacity style={styles.fab} onPress={() => setIsModalOpen(true)}>
          <Ionicons name="add" size={32} color="white" />
        </TouchableOpacity>
      )}

      {/* Modal Création */}
      <Modal visible={isModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#000' }]}>Nouveau Salon</Text>
            <TextInput 
              style={[styles.modalInput, { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', color: isDarkMode ? '#fff' : '#000' }]}
              placeholder="Nom du salon"
              placeholderTextColor="#94a3b8"
              value={newRoomName}
              onChangeText={setNewRoomName}
            />

            <View style={styles.typeContainer}>
              <TouchableOpacity onPress={() => setNewRoomType(RoomType.PUBLIC)} style={[styles.typeBtn, newRoomType===RoomType.PUBLIC && styles.typeBtnActive]}>
                <Ionicons name="globe-outline" size={24} color={newRoomType===RoomType.PUBLIC?'#2563eb':'#94a3b8'} />
                <Text style={styles.typeBtnText}>Public</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setNewRoomType(RoomType.PRIVATE)} style={[styles.typeBtn, newRoomType===RoomType.PRIVATE && styles.typeBtnActive]}>
                <Ionicons name="lock-closed-outline" size={24} color={newRoomType===RoomType.PRIVATE?'#2563eb':'#94a3b8'} />
                <Text style={styles.typeBtnText}>Privé</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={() => setIsModalOpen(false)} style={styles.cancelBtn}>
                <Text style={{color:isDarkMode?'#fff':'#000'}}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateRoom} style={styles.createBtn}>
                <Text style={{color:'#fff', fontWeight:'bold'}}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// --- Styles (inchangés) ---
const styles = StyleSheet.create({
  container:{flex:1},
  header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:20,paddingTop:40},
  title:{fontSize:28,fontWeight:'900'},
  iconBtn:{borderRadius:20,padding:10},
  tabs:{flexDirection:'row',paddingHorizontal:20,gap:10,marginBottom:15},
  tab:{flex:1,alignItems:'center',paddingVertical:12,borderRadius:15},
  activeTab:{elevation:4,shadowColor:'#2563eb',shadowOpacity:0.2,shadowRadius:5},
  tabText:{fontSize:12,fontWeight:'bold'},
  searchContainer:{paddingHorizontal:20,marginBottom:15},
  searchInput:{borderRadius:15,paddingLeft:45,paddingRight:20,paddingVertical:12,height:50,elevation:1},
  searchIcon:{position:'absolute',left:35,top:15,zIndex:1},
  scrollList:{paddingHorizontal:15,paddingBottom:100},
  roomItem:{flexDirection:'row',alignItems:'center',padding:15,borderRadius:25,marginBottom:10,elevation:1},
  avatarContainer:{position:'relative'},
  avatar:{width:60,height:60,borderRadius:20},
  lockBadge:{position:'absolute',bottom:-2,right:-2,backgroundColor:'#2563eb',borderRadius:10,padding:3,borderWidth:2,borderColor:'#fff'},
  roomInfo:{flex:1,marginLeft:15},
  roomHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  roomName:{fontWeight:'bold',fontSize:16,maxWidth:'70%'},
  timeText:{fontSize:10,color:'#94a3b8'},
  lastMsg:{fontSize:13,color:'#64748b',marginTop:2},
  rightActions:{alignItems:'center',justifyContent:'center',minWidth:50},
  joinBtn:{backgroundColor:'#2563eb',paddingHorizontal:15,paddingVertical:8,borderRadius:12},
  joinBtnText:{color:'#fff',fontSize:12,fontWeight:'bold'},
  fab:{position:'absolute',bottom:30,right:25,backgroundColor:'#2563eb',width:65,height:65,borderRadius:32,justifyContent:'center',alignItems:'center',elevation:8},
  modalOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'center',alignItems:'center',padding:20},
  modalContent:{width:'100%',borderRadius:30,padding:25},
  modalTitle:{fontSize:22,fontWeight:'900',marginBottom:20},
  modalInput:{borderRadius:15,padding:15,marginBottom:15},
  typeContainer:{flexDirection:'row',gap:10,marginBottom:20},
  typeBtn:{flex:1,alignItems:'center',padding:15,borderRadius:20,borderWidth:2,borderColor:'transparent'},
  typeBtnActive:{borderColor:'#2563eb',backgroundColor:'rgba(37, 99, 235, 0.1)'},
  typeBtnText:{fontSize:12,fontWeight:'bold',marginTop:5,color:'#64748b'},
  modalFooter:{flexDirection:'row',gap:10},
  cancelBtn:{flex:1,alignItems:'center',padding:15,borderRadius:15},
  createBtn:{flex:1,alignItems:'center',padding:15,borderRadius:15,backgroundColor:'#2563eb'}
});

export default ChatList;
