import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

const db = SQLite.openDatabaseSync('chatapp.db');

interface AuthProps {
  onLoginSuccess: (user: any) => void;
}

/* ================= UTILITAIRES ================= */

// 🔐 Hash password (SHA-256)
const hashPassword = async (password: string) => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
};

// 📧 Validation email
const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// 🔑 Validation mot de passe
const isStrongPassword = (password: string) =>
  password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

/* ================= COMPONENT ================= */

const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert("Erreur", "Tous les champs sont obligatoires.");
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert("Erreur", "Adresse email invalide.");
      return;
    }

    if (!isStrongPassword(password)) {
      Alert.alert(
        "Mot de passe faible",
        "Minimum 8 caractères avec au moins une lettre et un chiffre."
      );
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const hashedPassword = await hashPassword(password);

    try {
      if (isLogin) {
        // 🔐 LOGIN
        const user = db.getFirstSync(
          'SELECT * FROM users WHERE email = ? AND password = ? LIMIT 1',
          [cleanEmail, hashedPassword]
        );

        if (!user) {
          Alert.alert("Erreur", "Email ou mot de passe incorrect.");
          return;
        }

        onLoginSuccess(user);

      } else {
        // 🔐 REGISTER
        const exists = db.getFirstSync(
          'SELECT id FROM users WHERE email = ?',
          [cleanEmail]
        );

        if (exists) {
          Alert.alert("Erreur", "Cet email est déjà utilisé.");
          return;
        }

        const userId = Math.random().toString(36).substring(2, 11);
        const avatar = `https://i.pravatar.cc/150?u=${userId}`;

        db.runSync(
          `INSERT INTO users (id, username, email, password, avatar, bio)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, name, cleanEmail, hashedPassword, avatar, "Disponible"]
        );

        Alert.alert("Succès", "Compte créé avec succès !");
        onLoginSuccess({
          id: userId,
          username: name,
          email: cleanEmail,
          avatar
        });
      }

    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Problème lors de l'authentification.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <MaterialIcons name="chat" size={40} color="white" />
        <Text style={styles.title}>MNS ChatApp</Text>
        <Text style={styles.subtitle}>
         Connectez-vous, discutez, partagez !
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, isLogin && styles.active]}
            onPress={() => setIsLogin(true)}
          >
            <Text style={isLogin ? styles.activeText : styles.text}>Connexion</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, !isLogin && styles.active]}
            onPress={() => setIsLogin(false)}
          >
            <Text style={!isLogin ? styles.activeText : styles.text}>Inscription</Text>
          </TouchableOpacity>
        </View>

        {!isLogin && (
          <TextInput
            placeholder="Nom complet"
            style={styles.input}
            value={name}
            onChangeText={setName}
          />
        )}

        <TextInput
          placeholder="Email"
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          placeholder="Mot de passe"
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>
            {isLogin ? 'Se connecter' : "S'inscrire"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default Auth;

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2563eb', justifyContent: 'center', padding: 20 },
  header: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: 'white' },
  subtitle: { color: '#e0e7ff', fontSize: 13 },
  card: { backgroundColor: 'white', borderRadius: 20, padding: 20 },
  tabs: { flexDirection: 'row', marginBottom: 15 },
  tab: { flex: 1, padding: 10, alignItems: 'center' },
  active: { borderBottomWidth: 2, borderColor: '#2563eb' },
  text: { color: '#64748b' },
  activeText: { color: '#2563eb', fontWeight: 'bold' },
  input: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 12, marginBottom: 10 },
  button: { backgroundColor: '#2563eb', padding: 15, borderRadius: 10 },
  buttonText: { color: 'white', fontWeight: 'bold', textAlign: 'center' }
});
