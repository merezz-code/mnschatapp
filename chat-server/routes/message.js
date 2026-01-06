const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

// Récupérer les messages privés entre deux utilisateurs
router.get('/private/:contactId', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const contactId = req.params.contactId;
    
    const result = await pool.query(
      `SELECT 
        pm.id, pm.content, pm.type, pm.is_read, pm.is_deleted, pm.created_at,
        pm.sender_id as "senderId", pm.receiver_id as "receiverId",
        u.username as sender_username
      FROM private_messages pm
      JOIN users u ON pm.sender_id = u.id
      WHERE (pm.sender_id = $1 AND pm.receiver_id = $2)
         OR (pm.sender_id = $2 AND pm.receiver_id = $1)
      ORDER BY pm.created_at ASC`,
      [userId, contactId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur récupération messages:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer les messages de groupe
router.get('/group/:groupId', authenticateToken, async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.userId;
    
    // Vérifier que l'utilisateur est membre du groupe
    const memberCheck = await pool.query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    const result = await pool.query(
      `SELECT 
        gm.id, gm.content, gm.type, gm.is_deleted, gm.created_at,
        gm.sender_id as "senderId", gm.group_id as "groupId",
        u.username as sender_username, u.profile_picture
      FROM group_messages gm
      JOIN users u ON gm.sender_id = u.id
      WHERE gm.group_id = $1
      ORDER BY gm.created_at ASC`,
      [groupId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur récupération messages groupe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Envoyer un message privé (via HTTP, pas Socket.io)
router.post('/private', authenticateToken, async (req, res) => {
  try {
    const senderId = req.userId;
    const { receiverId, content, type = 'text' } = req.body;
    
    const result = await pool.query(
      `INSERT INTO private_messages (sender_id, receiver_id, content, type)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_id as "senderId", receiver_id as "receiverId", content, type, created_at`,
      [senderId, receiverId, content, type]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erreur envoi message:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Marquer un message comme lu
router.patch('/private/:messageId/read', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE private_messages SET is_read = true WHERE id = $1',
      [req.params.messageId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur marquage lu:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un message
router.delete('/private/:messageId', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE private_messages SET is_deleted = true WHERE id = $1 AND sender_id = $2',
      [req.params.messageId, req.userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression message:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;