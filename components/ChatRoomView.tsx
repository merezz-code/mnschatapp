import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Modal, Alert, ScrollView } from 'react-native';
import { ArrowLeft, Send, Mic, Phone, Paperclip, ImageIcon, Settings, X, Check, UserPlus, LogOut, Trash2, UserMinus, StopCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { db } from '../services/database';
import { getGroupChat, markUserLeftGroup } from '../services/database';
import { setTyping } from '../services/typingIndicator';
import { markGroupMessagesAsRead } from '../services/messageStatus';
import TypingIndicator from './TypingIndicator';

const ChatRoomView = ({ room, me, onBack }) => {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editedName, setEditedName] = useState(room.name);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [members, setMembers] = useState([]);
  const [admins, setAdmins] = useState([]);

  const flatListRef = useRef(null);
  const recordingRef = useRef(null);
  const durationInterval = useRef(null);
  const typingTimeoutRef = useRef(null);

  const isAdmin = admins.includes(me.id);

  useEffect(() => {
    loadMessages();
    loadMembers();
    
    // Marquer tous les messages comme lus dès l'ouverture
    markGroupMessagesAsRead(room.id, me.id);

    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Arrêter l'indicateur de frappe en quittant
      setTyping(me.id, room.id, false);
    };
  }, [room.id]);

  const loadMessages = () => {
    try {
      // Utiliser la fonction qui filtre selon si l'utilisateur a quitté
      const msgs = getGroupChat(room.id, me.id);
      setMessages(msgs);
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    }
  };

  const loadMembers = () => {
    try {
      const membersData = db.getAllSync(
        'SELECT user_id, role FROM group_members WHERE group_id = ?',
        [room.id]
      );

      const memberIds = membersData.map(m => m.user_id);
      const adminIds = membersData.filter(m => m.role === 'admin').map(m => m.user_id);

      setMembers(memberIds);
      setAdmins(adminIds);
    } catch (error) {
      console.error('Erreur chargement membres:', error);
    }
  };

  const handleSendMessage = (content, type = 'text', fileName = null, fileUrl = null) => {
    if (!content.trim()) return;

    try {
      const timestamp = Date.now();

      db.runSync(
        `INSERT INTO group_messages (group_id, sender_id, content, type, file_name, file_url, image_url, audio_url, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          room.id,
          me.id,
          content,
          type,
          fileName,
          type === 'file' ? fileUrl : null,
          type === 'image' ? fileUrl : null,
          type === 'audio' ? fileUrl : null,
          timestamp
        ]
      );

      // Mettre à jour lastUpdate du groupe
      db.runSync('UPDATE groups SET lastUpdate = ? WHERE id = ?', [timestamp, room.id]);

      // Arrêter l'indicateur de frappe après envoi
      setTyping(me.id, room.id, false);

      loadMessages();

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('Erreur envoi message:', error);
      Alert.alert('Erreur', "Impossible d'envoyer le message");
    }
  };

  const handleInputChange = (text) => {
    setInputText(text);

    // Gérer l'indicateur "en train d'écrire"
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (text.length > 0) {
      setTyping(me.id, room.id, true);
      
      // Auto-stop après 3 secondes d'inactivité
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(me.id, room.id, false);
      }, 3000);
    } else {
      setTyping(me.id, room.id, false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Accès aux photos nécessaire.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7
    });
    if (!result.canceled) {
      handleSendMessage("📷 Image", 'image', 'photo.jpg', result.assets[0].uri);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (!result.canceled && result.assets) {
      const file = result.assets[0];
      handleSendMessage(`📎 ${file.name}`, 'file', file.name, file.uri);
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', "Accès au microphone nécessaire.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Erreur enregistrement:', err);
      Alert.alert('Erreur', "Impossible d'enregistrer l'audio");
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      setIsRecording(false);
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      if (uri) {
        handleSendMessage(`🎤 Message vocal (${recordingDuration}s)`, 'audio', 'audio.m4a', uri);
      }

      recordingRef.current = null;
      setRecordingDuration(0);
    } catch (err) {
      console.error('Erreur arrêt enregistrement:', err);
    }
  };

  const handleSaveSettings = () => {
    try {
      db.runSync('UPDATE groups SET name = ?, lastUpdate = ? WHERE id = ?', [editedName, Date.now(), room.id]);
      Alert.alert('Succès', 'Nom du groupe modifié');
      setShowSettings(false);
      room.name = editedName;
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      Alert.alert('Erreur', 'Impossible de modifier le nom');
    }
  };

  const handleAddMember = (userId) => {
    try {
      db.runSync(
        'INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
        [room.id, userId, 'member']
      );
      loadMembers();
      setShowAddMember(false);
      Alert.alert('Succès', 'Membre ajouté');
    } catch (error) {
      console.error('Erreur ajout membre:', error);
      Alert.alert('Erreur', "Impossible d'ajouter le membre");
    }
  };

  const handleRemoveMember = (userId) => {
    Alert.alert(
      "Retirer le membre",
      "Voulez-vous retirer ce membre du groupe ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: () => {
            try {
              db.runSync('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [room.id, userId]);
              loadMembers();
              Alert.alert('Succès', 'Membre retiré');
            } catch (error) {
              console.error('Erreur retrait membre:', error);
              Alert.alert('Erreur', 'Impossible de retirer le membre');
            }
          }
        }
      ]
    );
  };

  const handleLeaveRoom = () => {
    Alert.alert(
      "Quitter le groupe",
      "Voulez-vous vraiment quitter ce groupe ? Vos messages seront effacés de votre appareil.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Quitter",
          style: "destructive",
          onPress: () => {
            try {
              // Marquer la sortie AVANT de retirer de group_members
              markUserLeftGroup(me.id, room.id);
              
              db.runSync('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [room.id, me.id]);
              Alert.alert('Succès', 'Vous avez quitté le groupe');
              onBack();
            } catch (error) {
              console.error('Erreur quitter groupe:', error);
              Alert.alert('Erreur', 'Impossible de quitter le groupe');
            }
          }
        }
      ]
    );
  };

  const handleDeleteRoom = () => {
    Alert.alert(
      "Supprimer le groupe",
      "Cette action est irréversible. Tous les messages seront perdus pour tous les membres.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            try {
              db.runSync('DELETE FROM groups WHERE id = ?', [room.id]);
              Alert.alert('Succès', 'Groupe supprimé');
              onBack();
            } catch (error) {
              console.error('Erreur suppression:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le groupe');
            }
          }
        }
      ]
    );
  };

  const handleCall = () => {
    Alert.alert('Appel vocal', 'Fonctionnalité en développement...');
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getUserInfo = (userId) => {
    try {
      const user = db.getFirstSync('SELECT * FROM users WHERE id = ?', [userId]);
      return user || { username: 'Utilisateur', avatar: 'https://picsum.photos/100' };
    } catch (error) {
      return { username: 'Utilisateur', avatar: 'https://picsum.photos/100' };
    }
  };

  const getAvailableUsers = () => {
    try {
      const allUsers = db.getAllSync('SELECT * FROM users');
      return allUsers.filter(u => !members.includes(u.id) && u.id !== me.id);
    } catch (error) {
      return [];
    }
  };

  const handleDeleteMessage = (messageId) => {
    Alert.alert(
      "Supprimer le message",
      "Voulez-vous vraiment supprimer ce message ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            try {
              db.runSync('DELETE FROM group_messages WHERE id = ?', [messageId]);
              loadMessages();
              Alert.alert('Succès', 'Message supprimé');
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer le message');
            }
          }
        }
      ]
    );
  };

  const renderMessage = ({ item }) => {
    const isMe = item.senderId === me.id;
    const sender = getUserInfo(item.senderId);

    return (
      <View style={[styles.msgWrapper, isMe ? styles.myMsgWrapper : styles.theirMsgWrapper]}>
        {!isMe && (
          <Image
            source={{ uri: sender.avatar }}
            style={styles.senderAvatar}
          />
        )}

        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {!isMe && (
            <Text style={styles.senderName}>{sender.username}</Text>
          )}

          {item.type === 'image' && item.imageUrl && (
            <Image source={{ uri: item.imageUrl }} style={styles.msgImage} resizeMode="cover" />
          )}

          {item.type === 'file' && (
            <View style={styles.fileContainer}>
              <Paperclip size={20} color={isMe ? "#fff" : "#2563eb"} />
              <Text style={[styles.fileText, isMe ? styles.myText : styles.theirText]}>
                {item.fileName || 'Fichier'}
              </Text>
            </View>
          )}

          {item.type === 'audio' && (
            <View style={styles.audioContainer}>
              <Mic size={20} color={isMe ? "#fff" : "#2563eb"} />
              <Text style={[styles.audioText, isMe ? styles.myText : styles.theirText]}>
                Message vocal
              </Text>
            </View>
          )}

          <Text style={[styles.msgText, isMe ? styles.myText : styles.theirText]}>
            {item.content}
          </Text>

          <View style={styles.bottomRow}>
            <Text style={[styles.msgTime, isMe ? styles.myTime : styles.theirTime]}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>

            {isMe && (
              <TouchableOpacity
                onPress={() => handleDeleteMessage(item.id)}
                style={styles.trashTouch}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.trashIcon}>🗑️</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Image source={{ uri: room.avatar || 'https://picsum.photos/200' }} style={styles.avatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{room.name}</Text>
          <Text style={styles.status}>{members.length} membres</Text>
        </View>
        <TouchableOpacity onPress={handleCall} style={styles.headerAction}>
          <Phone size={22} color="#2563eb" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerAction}>
          <Settings size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      <TypingIndicator chatId={room.id} currentUserId={me.id} isGroup={true} />

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputSection}>
          {isRecording ? (
            <View style={styles.recordingContainer}>
              <View style={styles.recordingInfo}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>Enregistrement... {formatDuration(recordingDuration)}</Text>
              </View>
              <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
                <StopCircle size={28} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.inputContainer}>
                <TouchableOpacity style={styles.attachBtn} onPress={pickDocument}>
                  <Paperclip size={20} color="#94a3b8" />
                </TouchableOpacity>
                <TextInput
                  style={styles.input}
                  placeholder="Message..."
                  value={inputText}
                  onChangeText={handleInputChange}
                  multiline
                />
                <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
                  <ImageIcon size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.sendBtn, !inputText.trim() && styles.micBtn]}
                onPress={() => {
                  if (inputText.trim()) {
                    handleSendMessage(inputText.trim());
                    setInputText('');
                  } else {
                    startRecording();
                  }
                }}
              >
                {inputText.trim() ? (
                  <Send size={24} color="#fff" />
                ) : (
                  <Mic size={24} color="#fff" />
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showSettings} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gestion du Groupe</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {isAdmin && (
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>Nom du groupe</Text>
                  <TextInput
                    style={styles.settingInput}
                    value={editedName}
                    onChangeText={setEditedName}
                  />
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings}>
                    <Check size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>Sauvegarder</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Membres ({members.length})</Text>
                {isAdmin && (
                  <TouchableOpacity onPress={() => setShowAddMember(true)} style={styles.addMemberBtn}>
                    <UserPlus size={20} color="#2563eb" />
                  </TouchableOpacity>
                )}
              </View>

              {members.map(memberId => {
                const user = getUserInfo(memberId);
                return (
                  <View key={memberId} style={styles.memberItem}>
                    <Image source={{ uri: user.avatar }} style={styles.memberAvatar} />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {user.username} {memberId === me.id ? '(Vous)' : ''}
                      </Text>
                      <Text style={styles.memberRole}>
                        {admins.includes(memberId) ? '👑 Administrateur' : 'Membre'}
                      </Text>
                    </View>
                    {isAdmin && memberId !== me.id && (
                      <TouchableOpacity
                        onPress={() => handleRemoveMember(memberId)}
                        style={styles.removeMemberBtn}
                      >
                        <UserMinus size={20} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              <View style={styles.actionsContainer}>
                {!isAdmin && (
                  <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveRoom}>
                    <LogOut size={20} color="#ef4444" />
                    <Text style={styles.leaveBtnText}>Quitter le groupe</Text>
                  </TouchableOpacity>
                )}

                {isAdmin && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteRoom}>
                    <Trash2 size={20} color="#fff" />
                    <Text style={styles.deleteBtnText}>Supprimer le groupe</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>

        <Modal visible={showAddMember} animationType="fade" transparent={true}>
          <View style={styles.innerModalOverlay}>
            <View style={styles.innerModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ajouter un membre</Text>
                <TouchableOpacity onPress={() => setShowAddMember(false)}>
                  <X size={24} color="#000" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 400 }}>
                {getAvailableUsers().map(u => (
                  <TouchableOpacity
                    key={u.id}
                    style={styles.memberSelect}
                    onPress={() => handleAddMember(u.id)}
                  >
                    <Image source={{ uri: u.avatar }} style={styles.memberAvatar} />
                    <Text style={styles.memberName}>{u.username}</Text>
                    <UserPlus size={20} color="#2563eb" />
                  </TouchableOpacity>
                ))}
                {getAvailableUsers().length === 0 && (
                  <Text style={styles.emptyText}>Aucun utilisateur disponible</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  backBtn: { padding: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginLeft: 5 },
  headerInfo: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  status: { fontSize: 11, color: '#64748b', marginTop: 2 },
  headerAction: { padding: 10 },
  list: { padding: 15, paddingBottom: 30 },
  msgWrapper: { marginBottom: 16, flexDirection: 'row', alignItems: 'flex-end' },
  myMsgWrapper: { justifyContent: 'flex-end' },
  theirMsgWrapper: { justifyContent: 'flex-start' },
  senderAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  bubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  myBubble: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
    elevation: 2,
  },
  theirBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    elevation: 2,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 4
  },
  msgText: { fontSize: 15, lineHeight: 20 },
  myText: { color: '#fff' },
  theirText: { color: '#0f172a' },
  msgImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
    marginBottom: 6
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 10
  },
  fileText: { fontSize: 13, fontWeight: '500', flex: 1 },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 10,
  },
  audioText: { fontSize: 13, fontWeight: '500' },
  msgTime: { fontSize: 10, marginTop: 6, fontWeight: '500' },
  myTime: { color: 'rgba(255,255,255,0.8)', textAlign: 'right' },
  theirTime: { color: '#94a3b8' },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
  },
  trashTouch: {
    marginLeft: 12,
    padding: 4,
  },
  trashIcon: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  inputSection: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 25,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 48
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 15,
    maxHeight: 100,
  },
  attachBtn: { padding: 8 },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  micBtn: { backgroundColor: '#64748b' },
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
  },
  recordingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
  },
  stopBtn: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    minHeight: '80%',
    maxHeight: '90%',
  },
  innerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20
  },
  innerModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 20,
    marginTop: 25,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
  addMemberBtn: { padding: 5 },
  settingItem: { marginBottom: 20 },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8
  },
  settingInput: {
    backgroundColor: '#f1f5f9',
    borderRadius: 15,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  saveBtn: { 
    backgroundColor: '#2563eb', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 12, 
    borderRadius: 15, 
    gap: 10, 
    marginTop: 10 
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
  memberItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 15, 
    padding: 10, 
    backgroundColor: '#f8fafc', 
    borderRadius: 15 
  },
  memberAvatar: { width: 40, height: 40, borderRadius: 10 },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 14, fontWeight: 'bold' },
  memberRole: { fontSize: 11, color: '#94a3b8' },
  removeMemberBtn: { padding: 10 },
  memberSelect: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9' 
  },
  emptyText: { 
    textAlign: 'center', 
    color: '#94a3b8', 
    fontSize: 14, 
    padding: 20 
  },
  actionsContainer: { marginTop: 30, gap: 15 },
  leaveBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 18, 
    borderRadius: 20, 
    gap: 10, 
    borderColor: '#ef4444', 
    backgroundColor: '#fff', 
    borderWidth: 1 
  },
  leaveBtnText: { color: '#ef4444', fontWeight: 'bold' },
  deleteBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 18, 
    borderRadius: 20, 
    gap: 10, 
    backgroundColor: '#ef4444' 
  },
  deleteBtnText: { color: '#fff', fontWeight: 'bold' },
});

export default ChatRoomView;
