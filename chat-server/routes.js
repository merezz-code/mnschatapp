const express = require('express');
const { query } = require('./databases/db');
const router = express.Router();

// ============ USERS ============

// Inscription
router.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    console.log('📝 Inscription reçue:', { username, email, passwordLength: password?.length });
    
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tous les champs sont requis' 
      });
    }
    
    // Vérifier si l'email existe déjà
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cet email est déjà utilisé' 
      });
    }
    
    const userId = Math.random().toString(36).substring(2, 11);
    const avatar = `https://i.pravatar.cc/150?u=${userId}`;
    
    // Le mot de passe est déjà hashé côté client
    const result = await query(
      `INSERT INTO users (id, username, email, password, avatar, bio) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, username, email, password, avatar, 'Disponible']
    );
    
    console.log('✅ Utilisateur créé:', result.rows[0].id);
    
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('❌ Erreur inscription:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Connexion
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔑 Connexion tentée:', { email });
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email et mot de passe requis' 
      });
    }
    
    // Le mot de passe est déjà hashé côté client
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND password = $2 LIMIT 1',
      [email, password]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Identifiants invalides pour:', email);
      return res.status(401).json({ 
        success: false, 
        error: 'Email ou mot de passe incorrect' 
      });
    }
    
    console.log('✅ Connexion réussie:', result.rows[0].id);
    
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('❌ Erreur connexion:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mise à jour profil
router.put('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, bio, avatar } = req.body;
    
    await query(
      'UPDATE users SET username = $1, bio = $2, avatar = $3 WHERE id = $4',
      [username, bio, avatar, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Récupérer tous les utilisateurs (pour contacts)
router.get('/users', async (req, res) => {
  try {
    const result = await query('SELECT id, username, email,  avatar, is_online, password, bio FROM users');
    res.json({ success: true, users: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ GROUPS ============

// Récupérer les groupes d'un utilisateur
router.get('/groups/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await query(
      `SELECT g.* FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = $1
       ORDER BY g.last_update DESC`,
      [userId]
    );
    
    res.json({ success: true, groups: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Créer un groupe
router.post('/groups', async (req, res) => {
  try {
    const { name, createdBy, isPrivate } = req.body;
    const timestamp = Date.now();
    
    const groupResult = await query(
      `INSERT INTO groups (name, avatar, is_private, created_by, last_update) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, `https://picsum.photos/seed/${name}/200`, isPrivate ? 1 : 0, createdBy, timestamp]
    );
    
    const groupId = groupResult.rows[0].id;
    
    // Ajouter le créateur comme admin
    await query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
      [groupId, createdBy, 'admin']
    );
    
    res.json({ success: true, group: groupResult.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Supprimer un groupe
router.delete('/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    await query('DELETE FROM groups WHERE id = $1', [groupId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mettre à jour le nom du groupe
router.put('/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name } = req.body;
    
    await query(
      'UPDATE groups SET name = $1, last_update = $2 WHERE id = $3',
      [name, Date.now(), groupId]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ GROUP MEMBERS ============

// Récupérer les membres d'un groupe
router.get('/groups/:groupId/members', async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const result = await query(
      'SELECT user_id as id, role FROM group_members WHERE group_id = $1',
      [groupId]
    );
    
    res.json({ success: true, members: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ajouter un membre au groupe
router.post('/groups/:groupId/members', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId, role } = req.body;
    
    await query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [groupId, userId, role || 'member']
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Retirer un membre du groupe
router.delete('/groups/:groupId/members/:userId', async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    
    await query(
      'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ GROUP MESSAGES ============

// Récupérer les messages d'un groupe
router.get('/groups/:groupId/messages', async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const result = await query(
      `SELECT id, group_id as "roomId", sender_id as "senderId", content, type,
              file_name as "fileName", file_url as "fileUrl", 
              image_url as "imageUrl", audio_url as "audioUrl", timestamp
       FROM group_messages 
       WHERE group_id = $1 
       ORDER BY timestamp ASC`,
      [groupId]
    );
    
    res.json({ success: true, messages: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enregistrer un message de groupe
router.post('/groups/:groupId/messages', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { senderId, content, type, fileName, fileUrl, imageUrl, audioUrl, timestamp } = req.body;
    
    await query(
      `INSERT INTO group_messages 
       (group_id, sender_id, content, type, file_name, file_url, image_url, audio_url, timestamp) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [groupId, senderId, content, type, fileName, fileUrl, imageUrl, audioUrl, timestamp]
    );
    
    // Mettre à jour last_update du groupe
    await query('UPDATE groups SET last_update = $1 WHERE id = $2', [timestamp, groupId]);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ PRIVATE MESSAGES ============

// Récupérer les messages privés entre deux utilisateurs
router.get('/private-messages/:userId1/:userId2', async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    
    const result = await query(
      `SELECT id, sender_id as "senderId", receiver_id as "receiverId", 
              content, type, file_name as "fileName", file_url as "fileUrl",
              image_url as "imageUrl", audio_url as "audioUrl", timestamp, is_deleted
       FROM private_messages 
       WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
       AND id NOT IN (SELECT message_id FROM deleted_messages WHERE user_id = $1)
       ORDER BY timestamp ASC`,
      [userId1, userId2]
    );
    
    res.json({ success: true, messages: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Envoyer un message privé
router.post('/private-messages', async (req, res) => {
  try {
    const { senderId, receiverId, content, type, fileName, fileUrl, imageUrl, audioUrl, timestamp } = req.body;
    
    // VÉRIFIER que les utilisateurs existent
    const users = await query('SELECT id FROM users WHERE id = $1 OR id = $2', [senderId, receiverId]);
    
    if (users.rows.length !== 2) {
      console.error(`❌ Utilisateur manquant: sender=${senderId}, receiver=${receiverId}`);
      return res.status(400).json({ 
        success: false, 
        error: 'Un des utilisateurs n\'existe pas' 
      });
    }
    
    await query(
      `INSERT INTO private_messages 
       (sender_id, receiver_id, content, type, file_name, file_url, image_url, audio_url, timestamp) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [senderId, receiverId, content, type, fileName, fileUrl, imageUrl, audioUrl, timestamp]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Récupérer les conversations privées d'un utilisateur
router.get('/private-chats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await query(
      `SELECT 
        CASE 
          WHEN sender_id = $1 THEN receiver_id 
          ELSE sender_id 
        END AS other_user_id,
        MAX(timestamp) AS max_timestamp
      FROM private_messages
      WHERE sender_id = $1 OR receiver_id = $1
      GROUP BY other_user_id`,
      [userId]
    );
    
    res.json({ success: true, conversations: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Supprimer un message pour un utilisateur
router.post('/private-messages/delete-local', async (req, res) => {
  try {
    const { userId, messageId } = req.body;
    
    await query(
      'INSERT INTO deleted_messages (user_id, message_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, messageId]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Supprimer un message pour tous
router.put('/private-messages/:messageId/delete-all', async (req, res) => {
  try {
    const { messageId } = req.params;
    
    await query(
      `UPDATE private_messages SET content = $1, is_deleted = 1 WHERE id = $2`,
      ['Ce message a été supprimé', messageId]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;