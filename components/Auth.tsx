import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('chatapp.db');

interface AuthProps {
  onLoginSuccess: (user: any) => void;
}

const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    // 1. Validation de base
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert("Attention", "Veuillez remplir tous les champs.");
      return;
    }

    const cleanEmail = email.toLowerCase().trim();

    try {
      if (isLogin) {
        // --- LOGIQUE DE CONNEXION : Vérifie Email ET Mot de passe ---
        const userFound = db.getFirstSync(
          'SELECT * FROM users WHERE email = ? AND password = ? LIMIT 1',
          [cleanEmail, password]
        );
        
        if (userFound) {
          onLoginSuccess(userFound);
        } else {
          // Aide l'utilisateur en vérifiant si l'email existe du tout
          const emailExists = db.getFirstSync('SELECT id FROM users WHERE email = ?', [cleanEmail]);
          if (!emailExists) {
            Alert.alert("Erreur", "Aucun compte trouvé avec cet email.");
          } else {
            Alert.alert("Erreur", "Mot de passe incorrect.");
          }
        }
      } else {
        // --- LOGIQUE D'INSCRIPTION : Enregistre l'email et le password ---
        const userId = Math.random().toString(36).substring(2, 11);
        const usernameFromEmail = cleanEmail.split('@')[0];
        const avatarUrl = `https://i.pravatar.cc/150?u=${userId}`;

        // Vérification si l'email est déjà pris
        const existingUser = db.getFirstSync('SELECT id FROM users WHERE email = ?', [cleanEmail]);
        
        if (existingUser) {
          Alert.alert("Erreur", "Cet email est déjà utilisé.");
          return;
        }

        // Insertion dans la base avec le champ 'password'
        db.runSync(
          'INSERT INTO users (id, username, email, password, avatar, bio) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, name || usernameFromEmail, cleanEmail, password, avatarUrl, "Disponible"]
        );

        const newUser = { id: userId, username: name || usernameFromEmail, avatar: avatarUrl, email: cleanEmail };
        Alert.alert("Succès", "Compte créé !");
        onLoginSuccess(newUser);
      }
    } catch (error) {
      console.error("Erreur Auth:", error);
      Alert.alert("Erreur", "Impossible d'accéder à la base de données. Assurez-vous d'avoir réinitialisé l'app pour inclure la colonne 'password'.");
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <MaterialIcons name="chat" size={40} color="white" />
        </View>
        <Text style={styles.title}>MNS ChatApp</Text>
        <Text style={styles.subtitle}>Connectez-vous, discutez, partagez</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, isLogin && styles.activeTab]} 
            onPress={() => setIsLogin(true)}
          >
            <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Connexion</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, !isLogin && styles.activeTab]} 
            onPress={() => setIsLogin(false)}
          >
            <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Inscription</Text>
          </TouchableOpacity>
        </View>

        {!isLogin && (
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color="#94a3b8" style={styles.icon} />
            <TextInput
              placeholder="Nom complet"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
              style={styles.input}
            />
          </View>
        )}

        <View style={styles.inputWrapper}>
          <MaterialIcons name="mail-outline" size={20} color="#94a3b8" style={styles.icon} />
          <TextInput
            placeholder="Email"
            placeholderTextColor="#94a3b8"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
        </View>

        <View style={styles.inputWrapper}>
          <MaterialIcons name="lock-outline" size={20} color="#94a3b8" style={styles.icon} />
          <TextInput
            placeholder="Mot de passe"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry // Cache le mot de passe
            style={styles.input}
          />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>
            {isLogin ? 'Se connecter' : "S'inscrire"}
          </Text>
          <MaterialIcons name="arrow-forward" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2563eb', padding: 20, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 30 },
  logoContainer: { width: 70, height: 70, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 28, fontWeight: '900', color: 'white' },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  card: { backgroundColor: 'white', borderRadius: 25, padding: 20, elevation: 4 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: 'white' },
  tabText: { color: '#64748b', fontWeight: 'bold' },
  activeTabText: { color: '#2563eb' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  icon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 12, color: '#0f172a' },
  submitButton: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  submitButtonText: { color: 'white', fontWeight: 'bold', marginRight: 10 }
});

export default Auth;