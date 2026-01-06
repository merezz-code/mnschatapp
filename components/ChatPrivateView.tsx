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
  Trash2,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import {
  getPrivateMessages,
  sendPrivateMessage,
  deleteMessageLocal,
  deleteMessageForAll,
  getAllUsers
} from '../services/api';
import socketService from '../services/socketService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/api';


interface ChatPrivateViewProps {
  chatWith: any;
  me: any;
  onBack: () => void;
  onBlockUser?: (userId: string) => void;
  isDarkMode?: boolean;
}

const ChatPrivateView: React.FC<ChatPrivateViewProps> = ({
  chatWith,
  me,
  onBack,
  onBlockUser,
  isDarkMode = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<{ [key: string]: number }>({});
  const [isTyping, setIsTyping] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  //Initialisation du statut (gérer les types number et boolean)
  const [isUserOnline, setIsUserOnline] = useState<boolean>(
    chatWith.is_online === 1 || chatWith.is_online === true
  );

  const flatListRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const otherUserId = chatWith.id;
  const checkBlock = async () => {
  try {
    const res = await fetch(`${API_URL}/blocks/check/${me.id}/${otherUserId}`);
    const text = await res.text();  // <- voir ce que le serveur renvoie
    console.log('Réponse brute:', text);
    const data = JSON.parse(text);  // ou res.json() si c’est bien du JSON
    setIsBlocked(data.blocked);
    await AsyncStorage.setItem(`blocked_${otherUserId}`, data.blocked ? 'true' : 'false');
  } catch (error) {
    console.error('Erreur checkBlock:', error);
  }
};

  const loadBlockStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/blocks/check/${me.id}/${otherUserId}`);
      const data = await res.json();
      setIsBlocked(data.blocked);
      await AsyncStorage.setItem(`blocked_${otherUserId}`, data.blocked ? 'true' : 'false');
    } catch (error) {
      console.error('Erreur checkBlock:', error);
      // fallback sur le cache si l'API échoue
      const cached = await AsyncStorage.getItem(`blocked_${otherUserId}`);
      if (cached !== null) setIsBlocked(cached === 'true');
    }
  };


  useEffect(() => {
    const init = async () => {
      await loadMessages();
      await loadUserDetails();
      await loadBlockStatus();

      const cached = await AsyncStorage.getItem(`blocked_${otherUserId}`);
      if (cached !== null) setIsBlocked(cached === 'true');
      await checkBlock();
    };

    init();


    //Vérifier le statut en temps réel via socket
    socketService.checkUserStatus(otherUserId, (data) => {
      console.log(`🔍 Statut reçu du serveur:`, data);
      setIsUserOnline(data.isOnline);
    });

    // Écouter les nouveaux messages en temps réel
    socketService.onPrivateMessage((message) => {
      if (
        (message.senderId === me.id && message.receiverId === otherUserId) ||
        (message.senderId === otherUserId && message.receiverId === me.id)
      ) {
        console.log('📨 Nouveau message privé reçu');
        loadMessages();

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });

    // Écouter quand l'autre supprime un message
    socketService.onMessageDeleted((data) => {
      console.log('🗑️ Message supprimé reçu via socket');
      loadMessages();
    });

    // Écouter quand l'autre personne tape
    socketService.onTyping((data) => {
      if (data.senderId === otherUserId) {
        setIsTyping(data.isTyping);

        if (data.isTyping) {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
          }, 3000);
        }
      }
    });
    

    socketService.onMessageBlocked(() => {
      Alert.alert('Message bloqué', 'Vous êtes bloqué par cet utilisateur.');
    });

    // Écouter les changements de statut
    socketService.onUserStatusChange((data) => {
      console.log('user_status_changed reçu:', data);

      if (data.userId === otherUserId || data.userId === otherUserId.toString()) {
        const newStatus = data.isOnline === true || data.isOnline === 1;

        // Mettre à jour le state local
        setIsUserOnline(newStatus);

        // Aussi mettre à jour userDetails si il existe
        setUserDetails((prev: any) => {
          if (prev) {
            return {
              ...prev,
              is_online: newStatus ? 1 : 0,
            };
          }
          return prev;
        });

        // Mettre à jour chatWith pour cohérence
        chatWith.is_online = newStatus ? 1 : 0;
      }
    });

    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    return () => {
      if (durationInterval.current) clearInterval(durationInterval.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socketService.emitTyping(otherUserId, false);

      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(err => console.log("Cleanup error", err));
      }
    };
  }, [otherUserId]);

  const loadMessages = async () => {
    try {
      const response = await getPrivateMessages(me.id, otherUserId);

      if (response.success && response.messages) {
        setMessages(response.messages);
        console.log(`${response.messages.length} messages chargés`);
      }
    } catch (error) {
      console.error('Erreur chargement messages:', error);
      Alert.alert('Erreur', 'Impossible de charger les messages');
    }
  };

  const loadUserDetails = async () => {
    try {
      const response = await getAllUsers();

      if (response.success && response.users) {
        const user = response.users.find((u: any) => u.id === otherUserId);
        if (user) {
          setUserDetails(user);

          // Mettre à jour le statut avec la valeur de la DB
          const onlineStatus = user.is_online === 1 || user.is_online === true;
          setIsUserOnline(onlineStatus);
          chatWith.is_online = user.is_online;

          console.log(`Détails utilisateur chargés - Statut: ${onlineStatus ? '🟢 EN LIGNE' : '⚫ HORS LIGNE'}`);
        }
      }
    } catch (error) {
      console.error('Erreur chargement détails:', error);
    }
  };

  const playAudio = async (uri: string, messageId: string) => {
    try {
      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch (e) {
          // Ignorer si déjà déchargé
        }
        soundRef.current = null;
      }

      if (playingAudio === messageId) {
        setPlayingAudio(null);
        return;
      }

      const { sound, status } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false }
      );
      soundRef.current = sound;

      if (status.isLoaded) {
        sound.setOnPlaybackStatusUpdate((playbackStatus) => {
          if (playbackStatus.isLoaded) {
            if (playbackStatus.durationMillis) {
              const progress = (playbackStatus.positionMillis / playbackStatus.durationMillis) * 100;
              setAudioProgress(prev => ({ ...prev, [messageId]: progress }));
            }
            if (playbackStatus.didJustFinish) {
              setPlayingAudio(null);
              setAudioProgress(prev => ({ ...prev, [messageId]: 0 }));
            }
          }
        });

        setPlayingAudio(messageId);
        await sound.playAsync();
      }
    } catch (error) {
      console.error(' Erreur lecture audio:', error);
      Alert.alert('Erreur', 'Impossible de lire le message vocal');
      setPlayingAudio(null);
    }
  };

  const handleSendMessage = async (
    content: string,
    type: 'text' | 'image' | 'file' | 'audio',
    fileName: string | null = null,
    fileUrl: string | null = null
  ) => {
    if (isBlocked) {
    Alert.alert('Action impossible', 'Vous ne pouvez pas envoyer de messages à cet utilisateur.');
    return;
  }
    if (type === 'text' && !content.trim()) return;

    try {
      const timestamp = Date.now();

      const messageData = {
        senderId: me.id,
        receiverId: otherUserId,
        content,
        type,
        fileName: fileName || undefined,
        fileUrl: fileUrl || undefined,
        imageUrl: type === 'image' ? fileUrl || undefined : undefined,
        audioUrl: type === 'audio' ? fileUrl || undefined : undefined,
        timestamp,
      };

      // Sauvegarder dans la DB via API
      await sendPrivateMessage(messageData);

      // Envoyer via Socket.io
      socketService.sendPrivateMessage(messageData);

      console.log(' Message envoyé');

      loadMessages();

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error(' Erreur envoi message:', error);
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
      mediaTypes: ['images'],
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
      console.error(' Erreur enregistrement:', err);
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
          `audio_${Date.now()}.m4a`,
          uri
        );
      }

      recordingRef.current = null;
      setRecordingDuration(0);
    } catch (err) {
      console.error(' Erreur arrêt enregistrement:', err);
    }
  };

  const handleClearChat = () => {
    Alert.alert(
      'Vider la discussion',
      `Voulez-vous vraiment supprimer tous les messages avec ${chatWith.username} ? Ils seront supprimés uniquement pour vous.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Vider pour moi',
          style: 'destructive',
          onPress: async () => {
            try {
              // Supprimer localement tous les messages
              for (const msg of messages) {
                await deleteMessageLocal(me.id, msg.id);
              }

              setMessages([]);
              Alert.alert('Succès', 'La discussion a été vidée pour vous.');
              setShowSettings(false);
            } catch (error) {
              console.error(' Erreur suppression:', error);
              Alert.alert('Erreur', 'Impossible de vider la discussion');
            }
          },
        },
      ]
    );
  };

  const handleBlockUser = async () => {
    try {
      console.log('Utilisateur *' + otherUserId + '* va être bloqué');
      const res = await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockerId: me.id, blockedId: otherUserId })
      });

      if (res.ok) {
        console.log('Utilisateur bloqué avec succès');
        setIsBlocked(true);
        await AsyncStorage.setItem(`blocked_${otherUserId}`, 'true');
        Alert.alert('Bloqué', `${chatWith.username} a été bloqué.`);
      }
    } catch (err) {
      console.error('Erreur block:', err);
      Alert.alert('Erreur', "Impossible de bloquer l'utilisateur");
    }
  };

  const handleUnblockUser = async () => {
    try {
      const res = await fetch(`${API_URL}/blocks`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockerId: me.id, blockedId: otherUserId })
      });

      if (res.ok) {
        setIsBlocked(false);
        await AsyncStorage.setItem(`blocked_${otherUserId}`, 'false');
        Alert.alert('Débloqué', `${chatWith.username} a été débloqué.`);
      }
    } catch (err) {
      console.error('Erreur unblock:', err);
      Alert.alert('Erreur', "Impossible de débloquer l'utilisateur");
    }
  };



  const handleCall = () => {
    Alert.alert('Appel vocal', 'Fonctionnalité en développement...');
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    socketService.emitTyping(otherUserId, text.length > 0);
  };


  const showDeleteOptions = (message: any) => {
    Alert.alert(
      "Supprimer le message",
      "Voulez-vous supprimer ce message ?",
      [
        {
          text: "Pour moi",
          onPress: () => handleDeleteMessageLocal(message.id)
        },
        {
          text: "Pour tous",
          onPress: () => {
            if (message.senderId === me.id) {
              handleDeleteMessageForEveryone(message.id);
            } else {
              Alert.alert("Action impossible", "Vous ne pouvez supprimer pour tous que vos propres messages.");
            }
          }
        },
        { text: "Annuler", style: "cancel" }
      ]
    );
  };

  const handleDeleteMessageLocal = async (messageId: number) => {
    try {
      await deleteMessageLocal(me.id, messageId);
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
      console.log(' Message masqué localement');
    } catch (error) {
      console.error(" Erreur suppression locale:", error);
      Alert.alert('Erreur', 'Impossible de supprimer le message');
    }
  };

  const handleDeleteMessageForEveryone = async (messageId: number) => {
    try {
      await deleteMessageForAll(messageId);

      socketService.emitDeleteMessage({
        messageId: messageId,
        receiverId: otherUserId
      });

      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === messageId
            ? { ...msg, content: 'Ce message a été supprimé', is_deleted: 1 }
            : msg
        )
      );

      console.log(' Message supprimé pour tous');
    } catch (error) {
      console.error(" Erreur suppression pour tous:", error);
      Alert.alert("Erreur", "Impossible de supprimer le message.");
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
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
          activeOpacity={0.8}
          onLongPress={() => showDeleteOptions(item)}
          delayLongPress={300}
          style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}
        >

          {/* IMAGE */}
          {item.type === 'image' && item.imageUrl && (
            <Image source={{ uri: item.imageUrl }} style={styles.msgImage} resizeMode="cover" />
          )}

          {/* FILE */}
          {item.type === 'file' && (
            <View style={styles.fileContainer}>
              <Paperclip size={20} color={isMe ? '#fff' : '#2563eb'} />
              <Text style={[styles.fileText, isMe ? styles.myText : styles.theirText]}>
                {item.fileName || 'Fichier'}
              </Text>
            </View>
          )}

          {/* AUDIO */}
          {item.type === 'audio' && item.audioUrl && (
            <View style={styles.audioContainer}>
              <TouchableOpacity
                style={[styles.audioBtn, isMe ? styles.audioBtnMe : styles.audioBtnTheir]}
                onPress={() => playAudio(item.audioUrl, item.id.toString())}
                onLongPress={() => showDeleteOptions(item)}
              >
                {playingAudio === item.id.toString() ? (
                  <View style={styles.pauseIcon}>
                    <View style={[styles.pauseBar, isMe ? styles.pauseBarMe : styles.pauseBarTheir]} />
                    <View style={[styles.pauseBar, isMe ? styles.pauseBarMe : styles.pauseBarTheir]} />
                  </View>
                ) : (
                  <View style={[styles.playIcon, isMe ? styles.playIconMe : styles.playIconTheir]} />
                )}
              </TouchableOpacity>

              <View style={styles.audioProgressContainer}>
                <View style={[styles.audioProgressBar, isMe ? styles.audioProgressBarMe : styles.audioProgressBarTheir]}>
                  <View style={[
                    styles.audioProgressFill,
                    isMe ? styles.audioProgressFillMe : styles.audioProgressFillTheir,
                    { width: `${audioProgress[item.id.toString()] || 0}%` }
                  ]} />
                </View>
                <Text style={[styles.audioDuration, isMe ? styles.myText : styles.theirText]}>
                  {item.content?.match(/\((\d+)s\)/)?.[1] || '0'}s
                </Text>
              </View>
            </View>
          )}

          {/* TEXTE */}
          {item.type !== 'audio' && (
            <Text style={[styles.msgText, isMe ? styles.myText : styles.theirText]}>
              {item.content}
            </Text>
          )}

          <Text style={[styles.msgTime, isMe ? styles.myTime : styles.theirTime]}>
            {formatTime(item.timestamp)}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={24} color="#0f172a" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowProfile(true)}>
          <Image
            source={{ uri: chatWith.avatar || `https://i.pravatar.cc/150?u=${chatWith.id}` }}
            style={styles.avatar}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerInfo} onPress={() => setShowProfile(true)}>
          <Text style={styles.name}>{chatWith.username}</Text>
          <Text style={styles.status}>
            {isTyping
              ? '✍️ En train d\'écrire...'
              : (isUserOnline ? '🟢 En ligne' : '⚫ Hors ligne')
            }
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleCall} style={styles.headerAction}>
          <Phone size={22} color="#2563eb" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerAction}>
          <Settings size={22} color="#64748b" />
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputSection}>
          {isBlocked ? (
            <TouchableOpacity
              style={[styles.sendBtn, { flex: 1, backgroundColor: '#ef4444' }]}
              onPress={handleUnblockUser}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Débloquer</Text>
            </TouchableOpacity>
          ) :
            isRecording ? (
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
                      socketService.emitTyping(otherUserId, false);
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

      {/* Modal Settings */}
      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Options</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.clearBtn} onPress={handleClearChat}>
              <Trash2 size={22} color="#f97316" />
              <Text style={styles.clearBtnText}>Vider la discussion</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.blockBtn} onPress={isBlocked ? handleUnblockUser : handleBlockUser}>
              <UserX size={22} color="#ef4444" />
              <Text style={styles.blockBtnText}>{isBlocked ? 'Débloquer' : 'Bloquer'} {chatWith.username}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Profile */}
      <Modal visible={showProfile} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.profileModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profil</Text>
              <TouchableOpacity onPress={() => setShowProfile(false)}>
                <X size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <View style={styles.profileAvatarContainer}>
              <Image
                source={{ uri: chatWith.avatar || `https://i.pravatar.cc/150?u=${chatWith.id}` }}
                style={styles.profileAvatar}
              />
              <View style={[
                styles.onlineIndicator,
                { backgroundColor: isUserOnline ? '#22c55e' : '#94a3b8' }
              ]} />
            </View>

            <View style={styles.profileInfoSection}>
              <Text style={styles.profileName}>{chatWith.username}</Text>
              <Text style={styles.profileStatus}>
                {isUserOnline ? '🟢 En ligne' : '⚫ Hors ligne'}
              </Text>

              {userDetails?.bio && userDetails.bio.trim() !== '' ? (
                <View style={styles.bioContainer}>
                  <Text style={styles.bioLabel}>Bio</Text>
                  <Text style={styles.bioText}>{userDetails.bio}</Text>
                </View>
              ) : (
                <View style={styles.bioContainer}>
                  <Text style={styles.bioLabel}>Bio</Text>
                  <Text style={[styles.bioText, { fontStyle: 'italic', color: '#94a3b8' }]}>
                    Aucune biographie
                  </Text>
                </View>
              )}

              <View style={styles.profileActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    setShowProfile(false);
                    handleCall();
                  }}
                >
                  <Phone size={20} color="#2563eb" />
                  <Text style={styles.actionBtnText}>Appeler</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.blockActionBtn]}
                  onPress={() => {
                    setShowProfile(false);
                    handleBlockUser();
                  }}
                >
                  <UserX size={20} color="#ef4444" />
                  <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Bloquer</Text>
                </TouchableOpacity>
              </View>
            </View>
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
    padding: 10,
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
  msgTime: { fontSize: 10, marginTop: 6, fontWeight: '500' },
  myTime: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right'
  },
  theirTime: {
    color: '#94a3b8'
  },
  msgImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
    marginBottom: 2
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 5,
    padding: 3,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 10,
  },
  fileText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 0,
    minWidth: 180,
    borderRadius: 12,
    marginVertical: 0,
  },
  audioBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  audioBtnMe: {
    backgroundColor: '#fff',
  },
  audioBtnTheir: {
    backgroundColor: '#2563eb',
  },
  playIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 3,
  },
  playIconMe: {
    borderLeftColor: '#2563eb',
  },
  playIconTheir: {
    borderLeftColor: '#fff',
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBar: {
    width: 3,
    height: 14,
    borderRadius: 1.5,
  },
  pauseBarMe: {
    backgroundColor: '#2563eb',
  },
  pauseBarTheir: {
    backgroundColor: '#fff',
  },
  audioProgressContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  audioProgressBar: {
    height: 4,
    borderRadius: 2,
    width: '100%',
  },
  audioProgressBarMe: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  audioProgressBarTheir: {
    backgroundColor: '#e2e8f0',
  },
  audioProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  audioProgressFillMe: {
    backgroundColor: '#fff',
  },
  audioProgressFillTheir: {
    backgroundColor: '#2563eb',
  },
  audioDuration: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.8,
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
  attachBtn: {
    padding: 8
  },
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
  micBtn: {
    backgroundColor: '#64748b'
  },
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
    gap: 12
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444'
  },
  recordingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444'
  },
  stopBtn: {
    padding: 8
  },
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
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    padding: 18,
    backgroundColor: '#fff7ed',
    borderRadius: 15,
    marginBottom: 12,
  },
  clearBtnText: {
    color: '#f97316',
    fontWeight: 'bold',
    fontSize: 16
  },
  blockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    padding: 18,
    backgroundColor: '#fef2f2',
    borderRadius: 15,
  },
  blockBtnText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 16
  },
  profileModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    maxHeight: '80%',
  },
  profileAvatarContainer: {
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 25,
    position: 'relative',
  },
  profileAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#2563eb',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileInfoSection: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  profileStatus: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  bioContainer: {
    width: '100%',
    backgroundColor: '#f8fafc',
    padding: 15,
    borderRadius: 15,
    marginBottom: 25,
  },
  bioLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  bioText: {
    fontSize: 15,
    color: '#0f172a',
    lineHeight: 22,
  },
  profileActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 15,
  },
  blockActionBtn: {
    backgroundColor: '#fef2f2',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
  },
});

export default ChatPrivateView;