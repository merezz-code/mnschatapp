// ChatPrivateView.tsx

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { db } from '../services/database';

interface ChatPrivateViewProps {
  chatWith: any;
  me: any;
  onBack: () => void;
}

const ChatPrivateView: React.FC<ChatPrivateViewProps> = ({
  chatWith,
  me,
  onBack,
}) => {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);

  const otherUserId = chatWith.id;

  // Vérifie si l'utilisateur est bloqué
  const checkIfBlocked = () => {
    try {
      const result = db.getFirstSync(
        `SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ? LIMIT 1`,
        [me.id, otherUserId]
      );
      setIsBlocked(!!result);
    } catch (err) {
      console.error('Erreur vérification blocage:', err);
    }
  };

  useEffect(() => {
    loadMessages();
    checkIfBlocked();

    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    return () => {
      if (durationInterval.current) clearInterval(durationInterval.current);
    };
  }, [otherUserId]);

  const loadMessages = () => {
    try {
      const msgs = db.getAllSync(
        `SELECT 
          id,
          sender_id AS senderId,
          content,
          type,
          file_name AS fileName,
          file_url AS fileUrl,
          image_url AS imageUrl,
          audio_url AS audioUrl,
          timestamp
         FROM private_messages 
         WHERE (sender_id = ? AND receiver_id = ?) 
            OR (sender_id = ? AND receiver_id = ?)
         ORDER BY timestamp ASC`,
        [me.id, otherUserId, otherUserId, me.id]
      );
      setMessages(msgs);
    } catch (error) {
      console.error('Erreur chargement messages privés:', error);
    }
  };

  const handleDeleteMessage = (messageId: number) => {
    Alert.alert(
      "Supprimer le message",
      "Voulez-vous vraiment supprimer ce message ? Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            try {
              db.runSync('DELETE FROM private_messages WHERE id = ?', [messageId]);
              loadMessages();
              Alert.alert('Succès', 'Message supprimé');
            } catch (error) {
              console.error('Erreur suppression message:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le message');
            }
          }
        }
      ]
    );
  };

  const handleSendMessage = (
    content: string,
    type: 'text' | 'image' | 'file' | 'audio' = 'text',
    fileName: string | null = null,
    fileUrl: string | null = null
  ) => {
    if (type === 'text' && !content.trim()) return;
    if (isBlocked) return; // Bloqué, on n'envoie rien

    try {
      const timestamp = Math.floor(Date.now() / 1000);

      db.runSync(
        `INSERT INTO private_messages 
         (sender_id, receiver_id, content, type, file_name, file_url, image_url, audio_url, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          me.id,
          otherUserId,
          content,
          type,
          fileName,
          type === 'file' ? fileUrl : null,
          type === 'image' ? fileUrl : null,
          type === 'audio' ? fileUrl : null,
          timestamp,
        ]
      );

      loadMessages();
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Erreur envoi message:', error);
      Alert.alert('Erreur', "Impossible d'envoyer le message");
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Accès aux photos nécessaire.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      handleSendMessage('📷 Image', 'image', 'photo.jpg', result.assets[0].uri);
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
    if (isBlocked) return; // Bloqué, pas d'enregistrement
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Accès au microphone nécessaire.');
        return;
      }

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      durationInterval.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Erreur démarrage enregistrement:', err);
      Alert.alert('Erreur', "Impossible de démarrer l'enregistrement");
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      setIsRecording(false);
      if (durationInterval.current) clearInterval(durationInterval.current);

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      if (uri) {
        handleSendMessage(
          `🎤 Message vocal (${recordingDuration}s)`,
          'audio',
          'audio.m4a',
          uri
        );
      }

      recordingRef.current = null;
      setRecordingDuration(0);
    } catch (err) {
      console.error('Erreur arrêt enregistrement:', err);
    }
  };

  // Toggle blocage / débloquage
  const handleToggleBlock = () => {
    if (isBlocked) {
      try {
        db.runSync(
          'DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?',
          [me.id, otherUserId]
        );
        setIsBlocked(false);
        Alert.alert('Débloqué', `${chatWith.username} peut de nouveau vous envoyer des messages.`);
      } catch (err) {
        console.error(err);
        Alert.alert('Erreur', 'Impossible de débloquer cet utilisateur.');
      }
    } else {
      Alert.alert(
        'Bloquer cet utilisateur',
        `Voulez-vous vraiment bloquer ${chatWith.username} ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Bloquer',
            style: 'destructive',
            onPress: () => {
              try {
                db.runSync(
                  'INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)',
                  [me.id, otherUserId]
                );
                setIsBlocked(true);
                Alert.alert('Bloqué', `${chatWith.username} a été bloqué.`);
              } catch (err) {
                console.error(err);
                Alert.alert('Erreur', 'Impossible de bloquer cet utilisateur.');
              }
            },
          },
        ]
      );
    }
  };

  const handleCall = () => {
    Alert.alert('Appel vocal', 'Fonctionnalité en développement...');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === me.id;

    return (
      <View style={[styles.msgWrapper, isMe ? styles.myMsgWrapper : styles.theirMsgWrapper]}>
        {!isMe && (
          <Image
            source={{ uri: chatWith.avatar || `https://i.pravatar.cc/150?u=${chatWith.id}` }}
            style={styles.senderAvatar}
          />
        )}

        <TouchableOpacity
          style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}
          onLongPress={() => isMe && handleDeleteMessage(item.id)}
          delayLongPress={500}
          activeOpacity={0.9}
        >
          {item.type === 'image' && item.imageUrl && (
            <Image source={{ uri: item.imageUrl }} style={styles.msgImage} resizeMode="cover" />
          )}

          {item.type === 'file' && (
            <View style={styles.fileContainer}>
              <MaterialIcons name="attach-file" size={20} color={isMe ? '#fff' : '#2563eb'} />
              <Text style={[styles.fileText, isMe ? styles.myText : styles.theirText]}>
                {item.fileName || 'Fichier'}
              </Text>
            </View>
          )}

          {item.type === 'audio' && (
            <View style={styles.audioContainer}>
              <Ionicons name="mic" size={20} color={isMe ? '#fff' : '#2563eb'} />
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
              {formatTime(item.timestamp)}
            </Text>

            {isMe && (
              <TouchableOpacity
                onPress={() => handleDeleteMessage(item.id)}
                style={styles.trashTouch}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="delete-outline" size={16} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Image
          source={{ uri: chatWith.avatar || `https://i.pravatar.cc/150?u=${chatWith.id}` }}
          style={styles.avatar}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{chatWith.username}</Text>
          <Text style={styles.status}>
            {chatWith.is_online ? 'En ligne' : 'Hors ligne'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleCall} style={styles.headerAction}>
          <MaterialIcons name="call" size={22} color="#2563eb" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerAction}>
          <MaterialIcons name="settings" size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Liste des messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {/* Zone d'envoi */}
      {isBlocked ? (
        <View style={[styles.inputSection, { justifyContent: 'center', padding: 12 }]}>
          <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>
            Vous avez bloqué cet utilisateur. Débloquez pour envoyer un message.
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.inputSection}>
            {isRecording ? (
              <View style={styles.recordingContainer}>
                <View style={styles.recordingInfo}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>
                    Enregistrement... {formatDuration(recordingDuration)}
                  </Text>
                </View>
                <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
                  <MaterialIcons name="stop-circle" size={32} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.inputContainer}>
                  <TouchableOpacity style={styles.attachBtn} onPress={pickDocument}>
                    <MaterialIcons name="attach-file" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.input}
                    placeholder="Message..."
                    value={inputText}
                    onChangeText={setInputText}
                    multiline
                  />
                  <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
                    <MaterialIcons name="image" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.sendBtn, !inputText.trim() && styles.micBtn]}
                  onPress={() => {
                    if (inputText.trim()) {
                      handleSendMessage(inputText.trim(), 'text');
                      setInputText('');
                    } else {
                      startRecording();
                    }
                  }}
                >
                  {inputText.trim() ? (
                    <MaterialIcons name="send" size={24} color="#fff" />
                  ) : (
                    <MaterialIcons name="mic" size={24} color="#fff" />
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Modal Settings */}
      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Options</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <MaterialIcons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.blockBtn} onPress={handleToggleBlock}>
              <MaterialIcons name="block" size={22} color={isBlocked ? '#2563eb' : '#ef4444'} />
              <Text style={[styles.blockBtnText, { color: isBlocked ? '#2563eb' : '#ef4444' }]}>
                {isBlocked ? `Débloquer ${chatWith.username}` : `Bloquer ${chatWith.username}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
    elevation: 2,
  },
  myBubble: { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: '#e2e8f0', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 14 },
  myText: { color: '#fff' },
  theirText: { color: '#0f172a' },
  bottomRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 },
  msgTime: { fontSize: 10 },
  myTime: { color: 'rgba(255,255,255,0.8)', marginRight: 6 },
  theirTime: { color: '#64748b', marginLeft: 6 },
  trashTouch: { padding: 4 },
  inputSection: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  inputContainer: { flexDirection: 'row', flex: 1, alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 25, paddingHorizontal: 10 },
  input: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14, maxHeight: 100 },
  attachBtn: { padding: 6 },
  sendBtn: { backgroundColor: '#2563eb', borderRadius: 24, padding: 12, marginLeft: 8 },
  micBtn: { backgroundColor: '#64748b' },
  recordingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },
  recordingInfo: { flexDirection: 'row', alignItems: 'center' },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', marginRight: 6 },
  recordingText: { fontSize: 14, color: '#ef4444' },
  stopBtn: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  blockBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  blockBtnText: { marginLeft: 10, fontSize: 16, fontWeight: '600' },
  msgImage: { width: 180, height: 120, borderRadius: 12, marginBottom: 6 },
  fileContainer: { flexDirection: 'row', alignItems: 'center' },
  fileText: { marginLeft: 6 },
  audioContainer: { flexDirection: 'row', alignItems: 'center' },
  audioText: { marginLeft: 6 },
});

export default ChatPrivateView;
