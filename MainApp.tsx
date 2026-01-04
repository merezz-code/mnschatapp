
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ChatList from './components/ChatList';
import ContactList from './components/ContactList';
import ProfileView from './components/ProfileView';
import ChatRoomView from './components/ChatRoomView';
import ChatPrivateView from './components/ChatPrivateView';
import socketService from './services/socketService';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('chatapp.db');

export default function MainApp({ me, onLogout }: any) {
  const [currentTab, setCurrentTab] = useState('CHATS');
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [activePrivateChat, setActivePrivateChat] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);

  const fetchRooms = useCallback(() => {
    try {
      const allRooms = db.getAllSync('SELECT * FROM groups ORDER BY lastUpdate DESC');
      setRooms(allRooms);
    } catch (e) {
      console.error('Erreur chargement salons:', e);
    }
  }, []);

  useEffect(() => {
    if (me && me.id) {
      console.log('Connexion Socket.io pour l\'utilisateur:', me.id);
      
      // Connecter Socket.io
      socketService.connect(me.id);
      socketService.setUserOnline(me.id);

      fetchRooms();
    }

    // ✅ Nettoyage à la déconnexion
    return () => {
      if (me && me.id) {
        console.log('Déconnexion Socket.io pour l\'utilisateur:', me.id);
        socketService.setUserOffline(me.id);
        socketService.disconnect();
      }
    };
  }, [me, fetchRooms]);

  const handleCreateRoom = (newRoom: any) => {
    try {
      db.runSync(
        'INSERT INTO groups (id, name, avatar, is_private, created_by, lastUpdate) VALUES (?, ?, ?, ?, ?, ?)',
        [
          newRoom.id,
          newRoom.name,
          newRoom.avatar,
          newRoom.is_private,
          newRoom.created_by,
          newRoom.lastUpdate,
        ]
      );
      db.runSync(
        'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
        [newRoom.id, me.id, 'admin']
      );
      fetchRooms();
    } catch (e) {
      console.error('Erreur création salon:', e);
    }
  };

  const theme = {
    bg: isDarkMode ? '#0f172a' : '#f8fafc',
    tabBar: isDarkMode ? '#1e293b' : '#ffffff',
    active: '#2563eb',
    inactive: '#94a3b8',
    border: isDarkMode ? '#334155' : '#e2e8f0',
  };

  const renderContent = () => {
    // Chat groupe ouvert
    if (activeRoom) {
      return (
        <ChatRoomView
          room={activeRoom}
          me={me}
          onBack={() => {
            setActiveRoom(null);
            fetchRooms();
          }}
        />
      );
    }

    if (activePrivateChat) {
      return (
        <ChatPrivateView
          chatWith={activePrivateChat}
          me={me}
          onBack={() => setActivePrivateChat(null)}
          onBlockUser={() => setActivePrivateChat(null)}
        />
      );
    }

    // Onglets normaux
    switch (currentTab) {
      case 'CHATS':
        return (
          <ChatList
            me={me}
            onNavigate={setActiveRoom}
            onOpenPrivateChat={setActivePrivateChat}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          />
        );
      case 'CONTACTS':
        return (
          <ContactList
            me={me}
            onStartChat={(user) => setActivePrivateChat(user)}
          />
        );
      case 'PROFILE':
        return <ProfileView userId={me.id} isDarkMode={isDarkMode} onLogout={onLogout} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.main}>{renderContent()}</View>

      {/* Tab bar visible seulement quand aucun chat n'est ouvert */}
      {!activeRoom && !activePrivateChat && (
        <View style={[styles.tabBar, { backgroundColor: theme.tabBar, borderTopColor: theme.border }]}>
          <TabButton
            label="Messages"
            icon="chatbubble-ellipses"
            active={currentTab === 'CHATS'}
            onPress={() => setCurrentTab('CHATS')}
            theme={theme}
          />
          <TabButton
            label="Contacts"
            icon="people"
            active={currentTab === 'CONTACTS'}
            onPress={() => setCurrentTab('CONTACTS')}
            theme={theme}
          />
          <TabButton
            label="Profil"
            icon="person"
            active={currentTab === 'PROFILE'}
            onPress={() => setCurrentTab('PROFILE')}
            theme={theme}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const TabButton = ({ label, icon, active, onPress, theme }: any) => (
  <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
    <Ionicons
      name={active ? icon : `${icon}-outline`}
      size={24}
      color={active ? theme.active : theme.inactive}
    />
    <Text style={[styles.tabLabel, { color: active ? theme.active : theme.inactive }]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  main: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 85 : 70,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    alignItems: 'center',
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 10, fontWeight: 'bold', marginTop: 4 },
});