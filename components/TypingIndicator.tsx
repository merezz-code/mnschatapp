import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { subscribeToTyping, getTypingUsers } from '../services/typingIndicator';
import { db } from '../services/database';

interface Props {
  chatId: string;
  currentUserId: string;
  isGroup?: boolean;
}

const TypingIndicator: React.FC<Props> = ({ chatId, currentUserId, isGroup }) => {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    const unsubscribe = subscribeToTyping(chatId, () => {
      const users = getTypingUsers(chatId, currentUserId);
      setTypingUsers(users);
    });

    return unsubscribe;
  }, [chatId, currentUserId]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: typingUsers.length > 0 ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [typingUsers.length]);

  if (typingUsers.length === 0) return null;

  const getUserName = (userId: string) => {
    try {
      const user = db.getFirstSync('SELECT username FROM users WHERE id = ?', [userId]);
      return user?.username || 'Utilisateur';
    } catch {
      return 'Utilisateur';
    }
  };

  const text = isGroup
    ? typingUsers.length === 1
      ? `${getUserName(typingUsers[0])} est en train d'écrire...`
      : `${typingUsers.length} personnes écrivent...`
    : "est en train d'écrire...";

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.dot} />
      <View style={styles.dot} />
      <View style={styles.dot} />
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#64748b',
    marginRight: 4,
  },
  text: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
    marginLeft: 6,
  },
});

export default TypingIndicator;