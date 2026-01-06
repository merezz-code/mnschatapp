import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  Alert, 
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { updateUserProfile, getAllUsers } from '../services/api';

interface ProfileViewProps {
  userId: string;
  isDarkMode?: boolean;
  onLogout: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ userId, isDarkMode = false, onLogout }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('https://via.placeholder.com/150');

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      
      // 🔹 Récupérer les infos utilisateur via API PostgreSQL
      const response = await getAllUsers();
      
      if (response.success && response.users) {
        const user = response.users.find((u: any) => u.id === userId);
        
        if (user) {
          setName(user.username || '');
          setBio(user.bio || '');
          setAvatar(user.avatar || 'https://via.placeholder.com/150');
          console.log('✅ Profil chargé:', user.username);
        } else {
          Alert.alert('Erreur', 'Utilisateur introuvable');
        }
      } else {
        Alert.alert('Erreur', 'Impossible de charger le profil');
      }
    } catch (error) {
      console.error('❌ Erreur chargement profil:', error);
      Alert.alert('Erreur', 'Impossible de se connecter au serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom ne peut pas être vide');
      return;
    }

    setSaving(true);
    
    try {
      // 🔹 Mettre à jour le profil via API PostgreSQL
      const response = await updateUserProfile(userId, name.trim(), bio.trim(), avatar);
      
      if (response.success) {
        Alert.alert('Succès', 'Profil mis à jour !');
        setIsEditing(false);
        console.log('✅ Profil mis à jour');
      } else {
        Alert.alert('Erreur', 'Impossible de mettre à jour le profil');
      }
    } catch (error) {
      console.error('❌ Erreur mise à jour profil:', error);
      Alert.alert('Erreur', 'Impossible de se connecter au serveur');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    try {
      // Demander les permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission refusée', 'Vous devez autoriser l\'accès à la galerie');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1]
      });
      
      if (!result.canceled && result.assets && result.assets[0]) {
        // 🔹 Pour l'instant on utilise l'URI local
        // TODO: Upload vers un serveur de stockage (AWS S3, Cloudinary, etc.)
        setAvatar(result.assets[0].uri);
        console.log('📷 Image sélectionnée');
      }
    } catch (error) {
      console.error('❌ Erreur sélection image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner une image');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion', 
      'Voulez-vous vraiment vous déconnecter ?', 
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Oui', 
          style: 'destructive',
          onPress: () => {
            console.log('👋 Déconnexion');
            onLogout();
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ 
            textAlign: 'center', 
            marginTop: 20, 
            color: isDarkMode ? '#94a3b8' : '#64748b',
            fontSize: 16
          }}>
            Chargement du profil...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={[styles.container, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: isDarkMode ? 'white' : '#0f172a' }]}>
          Mon Profil
        </Text>

        {/* Avatar avec bouton caméra */}
        <View style={styles.avatarWrapper}>
          <Image source={{ uri: avatar }} style={styles.avatarImage} />
          {isEditing && (
            <TouchableOpacity 
              style={styles.cameraOverlay} 
              onPress={pickImage}
              activeOpacity={0.7}
            >
              <Feather name="camera" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>

        {!isEditing ? (
          /* Mode Affichage */
          <View style={styles.infoSection}>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, { color: isDarkMode ? 'white' : '#1e293b' }]}>
                {name}
              </Text>
              <TouchableOpacity 
                onPress={() => setIsEditing(true)} 
                style={styles.editBtn}
                activeOpacity={0.7}
              >
                <Feather name="edit-2" size={16} color="#2563eb" />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.bioText, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>
              {bio || 'Aucune biographie.'}
            </Text>

            <TouchableOpacity 
              onPress={handleLogout} 
              style={styles.logoutBtn}
              activeOpacity={0.7}
            >
              <Feather name="log-out" size={20} color="#dc2626" />
              <Text style={styles.logoutText}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Mode Édition */
          <View style={styles.editForm}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>
                Nom
              </Text>
              <TextInput 
                style={[
                  styles.input, 
                  { 
                    color: isDarkMode ? '#fff' : '#000',
                    backgroundColor: isDarkMode ? '#1e293b' : '#fff',
                    borderColor: isDarkMode ? '#334155' : '#e2e8f0'
                  }
                ]} 
                value={name} 
                onChangeText={setName} 
                placeholder="Votre nom" 
                placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
                editable={!saving}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>
                Biographie
              </Text>
              <TextInput 
                style={[
                  styles.input, 
                  styles.textArea,
                  { 
                    color: isDarkMode ? '#fff' : '#000',
                    backgroundColor: isDarkMode ? '#1e293b' : '#fff',
                    borderColor: isDarkMode ? '#334155' : '#e2e8f0'
                  }
                ]} 
                value={bio} 
                onChangeText={setBio} 
                placeholder="Quelques mots sur vous..." 
                placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
                multiline 
                numberOfLines={4}
                editable={!saving}
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.cancelBtn, { borderColor: isDarkMode ? '#334155' : '#e2e8f0' }]} 
                onPress={() => {
                  setIsEditing(false);
                  loadUserData(); // Recharger les données originales
                }}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: '600' }}>
                  Annuler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.saveBtn, 
                  saving && { backgroundColor: '#94a3b8' }
                ]} 
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.7}
              >
                {saving ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Sauvegarder</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scrollContent: { 
    padding: 25, 
    alignItems: 'center', 
    paddingTop: 50,
    paddingBottom: 40
  },
  title: { 
    fontSize: 32, 
    fontWeight: '900', 
    marginBottom: 30,
    letterSpacing: -0.5
  },
  avatarWrapper: { 
    width: 140, 
    height: 140, 
    borderRadius: 70, 
    overflow: 'hidden', 
    borderWidth: 4, 
    borderColor: '#2563eb', 
    marginBottom: 30,
    elevation: 5,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  avatarImage: { 
    width: '100%', 
    height: '100%' 
  },
  cameraOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  infoSection: { 
    width: '100%', 
    alignItems: 'center' 
  },
  nameRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12,
    marginBottom: 8
  },
  userName: { 
    fontSize: 28, 
    fontWeight: 'bold',
    letterSpacing: -0.5
  },
  editBtn: { 
    padding: 10, 
    backgroundColor: '#eff6ff', 
    borderRadius: 20 
  },
  bioText: { 
    marginVertical: 15, 
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 20
  },
  logoutBtn: { 
    flexDirection: 'row', 
    marginTop: 40, 
    padding: 16, 
    backgroundColor: '#fef2f2', 
    borderRadius: 16, 
    width: '100%', 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 10,
    borderWidth: 1,
    borderColor: '#fecaca'
  },
  logoutText: { 
    color: '#dc2626', 
    fontWeight: 'bold',
    fontSize: 16
  },
  editForm: { 
    width: '100%',
    gap: 20
  },
  inputGroup: {
    width: '100%'
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4
  },
  input: { 
    width: '100%', 
    borderWidth: 1.5, 
    borderRadius: 12, 
    padding: 14, 
    fontSize: 15
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 14
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5
  },
  saveBtn: { 
    flex: 1,
    backgroundColor: '#2563eb', 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16
  }
});

export default ProfileView;
