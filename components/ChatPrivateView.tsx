import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  FlatList, Image, KeyboardAvoidingView, Platform, SafeAreaView, 
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import EmojiPicker from 'emoji-picker-react'; // npm install emoji-picker-react
import { db } from '../services/database';

interface ChatPrivateViewProps {
  chatWith: { id: string; username: string; avatar: string };
  me: { id: string };
  onBack: () => void;
}

const ChatPrivateView = ({ chatWith, me, onBack }: ChatPrivateViewProps) => {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([]);
  const [recording, setRecording] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // --- CHARGEMENT DES MESSAGES PRIVÉS ---
  const loadMessages = useCallback(() => {
    try {
      const msgs = db.getAllSync(
        `SELECT * FROM private_messages 
         WHERE (sender_id = ? AND receiver_id = ?) 
            OR (sender_id = ? AND receiver_id = ?)
         ORDER BY timestamp ASC`,
        [me.id, chatWith.id, chatWith.id, me.id]
      );
      setMessages(msgs);
    } catch (err) { console.error(err); }
  }, [me.id, chatWith.id]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // --- ENVOI MESSAGE ---
  const sendMessage = (content, type = 'text', fileUri = null) => {
    const now = Date.now();
    try {
      db.runSync(
        `INSERT INTO private_messages (id, sender_id, receiver_id, content, type, file_url, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [`msg-${now}`, me.id, chatWith.id, content, type, fileUri, now]
      );
      loadMessages();
    } catch (err) { console.error(err); }
  };

  // --- PICK IMAGE ---
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled) sendMessage('Image', 'image', result.assets[0].uri);
  };

  // --- PICK DOCUMENT ---
  const pickDocument = async () => {
    let result = await DocumentPicker.getDocumentAsync({});
    if (!result.canceled) sendMessage(result.name, 'file', result.uri);
  };

  // --- AUDIO ---
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
    } catch (err) { console.error(err); }
  };

  const stopRecording = async () => {
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      sendMessage('Audio', 'audio', uri);
      setRecording(null);
    } catch (err) { console.error(err); }
  };

  // --- EMOJI PICKER ---
  const onEmojiClick = (emojiData) => {
    setInputText(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  // --- RENDER MESSAGE ---
  const renderMessage = ({ item }) => {
    const isMine = item.sender_id === me.id;
    return (
      <View style={[styles.messageContainer, isMine ? styles.myMessage : styles.theirMessage]}>
        {item.type === 'image' && <Image source={{ uri: item.file_url }} style={styles.messageImage} />}
        {item.type === 'file' && (
          <View style={styles.fileContainer}>
            <Ionicons name="document-attach" size={24} color={isMine ? "#fff" : "#2563eb"} />
            <Text style={{ color: isMine ? '#fff' : '#1e293b', marginLeft: 10 }}>{item.content}</Text>
          </View>
        )}
        {item.type === 'audio' && (
          <View style={styles.audioContainer}>
            <Ionicons name="mic" size={20} color={isMine ? "#fff" : "#2563eb"} />
            <Text style={{ color: isMine ? '#fff' : '#1e293b', marginLeft: 5 }}>Audio</Text>
          </View>
        )}
        {item.type === 'text' && <Text style={{ color: isMine ? '#fff' : '#1e293b' }}>{item.content}</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Ionicons name="arrow-back" size={28} color="#000" /></TouchableOpacity>
        <View style={styles.headerCenter}>
          <Image source={{ uri: chatWith.avatar }} style={styles.avatar} />
          <Text style={styles.headerTitle}>{chatWith.username}</Text>
        </View>
        <View style={{ width: 28 }} /> {/* Pour équilibre */}
      </View>

      {/* MESSAGES */}
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: 15 }}
        inverted
      />

      {/* EMOJI PICKER */}
      {showEmojiPicker && (
        <View style={{ height: 250 }}>
          <EmojiPicker onEmojiClick={onEmojiClick} />
        </View>
      )}

      {/* INPUT BAR */}
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined}>
        <View style={styles.inputBar}>
          <TouchableOpacity onPress={() => setShowEmojiPicker(prev => !prev)}>
            <Ionicons name="happy-outline" size={28} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity onPress={pickDocument}>
            <Ionicons name="document-attach" size={28} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity onPress={pickImage}>
            <Ionicons name="image-outline" size={28} color="#64748b" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            value={inputText}
            onChangeText={setInputText}
          />
          {inputText.trim() ? (
            <TouchableOpacity onPress={() => { sendMessage(inputText); setInputText(''); }} style={styles.sendBtn}>
              <Ionicons name="send" size={24} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={recording ? stopRecording : startRecording}
              style={[styles.sendBtn, { backgroundColor: recording ? "#ef4444" : "#2563eb" }]}
            >
              <Ionicons name="mic" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems:'center', padding:15, borderBottomWidth:1, borderColor:'#e2e8f0' },
  headerCenter:{ flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center' },
  avatar:{ width:40, height:40, borderRadius:20, marginRight:10 },
  headerTitle:{ fontSize:18, fontWeight:'bold' },
  messageContainer:{ padding:12, borderRadius:18, marginVertical:4, maxWidth:'75%' },
  myMessage:{ backgroundColor:'#2563eb', alignSelf:'flex-end', borderBottomRightRadius:2 },
  theirMessage:{ backgroundColor:'#fff', alignSelf:'flex-start', borderBottomLeftRadius:2, borderWidth:1, borderColor:'#e2e8f0' },
  messageImage:{ width:200, height:150, borderRadius:10 },
  fileContainer:{ flexDirection:'row', alignItems:'center' },
  audioContainer:{ flexDirection:'row', alignItems:'center' },
  inputBar:{ flexDirection:'row', padding:10, backgroundColor:'#fff', alignItems:'center', borderTopWidth:1, borderColor:'#e2e8f0' },
  input:{ flex:1, backgroundColor:'#f1f5f9', borderRadius:25, paddingHorizontal:15, paddingVertical:10, marginHorizontal:5 },
  sendBtn:{ width:40, height:40, borderRadius:20, justifyContent:'center', alignItems:'center', backgroundColor:'#2563eb' },
});

export default ChatPrivateView;
