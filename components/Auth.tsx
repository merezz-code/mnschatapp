import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { LogIn, Mail, Lock, User as UserIcon, ArrowRight } from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import ForgotPassword from './ForgotPassword';
import { registerUser, loginUser } from '../services/api';

interface AuthProps {
  onLoginSuccess: (user: any) => void;
}

// 🔐 Hash password
const hashPassword = async (password: string) => {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
};

// 📧 Validation email
const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// 🔑 Validation mot de passe
const isStrongPassword = (password: string) =>
  password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgot, setShowForgot] = useState(false);
  const [loading, setLoading] = useState(false);

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

    setLoading(true);

    try {
      if (isLogin) {
        // 🔑 CONNEXION via API
        const response = await loginUser(cleanEmail, hashedPassword);
        
        if (response.success && response.user) {
          Alert.alert("Succès", "Connexion réussie !");
          onLoginSuccess(response.user);
        } else {
          Alert.alert("Erreur", "Email ou mot de passe incorrect.");
        }
      } else {
        // 📝 INSCRIPTION via API
        const response = await registerUser(name, cleanEmail, hashedPassword);
        
        if (response.success && response.user) {
          Alert.alert("Succès", "Compte créé avec succès !");
          onLoginSuccess(response.user);
        } else {
          Alert.alert("Erreur", response.error || "Impossible de créer le compte.");
        }
      }
    } catch (error: any) {
      console.error("Erreur authentification:", error);
      
      if (error.message.includes('fetch')) {
        Alert.alert(
          "Erreur de connexion",
          "Impossible de se connecter au serveur. Vérifiez que le serveur est démarré."
        );
      } else {
        Alert.alert("Erreur", error.message || "Problème lors de l'authentification.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Afficher ForgotPassword si demandé
  if (showForgot) {
    return <ForgotPassword onBack={() => setShowForgot(false)} />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.logoContainer}><LogIn size={40} color="#fff" /></View>
        <Text style={styles.title}>Mns ChatApp</Text>
        <Text style={styles.subtitle}>Connectez-vous, discutez, partagez !</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            onPress={() => setIsLogin(true)}
            style={[styles.toggleBtn, isLogin && styles.activeToggle]}
          >
            <Text style={[styles.toggleText, isLogin && styles.activeToggleText]}>Connexion</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsLogin(false)}
            style={[styles.toggleBtn, !isLogin && styles.activeToggle]}
          >
            <Text style={[styles.toggleText, !isLogin && styles.activeToggleText]}>Inscription</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {!isLogin && (
            <View style={styles.inputContainer}>
              <UserIcon size={20} color="#94a3b8" />
              <TextInput
                style={styles.input}
                placeholder="Nom complet"
                value={name}
                onChangeText={setName}
                editable={!loading}
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Mail size={20} color="#94a3b8" />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={20} color="#94a3b8" />
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <TouchableOpacity 
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]} 
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitText}>
              {loading ? 'Chargement...' : (isLogin ? 'Se connecter' : "S'inscrire")}
            </Text>
            {!loading && <ArrowRight size={20} color="#fff" />}
          </TouchableOpacity>

          {isLogin && (
            <TouchableOpacity onPress={() => setShowForgot(true)} disabled={loading}>
              <Text style={{ color: '#2563eb', marginTop: 10 }}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2563eb', justifyContent: 'center', padding: 30 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoContainer: { width: 80, height: 80, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 40, fontWeight: '900', color: '#fff' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 35, padding: 30, elevation: 10 },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 15, padding: 5, marginBottom: 30 },
  toggleBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  activeToggle: { backgroundColor: '#fff', elevation: 2 },
  toggleText: { fontSize: 14, fontWeight: 'bold', color: '#64748b' },
  activeToggleText: { color: '#2563eb' },
  form: { gap: 15 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 15, paddingHorizontal: 15 },
  input: { flex: 1, height: 55, marginLeft: 10, fontSize: 14 },
  submitBtn: { flexDirection: 'row', backgroundColor: '#2563eb', height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
  submitBtnDisabled: { backgroundColor: '#94a3b8' },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default Auth;