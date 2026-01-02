import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as SQLite from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';

const db = SQLite.openDatabaseSync('chatapp.db');

const ProfileView = ({ userId, isDarkMode=false, onLogout }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('https://via.placeholder.com/150');

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const loadUserData = () => {
    try {
      const user = db.getFirstSync('SELECT * FROM users WHERE id = ?', [userId]);
      if (user) {
        setName(user.username);
        setBio(user.bio || '');
        setAvatar(user.avatar || 'https://via.placeholder.com/150');
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleSave = () => {
    try {
      db.runSync('UPDATE users SET username=?, bio=?, avatar=? WHERE id=?', [name, bio, avatar, userId]);
      Alert.alert("Profil mis à jour !");
      setIsEditing(false);
    } catch (error) { console.error(error); }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (!result.cancelled) setAvatar(result.uri);
  };

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
      { text:"Annuler", style:"cancel" },
      { text:"Oui", onPress: onLogout }
    ]);
  };

  if (loading) return <View style={styles.container}><Text>Chargement...</Text></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={[styles.container, {backgroundColor: isDarkMode?'#0f172a':'#f8fafc'}]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, {color: isDarkMode?'white':'#0f172a'}]}>Mon Profil</Text>

        <View style={styles.avatarWrapper}>
          <Image source={{uri: avatar}} style={styles.avatarImage}/>
          <TouchableOpacity style={styles.cameraOverlay} onPress={pickImage}>
            <Feather name="camera" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {!isEditing ? (
          <View style={styles.infoSection}>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, {color: isDarkMode?'white':'#1e293b'}]}>{name}</Text>
              <TouchableOpacity onPress={()=>setIsEditing(true)} style={styles.editBtn}>
                <Feather name="edit-2" size={16} color="#2563eb"/>
              </TouchableOpacity>
            </View>
            <Text style={styles.bioText}>{bio || "Aucune biographie."}</Text>

            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Feather name="log-out" size={20} color="#dc2626"/>
              <Text style={styles.logoutText}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.editForm}>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nom" />
            <TextInput style={[styles.input, {height:80}]} value={bio} onChangeText={setBio} placeholder="Bio" multiline />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={{color:'white'}}>Sauvegarder</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container:{flex:1},
  scrollContent:{padding:25, alignItems:'center', paddingTop:50},
  title:{fontSize:32,fontWeight:'900', marginBottom:20},
  avatarWrapper:{width:140,height:140,borderRadius:70,overflow:'hidden',borderWidth:3,borderColor:'#2563eb', marginBottom:30},
  avatarImage:{width:'100%',height:'100%'},
  cameraOverlay:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,0.2)',justifyContent:'center',alignItems:'center'},
  infoSection:{width:'100%',alignItems:'center'},
  nameRow:{flexDirection:'row',alignItems:'center',gap:10},
  userName:{fontSize:24,fontWeight:'bold'},
  editBtn:{padding:8,backgroundColor:'#eff6ff',borderRadius:20},
  bioText:{color:'#64748b',marginVertical:15},
  logoutBtn:{flexDirection:'row',marginTop:40,padding:15,backgroundColor:'#fef2f2',borderRadius:15,width:'100%',justifyContent:'center',alignItems:'center',gap:10},
  logoutText:{color:'#dc2626',fontWeight:'bold'},
  editForm:{width:'100%'},
  input:{width:'100%',borderWidth:1,borderColor:'#e2e8f0',borderRadius:10,padding:12,marginVertical:10},
  saveBtn:{backgroundColor:'#2563eb',padding:15,borderRadius:10,alignItems:'center'}
});

export default ProfileView;
