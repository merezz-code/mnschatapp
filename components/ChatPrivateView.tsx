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
import {
  ArrowLeft,
  Send,
  Mic,
  Phone,
  Paperclip,
  Image as ImageIcon,
  Settings,
  X,
  StopCircle,
  UserX,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { db } from '../services/database';
import { setTyping } from '../services/typingIndicator';
import { markPrivateMessagesAsRead } from '../services/messageStatus';
import TypingIndicator from './TypingIndicator';

interface ChatPrivateViewProps {
  chatWith: any;
  me: any;
  onBack: () => void;
  onBlockUser?: (userId: string) => void;
}

const ChatPrivateView: React.FC<ChatPrivateViewProps> = ({
  chatWith,
  me,
  onBack,
  onBlockUser,
}) => {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const otherUserId = chatWith.id;

  useEffect(() => {
    loadMessages();
    
    // Marquer tous les messages reçus comme lus dès l'ouverture
    markPrivateMessagesAsRead(otherUserId, me.id);

    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    return () => {
      if (durationInterval.current) clearInterval(durationInterval.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      // Arrêter l'indicateur de frappe en quittant
      setTyping(me.id, otherUserId, false);
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
          timestamp,
          is_read AS isRead
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

      // Arrêter l'indicateur de frappe après envoi
      setTyping(me.id, otherUserId, false);

      loadMessages();

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Erreur envoi message:', error);
      Alert.alert('Erreur', "Impossible d'envoyer le message");
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);

    // Gérer l'indicateur "en train d'écrire"
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (text.length > 0) {
      setTyping(me.id, otherUserId, true);
      
      // Auto-stop après 3 secondes d'inactivité
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(me.id, otherUserId, false);
      }, 3000);
    } else {
      setTyping(me.id, otherUserId, false);
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

  const handleBlockUser = () => {
    Alert.alert(
      'Bloquer cet utilisateur',
      `Voulez-vous vraiment bloquer ${chatWith.username} ? Vous ne pourrez plus échanger de messages.`,
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
              Alert.alert('Bloqué', `${chatWith.username} a été bloqué.`);
              if (onBlockUser) onBlockUser(otherUserId);
              onBack();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de bloquer cet utilisateur');
            }
          },
        },
      ]
    );
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

        <View 
          style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}
        >
          {item.type === 'image' && item.imageUrl && (
            <Image source={{ uri: item.imageUrl }} style={styles.msgImage} resizeMode="cover" />
          )}

          {item.type === 'file' && (
            <View style={styles.fileContainer}>
              <Paperclip size={20} color={isMe ? '#fff' : '#2563eb'} />
              <Text style={[styles.fileText, isMe ? styles.myText : styles.theirText]}>
                {item.fileName || 'Fichier'}
              </Text>
            </View>
          )}

          {item.type === 'audio' && (
            <View style={styles.audioContainer}>
              <Mic size={20} color={isMe ? '#fff' : '#2563eb'} />
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
          <Phone size={22} color="#2563eb" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerAction}>
          <Settings size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      <TypingIndicator chatId={otherUserId} currentUserId={me.id} isGroup={false} />

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
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
                <Text style={styles.recordingText}>
                  Enregistrement... {formatDuration(recordingDuration)}
                </Text>
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
                    handleSendMessage(inputText.trim(), 'text');
                    setInputText('');
                  } else {
                    startRecording();
                  }
                }}
              >
                {inputText.trim() ? <Send size={24} color="#fff" /> : <Mic size={24} color="#fff" />}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Options</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.blockBtn} onPress={handleBlockUser}>
              <UserX size={22} color="#ef4444" />
              <Text style={styles.blockBtnText}>Bloquer {chatWith.username}</Text>
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
  },
  myBubble: { backgroundColor: '#2563eb', borderBottomRightRadius: 4, elevation: 2 },
  theirBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 4, elevation: 2 },
  msgText: { fontSize: 15, lineHeight: 20 },
  myText: { color: '#fff' },
  theirText: { color: '#0f172a' },
  msgImage: { width: 220, height: 160, borderRadius: 12, marginBottom: 6 },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 10,
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
    borderTopColor: '#f1f5f9',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 25,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 48,
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
  recordingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444' },
  recordingText: { fontSize: 15, fontWeight: '600', color: '#ef4444' },
  stopBtn: { padding: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  blockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    padding: 18,
    backgroundColor: '#fef2f2',
    borderRadius: 15,
  },
  blockBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
});

export default ChatPrivateView;
