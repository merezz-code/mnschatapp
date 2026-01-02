import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
  Alert
} from 'react-native';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as SQLite from 'expo-sqlite';

// Ouverture de la base de données avec l'API moderne
const db = SQLite.openDatabaseSync('chatapp.db');

interface ContactListProps {
  me: any;
  onStartChat: (user: any) => void;
  isDarkMode?: boolean;
}

const ContactList: React.FC<ContactListProps> = ({ me, onStartChat, isDarkMode = false }) => {
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);

  // 1. Charger les contacts et les blocages au démarrage
  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    try {
      // Chargement des contacts (Sauf moi)
      const users = db.getAllSync(
        'SELECT * FROM users WHERE id != ? ORDER BY username ASC',
        [me.id]
      );
      setContacts(users);

      // Chargement des IDs bloqués
      const blocked = db.getAllSync(
        'SELECT blocked_id FROM blocks WHERE blocker_id = ?',
        [me.id]
      );
      setBlockedIds(blocked.map((item: any) => item.blocked_id));
    } catch (error) {
      console.error("Erreur chargement contacts:", error);
    }
  };

  // 2. Gérer le blocage / déblocage
  const handleToggleBlock = (userId: string) => {
    const isCurrentlyBlocked = blockedIds.includes(userId);

    try {
      if (isCurrentlyBlocked) {
        // Débloquer
        db.runSync(
          'DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?',
          [me.id, userId]
        );
        Alert.alert("Succès", "Utilisateur débloqué");
      } else {
        // Bloquer
        db.runSync(
          'INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)',
          [me.id, userId]
        );
        Alert.alert("Sécurité", "Utilisateur bloqué");
      }
      // Rafraîchir la liste locale des IDs bloqués
      loadData();
    } catch (error) {
      console.error("Erreur lors du (dé)blocage:", error);
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
          <Image source={{ uri: user.avatar || `https://i.pravatar.cc/150?u=${user.id}` }} style={styles.avatar} />
          <View>
            <Text style={[styles.userName, { color: isDarkMode ? 'white' : '#1e293b' }]}>
              {user.username}
            </Text>
            <View style={styles.statusContainer}>
              <View style={[
                styles.statusDot,
                { backgroundColor: user.is_online ? '#22c55e' : '#94a3b8' }
              ]} />
              <Text style={styles.statusText}>{user.is_online ? 'EN LIGNE' : 'HORS LIGNE'}</Text>
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

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDarkMode ? 'white' : '#0f172a' }]}>Contacts</Text>
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
        ListFooterComponent={() => (
          blockedIds.length > 0 ? (
            <View style={styles.footer}>
              <View style={styles.divider} />
              <View style={styles.blockedHeader}>
                <MaterialIcons name="security" size={14} color="#94a3b8" />
                <Text style={styles.footerText}>UTILISATEURS BLOQUÉS ({blockedIds.length})</Text>
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
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 10 },
  title: { fontSize: 28, fontWeight: '900' },
  searchSection: { paddingHorizontal: 20, marginBottom: 20, position: 'relative' },
  searchIcon: { position: 'absolute', left: 35, top: 15, zIndex: 1 },
  searchInput: { height: 50, borderRadius: 15, paddingLeft: 45, paddingRight: 20, fontSize: 14 },
  listContent: { paddingHorizontal: 20, paddingBottom: 30 },
  contactCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderRadius: 25, marginBottom: 12 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 55, height: 55, borderRadius: 18 },
  userName: { fontSize: 16, fontWeight: 'bold' },
  statusContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold' },
  actionGroup: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 45, height: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  blockedOpacity: { opacity: 0.5 },
  footer: { marginTop: 20, marginBottom: 10 },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginBottom: 15 },
  blockedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, opacity: 0.5, paddingLeft: 10 },
  footerText: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8' }
});

export default ContactList;