
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Modal, Alert, ScrollView } from 'react-native';
import { ArrowLeft, Send, Mic, Phone, Paperclip, ImageIcon, Settings, X, Check, UserPlus, LogOut, Trash2, UserMinus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ChatRoom, Message, User } from '../types';
import { MOCK_USERS } from '../store';

interface ChatRoomViewProps {
  room: ChatRoom;
  messages: Message[];
  me: User;
  onBack: () => void;
  onSend: (content: string, type?: Message['type'], fileName?: string, fileUrl?: string) => void;
  onDelete: (id: string) => void;
  onCall: () => void;
  onUpdateRoom: (updated: ChatRoom) => void;
  onLeaveRoom: (id: string) => void;
  onDeleteRoom: (id: string) => void;
  onAddMember: (userId: string) => void;
  onRemoveMember: (userId: string) => void;
}

const ChatRoomView: React.FC<ChatRoomViewProps> = ({ 
  room, 
  messages, 
  me, 
  onBack, 
  onSend, 
  onCall, 
  onUpdateRoom,
  onLeaveRoom,
  onDeleteRoom,
  onAddMember,
  onRemoveMember
}) => {
  const [inputText, setInputText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editedName, setEditedName] = useState(room.name);
  const flatListRef = useRef<FlatList>(null);

  // Sécurisation des accès aux tableaux
  const admins = room.admins || [];
  const participants = room.participants || [];
  const isAdmin = admins.includes(me.id);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Accès aux photos nécessaire.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) {
      onSend("Image envoyée", 'image', 'photo.jpg', result.assets[0].uri);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (!result.canceled && result.assets) {
      onSend(`Fichier: ${result.assets[0].name}`, 'file', result.assets[0].name, result.assets[0].uri);
    }
  };

  const handleSaveSettings = () => {
    onUpdateRoom({ ...room, name: editedName });
    setShowSettings(false);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === me.id;
    const fileUrl = (item as any).fileUrl || (item as any).imageUrl;
    
    return (
      <View style={[styles.msgWrapper, isMe ? styles.myMsgWrapper : styles.theirMsgWrapper]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {item.type === 'image' && fileUrl && (
            <Image source={{ uri: fileUrl }} style={styles.msgImage} resizeMode="cover" />
          )}
          {item.type === 'file' && (
            <View style={styles.fileContainer}>
              <Paperclip size={20} color={isMe ? "#fff" : "#2563eb"} />
              <Text style={[styles.fileText, isMe ? styles.myText : styles.theirText]}>{item.fileName || 'Fichier'}</Text>
            </View>
          )}
          <Text style={[styles.msgText, isMe ? styles.myText : styles.theirText]}>{item.content}</Text>
          <Text style={[styles.msgTime, isMe ? styles.myTime : styles.theirTime]}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><ArrowLeft size={24} color="#0f172a" /></TouchableOpacity>
        <Image source={{ uri: room.avatar || 'https://picsum.photos/200' }} style={styles.avatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{room.name}</Text>
          <Text style={styles.status}>{participants.length} membres</Text>
        </View>
        <TouchableOpacity onPress={onCall} style={styles.headerAction}><Phone size={22} color="#2563eb" /></TouchableOpacity>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerAction}><Settings size={22} color="#64748b" /></TouchableOpacity>
      </View>

      <FlatList 
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputSection}>
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.attachBtn} onPress={pickDocument}><Paperclip size={20} color="#94a3b8" /></TouchableOpacity>
            <TextInput style={styles.input} placeholder="Message..." value={inputText} onChangeText={setInputText} multiline />
            <TouchableOpacity style={styles.attachBtn} onPress={pickImage}><ImageIcon size={20} color="#94a3b8" /></TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.sendBtn, !inputText.trim() && styles.micBtn]} onPress={() => { if (inputText.trim()) { onSend(inputText); setInputText(''); } }}>
            {inputText.trim() ? <Send size={24} color="#fff" /> : <Mic size={24} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showSettings} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gestion du Groupe</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}><X size={24} color="#000" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
                {isAdmin && (
                    <View style={styles.settingItem}>
                        <Text style={styles.settingLabel}>Nom du groupe</Text>
                        <TextInput style={styles.settingInput} value={editedName} onChangeText={setEditedName} />
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings}>
                            <Check size={20} color="#fff" />
                            <Text style={styles.saveBtnText}>Sauvegarder</Text>
                        </TouchableOpacity>
                    </View>
                )}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Membres ({participants.length})</Text>
                    {isAdmin && (
                        <TouchableOpacity onPress={() => setShowAddMember(true)} style={styles.addMemberBtn}><UserPlus size={20} color="#2563eb" /></TouchableOpacity>
                    )}
                </View>
                {participants.map(pid => {
                    const user = MOCK_USERS.find(u => u.id === pid) || { name: pid, avatar: 'https://picsum.photos/100' };
                    return (
                        <View key={pid} style={styles.memberItem}>
                            <Image source={{ uri: user.avatar }} style={styles.memberAvatar} />
                            <View style={styles.memberInfo}>
                                <Text style={styles.memberName}>{user.name} {pid === me.id ? '(Moi)' : ''}</Text>
                                <Text style={styles.memberRole}>{admins.includes(pid) ? 'Administrateur' : 'Membre'}</Text>
                            </View>
                            {isAdmin && pid !== me.id && (
                                <TouchableOpacity onPress={() => onRemoveMember(pid)} style={styles.removeMemberBtn}><UserMinus size={20} color="#ef4444" /></TouchableOpacity>
                            )}
                        </View>
                    );
                })}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity style={styles.leaveBtn} onPress={() => Alert.alert("Quitter", "Voulez-vous vraiment quitter ?", [{ text: "Non" }, { text: "Oui", onPress: () => onLeaveRoom(room.id) }])}>
                        <LogOut size={20} color="#ef4444" />
                        <Text style={styles.leaveBtnText}>Quitter le groupe</Text>
                    </TouchableOpacity>
                    {isAdmin && (
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => Alert.alert("Supprimer", "Action irréversible.", [{ text: "Non" }, { text: "Oui", onPress: () => onDeleteRoom(room.id) }])}>
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
                        <TouchableOpacity onPress={() => setShowAddMember(false)}><X size={24} color="#000" /></TouchableOpacity>
                    </View>
                    <ScrollView style={{ maxHeight: 300 }}>
                        {MOCK_USERS.filter(u => !participants.includes(u.id)).map(u => (
                            <TouchableOpacity key={u.id} style={styles.memberSelect} onPress={() => { onAddMember(u.id); setShowAddMember(false); }}>
                                <Image source={{ uri: u.avatar }} style={styles.memberAvatar} />
                                <Text style={styles.memberName}>{u.name}</Text>
                                <UserPlus size={20} color="#2563eb" />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 15, paddingTop: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn: { padding: 8 },
  avatar: { width: 40, height: 40, borderRadius: 15, marginLeft: 5 },
  headerInfo: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  status: { fontSize: 10, color: '#64748b', fontWeight: 'bold' },
  headerAction: { padding: 10 },
  list: { padding: 15, paddingBottom: 30 },
  msgWrapper: { marginBottom: 12, flexDirection: 'row' },
  myMsgWrapper: { justifyContent: 'flex-end' },
  theirMsgWrapper: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', padding: 12, borderRadius: 20 },
  myBubble: { backgroundColor: '#2563eb', borderBottomRightRadius: 2 },
  theirBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 2, elevation: 1 },
  msgText: { fontSize: 15 },
  myText: { color: '#fff' },
  theirText: { color: '#0f172a' },
  msgImage: { width: 200, height: 150, borderRadius: 15, marginBottom: 8 },
  fileContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5, padding: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 10 },
  fileText: { fontSize: 13, fontWeight: '500' },
  msgTime: { fontSize: 9, marginTop: 4, opacity: 0.6 },
  myTime: { color: '#fff', textAlign: 'right' },
  theirTime: { color: '#94a3b8' },
  inputSection: { flexDirection: 'row', padding: 12, alignItems: 'flex-end', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  inputContainer: { flex: 1, flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 25, paddingHorizontal: 10, alignItems: 'center', minHeight: 48 },
  input: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, fontSize: 15 },
  attachBtn: { padding: 10 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  micBtn: { backgroundColor: '#64748b' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, minHeight: '80%' },
  innerModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 20 },
  innerModalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
  addMemberBtn: { padding: 5 },
  settingItem: { marginBottom: 20 },
  settingLabel: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
  settingInput: { backgroundColor: '#f1f5f9', borderRadius: 15, padding: 15, fontSize: 16 },
  saveBtn: { backgroundColor: '#2563eb', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 15, gap: 10, marginTop: 10 },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
  memberItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, padding: 10, backgroundColor: '#f8fafc', borderRadius: 15 },
  memberAvatar: { width: 40, height: 40, borderRadius: 10 },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 14, fontWeight: 'bold' },
  memberRole: { fontSize: 11, color: '#94a3b8' },
  removeMemberBtn: { padding: 10 },
  memberSelect: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  actionsContainer: { marginTop: 30, gap: 15 },
  leaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 20, gap: 10, borderColor: '#ef4444', backgroundColor: '#fff', borderWidth: 1 },
  leaveBtnText: { color: '#ef4444', fontWeight: 'bold' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 20, gap: 10, backgroundColor: '#ef4444' },
  deleteBtnText: { color: '#fff', fontWeight: 'bold' }
});

export default ChatRoomView;
