const express = require('express');
const { query } = require('./databases/db');
const router = express.Router();
const { io } = require('./server');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const uploadsDir = path.join(__dirname, 'uploads');
console.log('📁 Chemin uploads:', uploadsDir);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Dossier uploads créé');
}

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

// Récupérer tous les utilisateurs
router.get('/users', async (req, res) => {
  try {
    const result = await query('SELECT id, username, email, avatar, is_online, password, bio FROM users');
    res.json({ success: true, users: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ UPLOAD FILES ============

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, './uploads');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `file_${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'audio/mpeg',
      'audio/mp4',
      'audio/m4a',
      'audio/wav',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'));
    }
  }
});

router.post('/uploads', upload.single('file'), async (req, res) => {
  try {
    console.log('=== NOUVELLE REQUÊTE UPLOAD ===');
    console.log('📥 Timestamp:', new Date().toISOString());
    
    if (!req.file) {
      console.error('❌ Aucun fichier dans la requête');
      return res.status(400).json({ 
        success: false, 
        message: 'Aucun fichier fourni' 
      });
    }

    console.log('📁 Détails fichier:', {
      originalname: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    if (!fs.existsSync(req.file.path)) {
      console.error('❌ Fichier non trouvé sur disque');
      return res.status(500).json({
        success: false,
        message: 'Erreur: fichier non sauvegardé'
      });
    }

    const host = process.env.EXPO_PUBLIC_API_HOST || 'localhost';
    const port = process.env.EXPO_PUBLIC_API_PORT || '3000';
    const fileUrl = `http://${host}:${port}/uploads/${req.file.filename}`;

    console.log('✅ Fichier uploadé:', fileUrl);

    res.json({
      success: true,
      fileUrl: fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    console.error('❌ Erreur upload:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de l\'upload',
      error: error.message 
    });
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Fichier trop volumineux (max 50MB)'
      });
    }
  }
  next(error);
});

// ============ GROUPS ============

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

    await query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
      [groupId, createdBy, 'admin']
    );
    
    if (!isPrivate && io) {
      io.emit('new_public_group', groupResult.rows[0]);
    }

    res.json({ success: true, group: groupResult.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    await query('DELETE FROM groups WHERE id = $1', [groupId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

router.get('/groupes', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM groups WHERE is_private = 0 ORDER BY last_update DESC'
    );
    res.json({ success: true, groups: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ GROUP MEMBERS ============

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

// GET: Récupérer les messages d'un groupe
router.get('/groups/:groupId/messages', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.query;

    let queryText = `
      SELECT id, group_id as "roomId", sender_id as "senderId", content, type,
            file_name as "fileName", file_url as "fileUrl", 
            image_url as "imageUrl", audio_url as "audioUrl", timestamp, is_deleted
      FROM group_messages 
      WHERE group_id = $1
    `;

    const params = [groupId];

    if (userId) {
      queryText += ` AND id NOT IN (SELECT message_id FROM deleted_group_messages WHERE user_id = $2)`;
      params.push(userId);
    }

    queryText += ` ORDER BY timestamp ASC`;

    const result = await query(queryText, params);

    res.json({ success: true, messages: result.rows });
  } catch (error) {
    console.error('❌ Erreur récupération messages groupe:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST: Envoyer un message de groupe
router.post('/groups/:groupId/messages', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { senderId, content, type, fileName, fileUrl, imageUrl, audioUrl, timestamp } = req.body;

    console.log('📩 Message de groupe reçu:', { 
      groupId, 
      senderId, 
      type, 
      content: content?.substring(0, 50) 
    });

    await query(
      `INSERT INTO group_messages 
      (group_id, sender_id, content, type, file_name, file_url, image_url, audio_url, timestamp) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [groupId, senderId, content, type, fileName, fileUrl, imageUrl, audioUrl, timestamp]
    );

    await query('UPDATE groups SET last_update = $1 WHERE id = $2', [timestamp, groupId]);

    console.log('✅ Message de groupe enregistré');

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erreur enregistrement message groupe:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ GROUP MESSAGE DELETION ============

router.post('/groups/messages/delete-local', async (req, res) => {
  try {
    const { userId, messageId } = req.body;

    await query(
      'INSERT INTO deleted_group_messages (user_id, message_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, messageId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erreur suppression locale message groupe:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/groups/messages/:messageId/delete-all', async (req, res) => {
  try {
    const { messageId } = req.params;

    await query(
      `UPDATE group_messages SET content = $1, is_deleted = 1 WHERE id = $2`,
      ['Ce message a été supprimé', messageId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erreur suppression message groupe pour tous:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ PRIVATE MESSAGES ============

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

router.post('/private-messages', async (req, res) => {
  try {
    const { senderId, receiverId, content, type, fileName, fileUrl, imageUrl, audioUrl, timestamp } = req.body;

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

// ============ BLOCKS ============

router.get('/blocks/check/:me/:other', async (req, res) => {
  try {
    const { me, other } = req.params;

    const result = await query(
      'SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [me, other]
    );

    res.json({ blocked: result.rows.length > 0 });
  } catch (error) {
    console.error('❌ Erreur checkBlock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/blocks', async (req, res) => {
  try {
    const { blockerId, blockedId } = req.body;

    await query(
      `INSERT INTO blocks (blocker_id, blocked_id, created_at)
      VALUES ($1, $2, NOW())`,
      [blockerId, blockedId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erreur block user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/blocks', async (req, res) => {
  try {
    const { blockerId, blockedId } = req.body;

    await query(
      'DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [blockerId, blockedId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erreur unblock user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;