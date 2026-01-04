import { db } from './database';

// ==================== MESSAGES PRIVÉS ====================

/**
 * Marquer tous les messages reçus d'une conversation privée comme lus
 */
export function markPrivateMessagesAsRead(senderId: string, receiverId: string) {
  try {
    db.runSync(
      `UPDATE private_messages 
       SET is_read = 1 
       WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
      [senderId, receiverId]
    );
    console.log(`✅ Messages privés marqués comme lus (de ${senderId} vers ${receiverId})`);
  } catch (error) {
    console.error('Erreur marquage messages privés lus:', error);
  }
}

/**
 * Compter les messages non lus d'une conversation privée
 */
export function getUnreadPrivateCount(senderId: string, receiverId: string): number {
  try {
    const result: any = db.getFirstSync(
      `SELECT COUNT(*) as count FROM private_messages 
       WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
      [senderId, receiverId]
    );
    return result?.count || 0;
  } catch (error) {
    console.error('Erreur comptage messages privés non lus:', error);
    return 0;
  }
}

/**
 * Compter le TOTAL de messages non lus pour un utilisateur (toutes conversations)
 */
export function getTotalUnreadPrivateCount(userId: string): number {
  try {
    const result: any = db.getFirstSync(
      `SELECT COUNT(*) as count FROM private_messages 
       WHERE receiver_id = ? AND is_read = 0`,
      [userId]
    );
    return result?.count || 0;
  } catch (error) {
    console.error('Erreur comptage total messages privés non lus:', error);
    return 0;
  }
}

/**
 * Obtenir le nombre de messages non lus pour chaque conversation privée
 */
export function getUnreadCountsByPrivateChat(userId: string): { [chatId: string]: number } {
  try {
    const unreadMessages = db.getAllSync(
      `SELECT sender_id, COUNT(*) as count 
       FROM private_messages 
       WHERE receiver_id = ? AND is_read = 0 
       GROUP BY sender_id`,
      [userId]
    );

    const result: { [chatId: string]: number } = {};
    unreadMessages.forEach((msg: any) => {
      result[msg.sender_id] = msg.count;
    });

    return result;
  } catch (error) {
    console.error('Erreur récupération compteurs privés:', error);
    return {};
  }
}

// ==================== MESSAGES DE GROUPE ====================

/**
 * Marquer les messages d'un groupe comme lus pour un utilisateur
 */
export function markGroupMessagesAsRead(groupId: string, userId: string) {
  try {
    const readAt = Date.now();
    
    // Récupérer les messages non lus (que l'utilisateur n'a pas encore lus)
    const unreadMessages = db.getAllSync(
      `SELECT id FROM group_messages 
       WHERE group_id = ? 
       AND sender_id != ?
       AND id NOT IN (
         SELECT message_id FROM message_reads WHERE user_id = ?
       )`,
      [groupId, userId, userId]
    );

    // Marquer chaque message comme lu
    unreadMessages.forEach((msg: any) => {
      db.runSync(
        'INSERT OR IGNORE INTO message_reads (message_id, user_id, read_at) VALUES (?, ?, ?)',
        [msg.id, userId, readAt]
      );
    });

    console.log(`✅ ${unreadMessages.length} messages de groupe marqués comme lus pour ${userId}`);
  } catch (error) {
    console.error('Erreur marquage messages groupe lus:', error);
  }
}

/**
 * Compter les messages non lus d'un groupe pour un utilisateur
 */
export function getUnreadGroupCount(groupId: string, userId: string): number {
  try {
    const result: any = db.getFirstSync(
      `SELECT COUNT(*) as count FROM group_messages 
       WHERE group_id = ? 
       AND sender_id != ?
       AND id NOT IN (
         SELECT message_id FROM message_reads WHERE user_id = ?
       )`,
      [groupId, userId, userId]
    );
    return result?.count || 0;
  } catch (error) {
    console.error('Erreur comptage messages groupe non lus:', error);
    return 0;
  }
}

/**
 * Compter le TOTAL de messages non lus dans TOUS les groupes pour un utilisateur
 */
export function getTotalUnreadGroupCount(userId: string): number {
  try {
    // Récupérer tous les groupes dont l'utilisateur est membre
    const userGroups = db.getAllSync(
      'SELECT group_id FROM group_members WHERE user_id = ?',
      [userId]
    );

    let totalUnread = 0;
    
    userGroups.forEach((group: any) => {
      const count = getUnreadGroupCount(group.group_id, userId);
      totalUnread += count;
    });

    return totalUnread;
  } catch (error) {
    console.error('Erreur comptage total messages groupe non lus:', error);
    return 0;
  }
}

/**
 * Obtenir le nombre de messages non lus pour chaque groupe
 */
export function getUnreadCountsByGroup(userId: string): { [groupId: string]: number } {
  try {
    const userGroups = db.getAllSync(
      'SELECT group_id FROM group_members WHERE user_id = ?',
      [userId]
    );

    const result: { [groupId: string]: number } = {};
    
    userGroups.forEach((group: any) => {
      const count = getUnreadGroupCount(group.group_id, userId);
      if (count > 0) {
        result[group.group_id] = count;
      }
    });

    return result;
  } catch (error) {
    console.error('Erreur récupération compteurs groupes:', error);
    return {};
  }
}