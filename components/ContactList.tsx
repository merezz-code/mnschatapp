import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { getAllUsers } from '../services/api';
import socketService from '../services/socketService';

interface ContactListProps {
  me: any;
  onStartChat: (user: any) => void;
  isDarkMode?: boolean;
}

const ContactList: React.FC<ContactListProps> = ({ me, onStartChat, isDarkMode = false }) => {
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    // Écouter les changements de statut en ligne
    socketService.onUserStatusChange((data) => {
      setContacts(prev => 
        prev.map(c => 
          c.id === data.userId 
            ? { ...c, is_online: data.isOnline ? 1 : 0 } 
            : c
        )
      );
    });

    return () => {
      socketService.offUserStatusChange();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Chargement des contacts via API
      const response = await getAllUsers();
      
      if (response.success && response.users) {
        // Filtrer pour exclure l'utilisateur actuel
        const filteredUsers = response.users.filter((u: any) => u.id !== me.id);
        setContacts(filteredUsers);
        console.log(`✅ ${filteredUsers.length} contacts chargés`);
      }

      // TODO: Implémenter l'API pour les blocages
      // Pour l'instant, liste vide
      setBlockedIds([]);
      
    } catch (error) {
      console.error(" Erreur chargement contacts:", error);
      Alert.alert('Erreur', 'Impossible de charger les contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async (userId: string) => {
    const isCurrentlyBlocked = blockedIds.includes(userId);

    try {
      if (isCurrentlyBlocked) {
        // Débloquer
        // TODO: Implémenter l'API pour débloquer
        // await unblockUser(me.id, userId);
        
        setBlockedIds(prev => prev.filter(id => id !== userId));
        Alert.alert("Succès", "Utilisateur débloqué");
      } else {
        // Bloquer
        // TODO: Implémenter l'API pour bloquer
        // await blockUser(me.id, userId);
        
        setBlockedIds(prev => [...prev, userId]);
        Alert.alert("Sécurité", "Utilisateur bloqué");
      }
      
      console.log(`${isCurrentlyBlocked ? '✅ Débloqué' : '🚫 Bloqué'}: ${userId}`);
    } catch (error) {
      console.error(" Erreur lors du (dé)blocage:", error);
      Alert.alert("Erreur", "Impossible de modifier le statut de blocage");
    }
  };

  const filteredUsers = contacts.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const renderContact = ({ item: user }: { item: any }) => {
    const isBlocked = blockedIds.includes(user.id);

    return (
      <View style={[
        styles.contactCard,
        { backgroundColor: isDarkMode ? '#1e293b' : 'white' },
        isBlocked && styles.blockedOpacity
      ]}>
        <View style={styles.userInfo}>
          <Image 
            source={{ uri: user.avatar || `https://i.pravatar.cc/150?u=${user.id}` }} 
            style={styles.avatar} 
          />
          <View>
            <Text style={[styles.userName, { color: isDarkMode ? 'white' : '#1e293b' }]}>
              {user.username}
            </Text>
            <View style={styles.statusContainer}>
              <View style={[
                styles.statusDot,
                { backgroundColor: user.is_online ? '#22c55e' : '#94a3b8' }
              ]} />
              <Text style={styles.statusText}>
                {user.is_online ? 'EN LIGNE' : 'HORS LIGNE'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionGroup}>
          {!isBlocked && (
            <TouchableOpacity
              onPress={() => onStartChat(user)}
              style={[styles.actionBtn, { backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff' }]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#2563eb" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            onPress={() => handleToggleBlock(user.id)}
            style={[
              styles.actionBtn,
              { backgroundColor: isBlocked ? '#f0fdf4' : '#fef2f2' }
            ]}
          >
            <Feather
              name={isBlocked ? "user-check" : "user-x"}
              size={20}
              color={isBlocked ? "#16a34a" : "#dc2626"}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDarkMode ? 'white' : '#0f172a' }]}>Contacts</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ marginTop: 20, color: '#64748b' }}>Chargement des contacts...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDarkMode ? 'white' : '#0f172a' }]}>Contacts</Text>
        <Text style={[styles.subtitle, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>
          {filteredUsers.length} contact{filteredUsers.length > 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.searchSection}>
        <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          placeholder="Rechercher un contact..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          style={[styles.searchInput, {
            backgroundColor: isDarkMode ? '#1e293b' : 'white',
            color: isDarkMode ? 'white' : 'black'
          }]}
        />
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderContact}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#94a3b8" />
            <Text style={styles.emptyText}>Aucun contact trouvé</Text>
          </View>
        )}
        ListFooterComponent={() => (
          blockedIds.length > 0 ? (
            <View style={styles.footer}>
              <View style={styles.divider} />
              <View style={styles.blockedHeader}>
                <MaterialIcons name="security" size={14} color="#94a3b8" />
                <Text style={styles.footerText}>
                  UTILISATEURS BLOQUÉS ({blockedIds.length})
                </Text>
              </View>
            </View>
          ) : null
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100
  },
  header: { 
    paddingHorizontal: 20, 
    paddingTop: 60, 
    paddingBottom: 10 
  },
  title: { 
    fontSize: 28, 
    fontWeight: '900',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500'
  },
  searchSection: { 
    paddingHorizontal: 20, 
    marginBottom: 20, 
    position: 'relative' 
  },
  searchIcon: { 
    position: 'absolute', 
    left: 35, 
    top: 15, 
    zIndex: 1 
  },
  searchInput: { 
    height: 50, 
    borderRadius: 15, 
    paddingLeft: 45, 
    paddingRight: 20, 
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  listContent: { 
    paddingHorizontal: 20, 
    paddingBottom: 30 
  },
  contactCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 15, 
    borderRadius: 25, 
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  userInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12,
    flex: 1
  },
  avatar: { 
    width: 55, 
    height: 55, 
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#e2e8f0'
  },
  userName: { 
    fontSize: 16, 
    fontWeight: 'bold',
    marginBottom: 2
  },
  statusContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginTop: 4 
  },
  statusDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4 
  },
  statusText: { 
    fontSize: 10, 
    color: '#94a3b8', 
    fontWeight: 'bold',
    letterSpacing: 0.5
  },
  actionGroup: { 
    flexDirection: 'row', 
    gap: 8 
  },
  actionBtn: { 
    width: 45, 
    height: 45, 
    borderRadius: 15, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  blockedOpacity: { 
    opacity: 0.5 
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '500'
  },
  footer: { 
    marginTop: 20, 
    marginBottom: 10 
  },
  divider: { 
    height: 1, 
    backgroundColor: '#e2e8f0', 
    marginBottom: 15 
  },
  blockedHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    opacity: 0.5, 
    paddingLeft: 10 
  },
  footerText: { 
    fontSize: 10, 
    fontWeight: 'bold', 
    color: '#94a3b8',
    letterSpacing: 0.5
  }
});

export default ContactList;