import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ChatList from './components/ChatList';
import ContactList from './components/ContactList';
import ProfileView from './components/ProfileView';
import ChatRoomView from './components/ChatRoomView';
import ChatPrivateView from './components/ChatPrivateView';
import socketService from './services/socketService';
import { getUserGroups } from './services/api';

interface MainAppProps {
  me: {
    id: string;
    username: string;
    email: string;
    avatar?: string;
    bio?: string;
  };
  onLogout: () => void;
}

export default function MainApp({ me, onLogout }: MainAppProps) {
  const [currentTab, setCurrentTab] = useState<'CHATS' | 'CONTACTS' | 'PROFILE'>('CHATS');
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [activePrivateChat, setActivePrivateChat] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * 📡 Récupérer les groupes de l'utilisateur depuis l'API PostgreSQL
   */
  const fetchRooms = useCallback(async () => {
    if (!me || !me.id) return;

    try {
      console.log('📡 Chargement des groupes pour:', me.id);
      
      const response = await getUserGroups(me.id);
      
      if (response.success && response.groups) {
        setRooms(response.groups);
        console.log(`✅ ${response.groups.length} groupe(s) chargé(s)`);
      } else {
        console.warn('⚠️ Aucun groupe trouvé');
        setRooms([]);
      }
    } catch (error) {
      console.error('❌ Erreur chargement groupes:', error);
      Alert.alert('Erreur', 'Impossible de charger les groupes');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [me]);

  /**
   * 🔌 Initialisation Socket.io et chargement des données
   */
  useEffect(() => {
    if (!me || !me.id) {
      console.error('❌ Aucun utilisateur connecté');
      return;
    }

    console.log('🚀 Initialisation MainApp pour:', me.username);

    // 🔌 Connexion Socket.io
    try {
      socketService.connect(me.id);
      console.log('✅ Socket.io connecté');
    } catch (error) {
      console.error('❌ Erreur connexion Socket.io:', error);
      Alert.alert(
        'Erreur de connexion',
        'Impossible de se connecter au serveur de chat en temps réel'
      );
    }

    // 📡 Charger les groupes
    fetchRooms();

    // 🧹 Cleanup à la déconnexion
    return () => {
      console.log('🧹 Nettoyage MainApp');
      
      if (me && me.id) {
        socketService.setUserOffline(me.id);
        socketService.removeAllListeners();
        socketService.disconnect();
      }
    };
  }, [me, fetchRooms]);

  /**
   * 👥 Gérer la création d'un nouveau groupe
   */
  const handleCreateRoom = useCallback((newRoom: any) => {
    console.log('➕ Nouveau groupe créé:', newRoom.name);
    
    // Recharger les groupes depuis l'API
    fetchRooms();
    
    // Rejoindre le groupe via Socket.io
    if (newRoom.id) {
      socketService.joinGroup(newRoom.id.toString());
    }
  }, [fetchRooms]);

  /**
   * 🎨 Thème de l'application
   */
  const theme = {
    bg: isDarkMode ? '#0f172a' : '#f8fafc',
    tabBar: isDarkMode ? '#1e293b' : '#ffffff',
    active: '#2563eb',
    inactive: '#94a3b8',
    border: isDarkMode ? '#334155' : '#e2e8f0',
  };

  /**
   * 🖼️ Rendu du contenu selon l'onglet actif
   */
  const renderContent = () => {
    // 💬 Chat groupe ouvert
    if (activeRoom) {
      return (
        <ChatRoomView
          room={activeRoom}
          me={me}
          onBack={() => {
            console.log('🔙 Retour depuis le chat de groupe');
            socketService.leaveGroup(activeRoom.id.toString());
            setActiveRoom(null);
            fetchRooms(); // Recharger les groupes
          }}
          isDarkMode={isDarkMode}
        />
      );
    }

    // 💬 Chat privé ouvert
    if (activePrivateChat) {
      return (
        <ChatPrivateView
          chatWith={activePrivateChat}
          me={me}
          onBack={() => {
            console.log('🔙 Retour depuis le chat privé');
            setActivePrivateChat(null);
          }}
          onBlockUser={() => {
            console.log('🚫 Utilisateur bloqué');
            setActivePrivateChat(null);
          }}
          isDarkMode={isDarkMode}
        />
      );
    }

    // 📑 Onglets principaux
    switch (currentTab) {
      case 'CHATS':
        return (
          <ChatList
            me={me}
            rooms={rooms}
            onNavigate={(room) => {
              console.log('📂 Ouverture du groupe:', room.name);
              socketService.joinGroup(room.id.toString());
              setActiveRoom(room);
            }}
            onOpenPrivateChat={(user) => {
              console.log('💬 Ouverture chat privé avec:', user.username);
              setActivePrivateChat(user);
            }}
            onCreateRoom={handleCreateRoom}
            onRefresh={fetchRooms}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            loading={loading}
          />
        );
        
      case 'CONTACTS':
        return (
          <ContactList
            me={me}
            onStartChat={(user) => {
              console.log('💬 Démarrage chat avec:', user.username);
              setActivePrivateChat(user);
            }}
            isDarkMode={isDarkMode}
          />
        );
        
      case 'PROFILE':
        return (
          <ProfileView 
            userId={me.id} 
            isDarkMode={isDarkMode} 
            onLogout={() => {
              console.log('👋 Déconnexion demandée');
              socketService.setUserOffline(me.id);
              socketService.disconnect();
              onLogout();
            }} 
          />
        );
        
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.bg}
      />
      
      <View style={styles.main}>
        {renderContent()}
      </View>

      {/* 📱 Barre de navigation visible seulement si aucun chat n'est ouvert */}
      {!activeRoom && !activePrivateChat && (
        <View style={[
          styles.tabBar, 
          { 
            backgroundColor: theme.tabBar, 
            borderTopColor: theme.border 
          }
        ]}>
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

/**
 * 🔘 Composant bouton de navigation
 */
interface TabButtonProps {
  label: string;
  icon: any;
  active: boolean;
  onPress: () => void;
  theme: {
    active: string;
    inactive: string;
  };
}

const TabButton: React.FC<TabButtonProps> = ({ label, icon, active, onPress, theme }) => (
  <TouchableOpacity 
    style={styles.tabItem} 
    onPress={onPress} 
    activeOpacity={0.7}
  >
    <Ionicons
      name={active ? icon : `${icon}-outline`}
      size={24}
      color={active ? theme.active : theme.inactive}
    />
    <Text style={[
      styles.tabLabel, 
      { color: active ? theme.active : theme.inactive }
    ]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  main: { 
    flex: 1 
  },
  tabBar: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 85 : 70,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  tabItem: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 8
  },
  tabLabel: { 
    fontSize: 11, 
    fontWeight: '600', 
    marginTop: 4,
    letterSpacing: 0.2
  },
});