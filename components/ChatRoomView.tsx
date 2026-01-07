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
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { 
  getGroupMessages, 
  saveGroupMessage, 
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  getAllUsers,
  updateGroupName,
  deleteGroup,
  deleteGroupMessageLocal,
  deleteGroupMessageForAll
} from '../services/api';
import socketService from '../services/socketService';
import { API_URL } from '../config/api';

interface ChatRoomViewProps {
  room: any;
  me: any;
  onBack: () => void;
  isDarkMode?: boolean;
}

const ChatRoomView: React.FC<ChatRoomViewProps> = ({ room, me, onBack, isDarkMode = false }) => {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [editedName, setEditedName] = useState(room.name);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [members, setMembers] = useState<any[]>([]);
  const [admins, setAdmins] = useState<string[]>([]);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null); 
  const [audioProgress, setAudioProgress] = useState<{ [key: string]: number }>({});
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const isAdmin = admins.includes(me.id);

  useEffect(() => {
    loadMessages();
    loadMembers();
    loadAllUsers();

    // Rejoindre le groupe Socket.io
    socketService.joinGroup(room.id.toString());
    console.log(`👥 Rejoint le groupe Socket.io: ${room.id}`);

    // Écouter les nouveaux messages de groupe
    socketService.onGroupMessage((newMessage) => {
      console.log('📩 Nouveau message de groupe reçu');
      
      if (newMessage.groupId.toString() === room.id.toString()) {
        loadMessages();
        
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });

    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    return () => {
      socketService.leaveGroup(room.id.toString());
      console.log(`❌ Quitté le groupe Socket.io: ${room.id}`);
      
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(err => console.log("Cleanup error", err));
      }
    };
  }, [room.id]);

  const loadMessages = async () => {
    try {
      const res = await fetch(`${API_URL}/groups/${room.id}/messages?userId=${me.id}`);
      const response = await res.json();
      
      if (response.success && response.messages) {
        const messagesWithTimestamp = response.messages.map(msg => ({
          ...msg,
          timestamp: parseInt(msg.timestamp) || Date.now()
        }));
        
        setMessages(messagesWithTimestamp);
        console.log(`${messagesWithTimestamp.length} messages chargés`);
      }
    } catch (error) {
      console.error('Erreur chargement messages:', error);
      Alert.alert('Erreur', 'Impossible de charger les messages');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const response = await getGroupMembers(room.id.toString());
      
      if (response.success && response.members) {
        const membersList = response.members.map((m: any) => m.id);
        const adminsList = response.members.filter((m: any) => m.role === 'admin').map((m: any) => m.id);
        
        setMembers(membersList);
        setAdmins(adminsList);
        console.log(`✅ ${membersList.length} membres chargés`);
      }
    } catch (error) {
      console.error('❌ Erreur chargement membres:', error);
    }
  };

  const loadAllUsers = async () => {
    try {
      const response = await getAllUsers();
      
      if (response.success && response.users) {
        setAllUsers(response.users);
      }
    } catch (error) {
      console.error('❌ Erreur chargement utilisateurs:', error);
    }
  };

  // ========== FONCTION D'UPLOAD ==========
  const uploadFile = async (localUri: string, type: 'image' | 'audio' | 'file', fileName: string) => {
    try {
      setIsUploading(true);

      // Attendre un peu avant de commencer (évite les conflits)
      await new Promise(resolve => setTimeout(resolve, 100));

      const formData = new FormData();
      
      let mimeType = 'application/octet-stream';
      if (type === 'image') {
        mimeType = localUri.endsWith('.png') ? 'image/png' : 'image/jpeg';
      } else if (type === 'audio') {
        mimeType = 'audio/m4a';
      }

      formData.append('file', {
        uri: localUri,
        type: mimeType,
        name: fileName,
      } as any);

      console.log('📤 Upload vers:', `${API_URL}/uploads`);
      console.log('📤 Détails:', { fileName, type, mimeType });

      // Créer une nouvelle requête avec AbortController pour gérer les timeouts
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 secondes timeout

      const response = await fetch(`${API_URL}/uploads`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('📥 Status HTTP:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erreur serveur:', errorText);
        throw new Error(`Erreur HTTP ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const responseText = await response.text();
      console.log('📥 Réponse brute:', responseText.substring(0, 200));

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Erreur parsing JSON:', parseError);
        console.error('📄 Réponse complète:', responseText);
        throw new Error('Réponse serveur invalide (pas du JSON)');
      }

      if (data.success && data.fileUrl) {
        console.log('✅ Fichier uploadé:', data.fileUrl);
        return data.fileUrl;
      } else {
        throw new Error('Upload échoué: ' + (data.message || 'Raison inconnue'));
      }
    } catch (error: any) {
      console.error('❌ Erreur upload fichier:', error);
      
      let errorMessage = "Impossible d'envoyer le fichier";
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout: Le serveur met trop de temps à répondre';
      } else if (error.message?.includes('Network request failed')) {
        errorMessage = 'Erreur réseau. Vérifiez votre connexion et que le serveur est démarré.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Erreur Upload', errorMessage);
      return null;
    } finally {
      setIsUploading(false);
    }
  };
// ========== FONCTIONS DE SUPPRESSION ==========
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
    await deleteGroupMessageLocal(me.id, messageId);
    setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
    console.log('🗑️ Message masqué localement');
  } catch (error) {
    console.error("❌ Erreur suppression locale:", error);
    Alert.alert('Erreur', 'Impossible de supprimer le message');
  }
};

const handleDeleteMessageForEveryone = async (messageId: number) => {
  try {
    await deleteGroupMessageForAll(messageId);

    // Émettre l'événement de suppression via Socket.io
    socketService.emitDeleteMessage({
      messageId: messageId,
      groupId: room.id.toString()
    });

    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.id === messageId
          ? { ...msg, content: 'Ce message a été supprimé', is_deleted: 1 }
          : msg
      )
    );

    console.log('✅ Message supprimé pour tous');
  } catch (error) {
    console.error("❌ Erreur suppression pour tous:", error);
    Alert.alert("Erreur", "Impossible de supprimer le message.");
  }
};
  const handleSendMessage = async (
    content: string, 
    type: string = 'text', 
    fileName: string | null = null, 
    fileUrl: string | null = null
  ) => {
    if (!content.trim() && type === 'text') return;

    try {
      const timestamp = Date.now();

      const messageData = {
        groupId: room.id.toString(),
        senderId: me.id,
        content,
        type,
        fileName: fileName || undefined,
        fileUrl: fileUrl || undefined,
        imageUrl: type === 'image' ? fileUrl || undefined : undefined,
        audioUrl: type === 'audio' ? fileUrl || undefined : undefined,
        timestamp
      };

      // Sauvegarder dans la DB via API
      await saveGroupMessage(messageData);

      // Envoyer via Socket.io
      socketService.sendGroupMessage(messageData);

      console.log('✅ Message de groupe envoyé');
      
      loadMessages();

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
      Alert.alert('Erreur', "Impossible d'envoyer le message");
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
      console.error('❌ Erreur lecture audio:', error);
      Alert.alert('Erreur', 'Impossible de lire le message vocal');
      setPlayingAudio(null);
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
    // Attendre un peu avant l'upload
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const fileUrl = await uploadFile(result.assets[0].uri, 'image', 'photo.jpg');
    if (fileUrl) {
      await handleSendMessage('📷 Image', 'image', 'photo.jpg', fileUrl);
    }
  }
};

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (!result.canceled && result.assets) {
      const file = result.assets[0];
      
      // Attendre un peu avant l'upload
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const fileUrl = await uploadFile(file.uri, 'file', file.name);
      if (fileUrl) {
        await handleSendMessage(`📎 ${file.name}`, 'file', file.name, fileUrl);
      }
    }
  };

const startRecording = async () => {
  try {
    // Nettoyer tout enregistrement existant avant d'en créer un nouveau
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (e) {
        console.log('Nettoyage enregistrement précédent:', e);
      }
      recordingRef.current = null;
    }

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
    console.error('❌ Erreur enregistrement:', err);
    Alert.alert('Erreur', "Impossible de démarrer l'enregistrement");
    // Réinitialiser l'état en cas d'erreur
    setIsRecording(false);
    recordingRef.current = null;
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
      // Attendre un peu avant l'upload
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const fileName = `audio_${Date.now()}.m4a`;
      const fileUrl = await uploadFile(uri, 'audio', fileName);
      if (fileUrl) {
        await handleSendMessage(
          `🎤 Message vocal (${recordingDuration}s)`,
          'audio',
          fileName,
          fileUrl
        );
      }
    }

    recordingRef.current = null;
    setRecordingDuration(0);
  } catch (err) {
    console.error('❌ Erreur arrêt enregistrement:', err);
    Alert.alert('Erreur', "Impossible d'envoyer le message vocal");
  }
};

  const handleSaveSettings = async () => {
    try {
      await updateGroupName(room.id.toString(), editedName);
      Alert.alert('Succès', 'Nom du groupe modifié');
      setShowSettings(false);
      room.name = editedName;
    } catch (error) {
      console.error('❌ Erreur mise à jour:', error);
      Alert.alert('Erreur', 'Impossible de modifier le nom');
    }
  };

  const handleAddMember = async (userId: string) => {
    try {
      await addGroupMember(room.id.toString(), userId, 'member');
      loadMembers();
      setShowAddMember(false);
      Alert.alert('Succès', 'Membre ajouté');
    } catch (error) {
      console.error('❌ Erreur ajout membre:', error);
      Alert.alert('Erreur', "Impossible d'ajouter le membre");
    }
  };

  const handleRemoveMember = (userId: string) => {
    Alert.alert(
      "Retirer le membre",
      "Voulez-vous retirer ce membre du groupe ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: async () => {
            try {
              await removeGroupMember(room.id.toString(), userId);
              loadMembers();
              Alert.alert('Succès', 'Membre retiré');
            } catch (error) {
              console.error('❌ Erreur retrait membre:', error);
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
      "Voulez-vous vraiment quitter ce groupe ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Quitter",
          style: "destructive",
          onPress: async () => {
            try {
              await removeGroupMember(room.id.toString(), me.id);
              socketService.leaveGroup(room.id.toString());
              Alert.alert('Succès', 'Vous avez quitté le groupe');
              onBack();
            } catch (error) {
              console.error('❌ Erreur quitter groupe:', error);
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
      "Cette action est irréversible. Tous les messages seront perdus.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteGroup(room.id.toString());
              socketService.leaveGroup(room.id.toString());
              Alert.alert('Succès', 'Groupe supprimé');
              onBack();
            } catch (error) {
              console.error('❌ Erreur suppression:', error);
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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getUserInfo = (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    return user || { 
      id: userId,
      username: 'Utilisateur', 
      avatar: `https://i.pravatar.cc/150?u=${userId}` 
    };
  };

  const getAvailableUsers = () => {
    return allUsers.filter(u => !members.includes(u.id) && u.id !== me.id);
  };

  const handleDeleteMessage = (messageId: number) => {
    Alert.alert(
      "Supprimer le message",
      "Voulez-vous vraiment supprimer ce message ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              // TODO: Implémenter deleteGroupMessage dans l'API
              Alert.alert('Info', 'Fonction de suppression à implémenter côté serveur');
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer le message');
            }
          }
        }
      ]
    );
  };

const renderMessage = ({ item }: { item: any }) => {
  const isMe = item.senderId === me.id;
  const sender = getUserInfo(item.senderId);

  return (
    <View style={[styles.msgWrapper, isMe ? styles.myMsgWrapper : styles.theirMsgWrapper]}>
      {!isMe && (
        <Image source={{ uri: sender.avatar }} style={styles.senderAvatar} />
      )}

      <TouchableOpacity
        style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}
        onLongPress={() => showDeleteOptions(item)}
        delayLongPress={300}
        activeOpacity={0.8}
      >
        {!isMe && (
          <Text style={styles.senderName}>{sender.username}</Text>
        )}

        {/* IMAGE */}
        {item.type === 'image' && item.imageUrl && (
          <Image source={{ uri: item.imageUrl }} style={styles.msgImage} resizeMode="cover" />
        )}

        {/* FILE */}
        {item.type === 'file' && (
          <View style={styles.fileContainer}>
            <MaterialIcons name="attach-file" size={20} color={isMe ? "#fff" : "#2563eb"} />
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
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ marginTop: 20, color: '#64748b' }}>Chargement des messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Image source={{ uri: room.avatar || `https://picsum.photos/seed/${room.id}/200` }} style={styles.avatar} />
        
        <TouchableOpacity 
          style={styles.headerInfo}
          onPress={() => setShowMembers(true)}
        >
          <Text style={styles.name}>{room.name}</Text>
          <Text style={styles.status}>{members.length} membres</Text>
        </TouchableOpacity>

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
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {/* Zone d'envoi */}
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
                    handleSendMessage(inputText.trim());
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

      {/* Indicateur d'upload */}
      {isUploading && (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.uploadingText}>Upload en cours...</Text>
        </View>
      )}

      {/* Modal liste des membres */}
      <Modal visible={showMembers} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Membres ({members.length})</Text>
              <TouchableOpacity onPress={() => setShowMembers(false)}>
                <MaterialIcons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {members.map(memberId => {
                const user = getUserInfo(memberId);
                const isMemberAdmin = admins.includes(memberId);
                
                return (
                  <View key={memberId} style={styles.memberItem}>
                    <Image source={{ uri: user.avatar }} style={styles.memberAvatar} />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {user.username} {memberId === me.id ? '(Vous)' : ''}
                      </Text>
                      <Text style={styles.memberRole}>
                        {isMemberAdmin ? '👑 Administrateur' : 'Membre'}
                      </Text>
                    </View>
                    
                    {isAdmin && memberId !== me.id && (
                      <TouchableOpacity
                        onPress={() => {
                          setShowMembers(false);
                          setTimeout(() => handleRemoveMember(memberId), 300);
                        }}
                        style={styles.removeMemberBtn}
                      >
                        <MaterialIcons name="person-remove" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Settings */}
      <Modal visible={showSettings} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gestion du Groupe</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <MaterialIcons name="close" size={24} color="#000" />
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
                    <MaterialIcons name="check" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>Sauvegarder</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Membres ({members.length})</Text>
                {isAdmin && (
                  <TouchableOpacity onPress={() => setShowAddMember(true)} style={styles.addMemberBtn}>
                    <MaterialIcons name="person-add" size={20} color="#2563eb" />
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
                        {admins.includes(memberId) ? 'Administrateur' : 'Membre'}
                      </Text>
                    </View>
                    {isAdmin && memberId !== me.id && (
                      <TouchableOpacity
                        onPress={() => handleRemoveMember(memberId)}
                        style={styles.removeMemberBtn}
                      >
                        <MaterialIcons name="person-remove" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              <View style={styles.actionsContainer}>
                {!isAdmin && (
                  <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveRoom}>
                    <MaterialIcons name="logout" size={20} color="#ef4444" />
                    <Text style={styles.leaveBtnText}>Quitter le groupe</Text>
                  </TouchableOpacity>
                )}

                {isAdmin && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteRoom}>
                    <MaterialIcons name="delete" size={20} color="#fff" />
                    <Text style={styles.deleteBtnText}>Supprimer le groupe</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Modal Add Member */}
        <Modal visible={showAddMember} animationType="fade" transparent={true}>
          <View style={styles.innerModalOverlay}>
            <View style={styles.innerModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ajouter un membre</Text>
                <TouchableOpacity onPress={() => setShowAddMember(false)}>
                  <MaterialIcons name="close" size={24} color="#000" />
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
                    <MaterialIcons name="person-add" size={20} color="#2563eb" />
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

// Styles (les mêmes que précédemment + ajout de uploadingContainer)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
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
    padding: 2,
    minWidth: 180,
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
    gap: 4,
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
  msgTime: { fontSize: 10, marginTop: 6, fontWeight: '500' },
  myTime: { color: 'rgba(255,255,255,0.8)', textAlign: 'right' },
  theirTime: { color: '#94a3b8' },
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
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#eff6ff',
    gap: 10,
  },
  uploadingText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
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
    minHeight: '60%',
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  addMemberBtn: {
    padding: 8
  },
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
  emptyText: { 
    textAlign: 'center', 
    color: '#94a3b8', 
    padding: 20 
  },
});

export default ChatRoomView;