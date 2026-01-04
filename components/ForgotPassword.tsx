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
import { ArrowLeft, Mail, Lock } from 'lucide-react-native';
import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

const db = SQLite.openDatabaseSync('chatapp.db');

interface ForgotPasswordProps {
  onBack: () => void;
}

const hashPassword = async (password: string) => {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
};

const isStrongPassword = (password: string) =>
  password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1); // 1 = vérifier email, 2 = nouveau mot de passe

  const checkEmail = () => {
    const user = db.getFirstSync('SELECT * FROM users WHERE email = ?', [email.trim()]);
    if (!user) {
      Alert.alert('Erreur', "Cet email n'existe pas dans la base.");
      return;
    }
    setStep(2);
  };

  const handleResetPassword = async () => {
    if (!isStrongPassword(newPassword)) {
      Alert.alert('Erreur', 'Mot de passe trop faible : minimum 8 caractères avec lettres et chiffres.');
      return;
    }

    const hashed = await hashPassword(newPassword);
    db.runSync('UPDATE users SET password = ? WHERE email = ?', [hashed, email.trim()]);
    Alert.alert('Succès', 'Mot de passe modifié avec succès !');
    onBack();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <ArrowLeft size={28} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>Mot de passe oublié</Text>
      </View>

      {step === 1 && (
        <>
          <Text style={styles.infoText}>
            Entrez votre adresse email pour vérifier si elle existe dans la base.
          </Text>
          <View style={styles.inputContainer}>
            <Mail size={20} color="#94a3b8" />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity style={styles.button} onPress={checkEmail}>
            <Text style={styles.buttonText}>Vérifier email</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 2 && (
        <>
          <Text style={styles.infoText}>
            Entrez votre nouveau mot de passe.
          </Text>
          <View style={styles.inputContainer}>
            <Lock size={20} color="#94a3b8" />
            <TextInput
              style={styles.input}
              placeholder="Nouveau mot de passe"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
          </View>
          <TouchableOpacity style={styles.button} onPress={handleResetPassword}>
            <Text style={styles.buttonText}>Modifier mot de passe</Text>
          </TouchableOpacity>
        </>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 30, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 22, fontWeight: 'bold', marginLeft: 15, color: '#0f172a' },
  infoText: { fontSize: 15, color: '#64748b', marginBottom: 20 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 15, paddingHorizontal: 15, marginBottom: 20, height: 55 },
  input: { flex: 1, marginLeft: 10, fontSize: 14 },
  button: { backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default ForgotPassword;
